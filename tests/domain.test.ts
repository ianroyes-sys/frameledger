import { describe, it, expect } from "vitest";
import {
  initialState,
  reducer,
  safeToSpend,
  allocate,
  projectProfit,
  purchaseImpact,
  minor,
  formatMoney,
  type FinancialState,
} from "../src/domain";
const seed = () => structuredClone(initialState);
describe("integer financial engine", () => {
  it("formats zero without a negative sign and preserves negative money", () => {
    expect(formatMoney(-0)).toBe("$0.00");
    expect(formatMoney(-103500)).toBe("-$1,035.00");
  });
  it("reconciles the booking deposit into reserves and commitments", () => {
    expect(safeToSpend(seed())).toMatchObject({
      balance: 160000,
      taxReserve: 40000,
      gearReserve: 16000,
      commitments: 57000,
      total: 47000,
    });
  });
  it("conserves every cent with largest remainder allocation", () => {
    for (let a = 0; a < 1000; a++) {
      const portions = allocate(a, [3333, 3333, 3334]);
      expect(portions.reduce((a, b) => a + b, 0)).toBe(a);
    }
  });
  it("rejects floats, bad percentages, overflows and negative allocations", () => {
    expect(() => minor(0.1)).toThrow();
    expect(() => minor(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => allocate(100, [2500, 8500])).toThrow();
    expect(() => allocate(-1, [10000])).toThrow();
  });
  it("deduplicates successful payment events", () => {
    const state = reducer(seed(), {
      type: "PAY_INVOICE",
      id: "invoice-final",
      eventId: "e1",
    });
    expect(
      reducer(state, {
        type: "PAY_INVOICE",
        id: "invoice-final",
        eventId: "e1",
      }),
    ).toEqual(state);
    expect(safeToSpend(state).balance).toBe(320000);
  });
  it("tracks partial payments without overpayment", () => {
    const s = reducer(seed(), {
      type: "PAY_INVOICE",
      id: "invoice-final",
      amount: 30000,
    });
    expect(s.invoices[1].status).toBe("partial");
    expect(s.invoices[1].paid).toBe(30000);
    expect(() =>
      reducer(s, { type: "PAY_INVOICE", id: "invoice-final", amount: 140000 }),
    ).toThrow();
  });
  it("refunds reserves proportionally and prevents duplicate refund", () => {
    let s = reducer(seed(), {
      type: "REFUND_PAYMENT",
      id: "demo-booking",
      amount: 80000,
      eventId: "refund1",
    });
    expect(safeToSpend(s)).toMatchObject({
      balance: 80000,
      taxReserve: 20000,
      gearReserve: 8000,
      total: -5000,
    });
    expect(
      reducer(s, {
        type: "REFUND_PAYMENT",
        id: "demo-booking",
        amount: 80000,
        eventId: "refund1",
      }),
    ).toEqual(s);
    s = reducer(s, {
      type: "REFUND_PAYMENT",
      id: "demo-booking",
      amount: 80000,
      eventId: "refund2",
    });
    expect(s.payments[0].tax + s.payments[0].gear).toBe(0);
  });
  it("reconciles expenses against travel estimates without double counting", () => {
    let s = reducer(seed(), {
      type: "ADD_EXPENSE",
      expense: {
        id: "fuel",
        merchant: "Fuel",
        amount: 6700,
        category: "Travel",
        date: "2026-09-28",
        projectId: "project-johnson",
        commitmentId: "commit-travel",
      },
    });
    expect(safeToSpend(s).total).toBe(47000);
    expect(safeToSpend(s).commitments).toBe(50300);
    s = reducer(s, { type: "RELEASE_COMMITMENT", id: "commit-travel" });
    expect(safeToSpend(s).total).toBe(52300);
  });
  it("completes wedding with Adobe overhead excluded from project profit", () => {
    let s = reducer(seed(), { type: "PAY_INVOICE", id: "invoice-final" });
    for (const e of [
      {
        id: "fuel",
        merchant: "Fuel",
        amount: 6700,
        category: "Travel",
        projectId: "project-johnson",
        commitmentId: "commit-travel",
      },
      { id: "adobe", merchant: "Adobe", amount: 5800, category: "Software" },
      {
        id: "rental",
        merchant: "Rental",
        amount: 14000,
        category: "Rental",
        projectId: "project-johnson",
      },
    ])
      s = reducer(s, {
        type: "ADD_EXPENSE",
        expense: { ...e, date: "2026-09-28" },
      });
    s = reducer(s, { type: "RELEASE_COMMITMENT", id: "commit-travel" });
    s = reducer(s, { type: "PAY_COMMITMENT", id: "commit-shooter" });
    s = reducer(s, { type: "CLOSE_PROJECT", id: "project-johnson" });
    expect(projectProfit(s, "project-johnson").actualProfit).toBe(254300);
    expect(safeToSpend(s).total).toBe(136500);
    expect(purchaseImpact(s, 240000).after).toBe(-103500);
  });
  it("blocks closing with unpaid balances or commitments", () => {
    expect(() =>
      reducer(seed(), { type: "CLOSE_PROJECT", id: "project-johnson" }),
    ).toThrow();
  });
  it("handles empty, zero and negative balance honestly", () => {
    const s: FinancialState = {
      ...seed(),
      openingBalance: 0,
      payments: [],
      expenses: [],
      commitments: [],
    };
    expect(safeToSpend(s).total).toBe(0);
    s.protectedReserves = 100;
    expect(safeToSpend(s).total).toBe(-100);
  });
  it("cannot attach expenses to deleted or unknown projects", () => {
    expect(() =>
      reducer(seed(), {
        type: "ASSIGN_EXPENSE",
        id: "none",
        projectId: "deleted",
      }),
    ).toThrow();
    expect(() => projectProfit(seed(), "deleted")).toThrow();
  });
  it("payment of reserved commitment does not change safe cash", () => {
    const s = seed();
    expect(
      safeToSpend(reducer(s, { type: "PAY_COMMITMENT", id: "commit-shooter" }))
        .total,
    ).toBe(safeToSpend(s).total);
  });
  it("live settled balance overrides pending payment receipts", () => {
    const s = seed();
    s.actualSettledBalance = 0;
    expect(safeToSpend(s).total).toBe(-113000);
  });
  it("live manually entered expense never releases cash from a snapshot", () => {
    const s = seed();
    s.actualSettledBalance = 160000;
    const next = reducer(s, {
      type: "ADD_EXPENSE",
      expense: {
        id: "fuel",
        merchant: "Fuel",
        amount: 6700,
        date: "2026-09-28",
        category: "Travel",
        projectId: "project-johnson",
        commitmentId: "commit-travel",
      },
    });
    expect(safeToSpend(next).total).toBe(safeToSpend(s).total);
  });
  it("does not mix currencies: V1 explicitly supports only USD", () => {
    expect(seed().currency).toBe("USD");
  });
});
