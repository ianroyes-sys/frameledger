import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { initialState, safeToSpend, projectProfit } from "../src/domain";
import { reconcilePayment } from "../src/server/payment-reconciliation";
const payment = {
  id: "pay_final",
  account_id: "biz_creator",
  status: "paid",
  total: { amount: "1600.00", currency: "usd" },
  amount_after_fees: { amount: "1550.00", currency: "usd" },
  refunded_amount: null as null | { amount: string; currency: string },
};
const apply = (raw: unknown, state = initialState) =>
  reconcilePayment(state, "invoice-final", "pay_final", "biz_creator", raw);

describe("canonical invoice payment reconciliation", () => {
  it.each(["open", "pending", "void", "uncollectible"])(
    "does not allocate %s payments with null totals",
    (status) => {
      expect(apply({ ...payment, status, total: null })).toBe(initialState);
    },
  );
  it("flags a previously collected payment losing paid status instead of silently refreshing stale accounting", () => {
    const next = apply(payment);
    expect(() =>
      apply({ ...payment, status: "void", total: null }, next),
    ).toThrow("operator review");
  });
  it.each(["dispute_lost", "resolution_lost"])(
    "does not silently treat %s as final project profit",
    (substatus) => {
      expect(() => apply({ ...payment, substatus })).toThrow("operator review");
    },
  );
  it("records paid revenue, fee and reserves once without mutating source", () => {
    const next = apply(payment);
    expect(next.payments.at(-1)).toMatchObject({
      amount: 160000,
      fee: 5000,
      tax: 40000,
      gear: 16000,
      refunded: 0,
    });
    expect(
      initialState.invoices.find((i) => i.id === "invoice-final")?.paid,
    ).toBe(0);
    expect(apply(payment, next)).toEqual(next);
    expect(projectProfit(next, "project-johnson").fees).toBe(5000);
  });
  it("applies partial/full refunds exactly once and never restores stale refunds", () => {
    const partial = {
      ...payment,
      refunded_amount: { amount: "400", currency: "usd" },
    };
    const next = apply(partial, apply(payment));
    expect(next.payments.at(-1)).toMatchObject({
      refunded: 40000,
      tax: 30000,
      gear: 12000,
    });
    expect(apply(partial, next)).toEqual(next);
    expect(apply(payment, next)).toEqual(next);
    const fully = apply(
      { ...partial, refunded_amount: { amount: "1600", currency: "usd" } },
      next,
    );
    expect(fully.payments.at(-1)).toMatchObject({
      refunded: 160000,
      tax: 0,
      gear: 0,
    });
    expect(safeToSpend(fully).total).toBe(
      safeToSpend(initialState).total - 5000,
    );
  });
  it("can discover an already-refunded payment on first sync", () => {
    const next = apply({
      ...payment,
      refunded_amount: { amount: "1600", currency: "usd" },
    });
    expect(next.payments.at(-1)?.refunded).toBe(160000);
    expect(next.invoices.find((i) => i.id === "invoice-final")?.paid).toBe(0);
  });
  it("rejects cross-account and mismatched payment IDs, including unpaid responses", () => {
    for (const raw of [
      { ...payment, account_id: "biz_other" },
      { ...payment, id: "pay_other" },
      { ...payment, status: "open", account_id: null },
    ])
      expect(() => apply(raw)).toThrow("identity");
  });
  it("rejects negative, excessive, mismatched and non-USD canonical amounts", () => {
    for (const raw of [
      { ...payment, total: { amount: "1599", currency: "usd" } },
      { ...payment, amount_after_fees: { amount: "1601", currency: "usd" } },
      { ...payment, amount_after_fees: { amount: "-1", currency: "usd" } },
      { ...payment, refunded_amount: { amount: "-1", currency: "usd" } },
      { ...payment, refunded_amount: { amount: "1601", currency: "usd" } },
      { ...payment, total: { amount: "1600", currency: "eur" } },
    ])
      expect(() => apply(raw)).toThrow();
  });
  it("reopens a closed project when the provider corrects a processing fee", () => {
    const next = apply(payment);
    next.projects[0].status = "completed";
    expect(apply(payment, next).projects[0].status).toBe("completed");
    const corrected = apply(
      { ...payment, amount_after_fees: { amount: "1549", currency: "usd" } },
      next,
    );
    expect(corrected.projects[0].status).toBe("active");
    expect(corrected.payments.at(-1)?.fee).toBe(5100);
  });
  it("fails closed for inconsistent historical event IDs", () => {
    const next = structuredClone(initialState);
    next.processedEvents.push("whop-payment-pay_final");
    expect(() => apply(payment, next)).toThrow("Stored payment");
  });
});
