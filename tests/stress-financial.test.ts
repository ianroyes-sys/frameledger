import { describe, expect, it } from "vitest";
import {
  allocate,
  initialState,
  projectProfit,
  purchaseImpact,
  reducer,
  safeToSpend,
} from "../src/domain";

describe("synthetic financial stress", () => {
  it("conserves cents across 10,000 deterministic allocation combinations", () => {
    let seed = 123456;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    for (let n = 0; n < 10000; n++) {
      const a = random() % 10001,
        b = random() % (10001 - a);
      const amount = n % 2 ? random() : Number.MAX_SAFE_INTEGER - random();
      const parts = allocate(amount, [a, b, 10000 - a - b]);
      expect(parts.every(Number.isSafeInteger)).toBe(true);
      expect(parts.reduce((sum, p) => sum + BigInt(p), 0n)).toBe(
        BigInt(amount),
      );
    }
  });
  it("does not lose a cent when large intermediate receipts cancel expenses", () => {
    const s = structuredClone(initialState);
    s.openingBalance = 2;
    s.payments = [
      { ...s.payments[0], amount: Number.MAX_SAFE_INTEGER, tax: 0, gear: 0 },
    ];
    s.commitments = [];
    s.expenses = [
      {
        id: "large",
        merchant: "Synthetic",
        category: "Other",
        date: "2026-09-28",
        amount: Number.MAX_SAFE_INTEGER - 1,
      },
    ];
    expect(safeToSpend(s).balance).toBe(3);
  });
  it("rejects unrepresentable forecast and project profit rather than displaying rounded cents", () => {
    const s = structuredClone(initialState);
    s.actualSettledBalance = Number.MIN_SAFE_INTEGER;
    s.payments = [];
    s.commitments = [];
    expect(() => purchaseImpact(s, 1)).toThrow("safe integer");
    s.actualSettledBalance = 0;
    s.invoices = [s.invoices[0]];
    s.payments = [0, 1].map((n) => ({
      id: `p${n}`,
      invoiceId: s.invoices[0].id,
      amount: Number.MAX_SAFE_INTEGER,
      tax: 0,
      gear: 0,
      fee: 0,
      refunded: 0,
    }));
    expect(() => projectProfit(s, "project-johnson")).toThrow("safe integer");
  });
  it("handles 10,000 expense-backed commitments without double counting", () => {
    const s = structuredClone(initialState);
    s.payments = [];
    s.openingBalance = 2000000;
    s.commitments = Array.from({ length: 10000 }, (_, n) => ({
      id: `c${n}`,
      projectId: "project-johnson",
      description: "Synthetic",
      amount: 100,
      paid: 0,
      kind: "travel" as const,
    }));
    s.expenses = s.commitments.map((c, n) => ({
      id: `e${n}`,
      commitmentId: c.id,
      projectId: c.projectId,
      merchant: "Synthetic",
      category: "Travel",
      date: "2026-09-28",
      amount: 40,
    }));
    expect(safeToSpend(s)).toMatchObject({
      balance: 1600000,
      commitments: 600000,
      total: 1000000,
    });
    expect(projectProfit(s, "project-johnson")).toMatchObject({
      costs: 400000,
      committed: 600000,
    });
  });
  it("fully releases reserves through 1,600 one-dollar partial refunds and duplicates", () => {
    let s = structuredClone(initialState);
    for (let n = 0; n < 1600; n++) {
      const action = {
        type: "REFUND_PAYMENT" as const,
        id: "demo-booking",
        amount: 100,
        eventId: `r${n}`,
      };
      s = reducer(s, action);
      expect(reducer(s, action)).toBe(s);
      expect(s.payments[0].tax + s.payments[0].gear).toBeLessThanOrEqual(
        s.payments[0].amount - s.payments[0].refunded,
      );
    }
    expect(safeToSpend(s)).toMatchObject({
      balance: 0,
      taxReserve: 0,
      gearReserve: 0,
    });
  });
});
