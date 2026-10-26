import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import {
  applyCompletedTransfer,
  verifyTransfer,
  retrieveOrSubmitTransfer,
  type TransferOperation,
  type Transfer,
} from "../src/server/transfers";
import { WhopProductionAdapter } from "../src/server/whop";
import { initialState, safeToSpend } from "../src/domain";
const op: TransferOperation = {
  id: "operation-test",
  business_id: "business-test",
  commitment_id: "commit-shooter",
  origin_id: "biz_creator",
  destination_id: "biz_maya",
  amount_cents: 45000,
  operation_key: "idempotency-test",
  whop_transfer_id: "tr_test",
  created_at: new Date().toISOString(),
  status: "processing",
};
const transfer: Transfer = {
  id: "tr_test",
  object: "transfer",
  amount: 450,
  currency: "usd",
  origin: { id: "biz_creator" },
  destination: { id: "biz_maya" },
  status: "succeeded",
  fee_amount: 0,
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("verified contractor payouts", () => {
  it("only canonical success resolves the commitment", () => {
    for (const status of ["processing", "failed"] as const)
      expect(
        applyCompletedTransfer(initialState, op, { ...transfer, status }),
      ).toEqual(initialState);
    const next = applyCompletedTransfer(initialState, op, transfer);
    expect(next.commitments[0].paid).toBe(45000);
    expect(safeToSpend(next).total).toBe(safeToSpend(initialState).total);
  });
  it("duplicate or out-of-order success cannot pay twice", () => {
    const s = applyCompletedTransfer(initialState, op, transfer);
    expect(applyCompletedTransfer(s, op, transfer)).toEqual(s);
    expect(
      applyCompletedTransfer(s, op, { ...transfer, status: "failed" }),
    ).toEqual(s);
  });
  it("rejects wrong amount, destination and source even when status succeeded", () => {
    for (const altered of [
      { ...transfer, id: "tr_other" },
      { ...transfer, amount: 449 },
      { ...transfer, destination: { id: "biz_attacker" } },
      { ...transfer, origin: { id: "biz_other" } },
    ])
      expect(() => verifyTransfer(altered, op)).toThrow();
  });
  it("rejects commitment tampering and records verified fee once", () => {
    const tampered = structuredClone(initialState);
    tampered.commitments[0].amount = 44000;
    expect(() => applyCompletedTransfer(tampered, op, transfer)).toThrow();
    const next = applyCompletedTransfer(initialState, op, {
      ...transfer,
      fee_amount: 1.5,
    });
    expect(next.expenses.at(-1)).toMatchObject({
      amount: 150,
      projectId: "project-johnson",
      settledExternally: true,
    });
  });
  it("never retries a submit after the provider idempotency retention window", async () => {
    vi.stubEnv("WHOP_API_KEY", "test");
    vi.stubEnv("WHOP_ENVIRONMENT", "production");
    vi.stubEnv("WHOP_PAYOUTS_ENABLED", "true");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      retrieveOrSubmitTransfer(new WhopProductionAdapter(), {
        ...op,
        whop_transfer_id: null,
        created_at: "2020-01-01T00:00:00Z",
      }),
    ).rejects.toThrow("expired");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("submit uses exact persisted idempotency key and is disabled by default", async () => {
    vi.stubEnv("WHOP_API_KEY", "test");
    vi.stubEnv("WHOP_ENVIRONMENT", "production");
    vi.stubEnv("WHOP_PAYOUTS_ENABLED", "");
    await expect(
      retrieveOrSubmitTransfer(new WhopProductionAdapter(), {
        ...op,
        whop_transfer_id: null,
      }),
    ).rejects.toThrow("disabled");
    vi.stubEnv("WHOP_PAYOUTS_ENABLED", "true");
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(transfer)));
    vi.stubGlobal("fetch", fetch);
    await retrieveOrSubmitTransfer(new WhopProductionAdapter(), {
      ...op,
      whop_transfer_id: null,
    });
    expect(fetch.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
      op.operation_key,
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      idempotence_key: op.operation_key,
      destination_id: "biz_maya",
      amount: 450,
      type: "ledger",
    });
  });
});
