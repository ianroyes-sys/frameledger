import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhook } from "../src/server/webhook-signature";
import { workspaceCommand } from "../src/server/validation";
import {
  initialState,
  reducer,
  safeToSpend,
  purchaseImpact,
} from "../src/domain";
const secret = "ws_test_only_synthetic_secret";
const now = Date.parse("2026-09-28T12:00:00Z");
const event = {
  id: "evt_synthetic",
  type: "payment.succeeded",
  api_version: "v1",
  timestamp: "2026-09-28T12:00:00Z",
  data: { id: "pay_synthetic" },
};
function signed(
  raw = JSON.stringify(event),
  timestamp = String(now / 1000),
  id = event.id,
) {
  const signature = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${raw}`)
    .digest("base64");
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  });
}
describe("Webhook authenticity boundary", () => {
  it("verifies literal Whop secret bytes and exact raw payload", () => {
    const raw = JSON.stringify(event);
    expect(verifyWebhook(raw, signed(raw), secret, now).id).toBe(event.id);
  });
  it("rejects any changed payload after signing", () => {
    const raw = JSON.stringify(event);
    expect(() =>
      verifyWebhook(
        raw.replace("pay_synthetic", "pay_attacker"),
        signed(raw),
        secret,
        now,
      ),
    ).toThrow();
  });
  it("rejects stale and future signed messages", () => {
    const raw = JSON.stringify(event);
    for (const delta of [-301, 301])
      expect(() =>
        verifyWebhook(
          raw,
          signed(raw, String(now / 1000 + delta)),
          secret,
          now,
        ),
      ).toThrow();
  });
  it("rejects missing headers, wrong secret and malformed signatures", () => {
    const raw = JSON.stringify(event);
    expect(() => verifyWebhook(raw, new Headers(), secret, now)).toThrow();
    expect(() => verifyWebhook(raw, signed(raw), "wrong", now)).toThrow();
    expect(() => verifyWebhook(raw, signed(raw), "", now)).toThrow();
    const headers = signed(raw);
    headers.set("webhook-signature", "v1,not-base64");
    expect(() => verifyWebhook(raw, headers, secret, now)).toThrow();
  });
  it("requires signed body and header event identity to agree", () => {
    const raw = JSON.stringify(event);
    expect(() =>
      verifyWebhook(
        raw,
        signed(raw, String(now / 1000), "evt_other"),
        secret,
        now,
      ),
    ).toThrow();
  });
  it("accepts rotated signatures only when one v1 signature is valid", () => {
    const raw = JSON.stringify(event),
      headers = signed(raw);
    headers.set(
      "webhook-signature",
      `v1,AAAA ${headers.get("webhook-signature")}`,
    );
    expect(verifyWebhook(raw, headers, secret, now).id).toBe(event.id);
  });
});
describe("Production command boundary and financial invariants", () => {
  const envelope = {
    businessId: "14d7d462-7f1f-463b-a60d-2639201a43c0",
    revision: 0,
  };
  it("does not let clients invent payments, refunds, payouts or reset state", () => {
    for (const type of [
      "PAY_INVOICE",
      "PAY_COMMITMENT",
      "REFUND_PAYMENT",
      "RESET",
    ]) {
      expect(
        workspaceCommand.safeParse({
          ...envelope,
          command: { type, id: "x", amount: 100, eventId: "evt" },
        }).success,
      ).toBe(false);
    }
  });
  it("cannot set provider settlement provenance through a manual expense", () => {
    const parsed = workspaceCommand.parse({
      ...envelope,
      command: {
        type: "ADD_EXPENSE",
        expense: {
          id: "expense-test",
          merchant: "Fuel",
          amount: 6700,
          category: "Travel",
          date: "2026-09-28",
          settledExternally: true,
        },
      },
    });
    expect(
      "expense" in parsed.command &&
        "settledExternally" in parsed.command.expense,
    ).toBe(false);
  });
  it("manual fuel cannot inflate safe spending against unchanged provider snapshot", () => {
    const s = {
      ...structuredClone(initialState),
      actualSettledBalance: 160000,
    };
    const next = reducer(s, {
      type: "ADD_EXPENSE",
      expense: {
        id: "fuel-test",
        merchant: "Fuel",
        amount: 6700,
        category: "Travel",
        date: "2026-09-28",
        projectId: "project-johnson",
        commitmentId: "commit-travel",
      },
    });
    expect(safeToSpend(next).total).toBe(safeToSpend(s).total);
  });
  it("reassigning expense restores original project commitment", () => {
    const s = reducer(initialState, {
      type: "ADD_EXPENSE",
      expense: {
        id: "fuel-test",
        merchant: "Fuel",
        amount: 6700,
        category: "Travel",
        date: "2026-09-28",
        projectId: "project-johnson",
        commitmentId: "commit-travel",
      },
    });
    const moved = reducer(s, {
      type: "ASSIGN_EXPENSE",
      id: "fuel-test",
      projectId: "project-northline",
    });
    expect(moved.expenses[0].commitmentId).toBeUndefined();
    expect(safeToSpend(moved).commitments).toBe(57000);
  });
  it("rejects an unknown collaborator reference", () => {
    expect(() =>
      reducer(initialState, {
        type: "ADD_COMMITMENT",
        commitment: {
          id: "unknown-crew",
          projectId: "project-johnson",
          collaboratorId: "other-tenant-collaborator",
          description: "Crew",
          amount: 100,
          paid: 0,
          kind: "contractor",
        },
      }),
    ).toThrow();
  });
  it("does not present an overdue invoice as new expected revenue", () => {
    const s = structuredClone(initialState);
    s.invoices = s.invoices.filter((i) => i.id === "invoice-northline");
    expect(purchaseImpact(s, 100, "2026-09-28").expected30).toBe(0);
  });
});
