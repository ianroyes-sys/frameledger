import { describe, expect, it } from "vitest";
import { initialState, reducer } from "../src/domain";
function closed() {
  let s = reducer(initialState, { type: "PAY_INVOICE", id: "invoice-final" });
  s = reducer(s, { type: "PAY_COMMITMENT", id: "commit-shooter" });
  s = reducer(s, { type: "RELEASE_COMMITMENT", id: "commit-travel" });
  return reducer(s, { type: "CLOSE_PROJECT", id: "project-johnson" });
}
const lateExpense = {
  id: "late-fuel",
  merchant: "Fuel",
  amount: 5000,
  category: "Travel",
  date: "2026-10-20",
  projectId: "project-johnson",
};
describe("closed project financial changes", () => {
  it("reopens after a late expense, new commitment or new invoice", () => {
    const s = closed();
    for (const action of [
      { type: "ADD_EXPENSE", expense: lateExpense },
      {
        type: "ADD_COMMITMENT",
        commitment: {
          id: "late-edit",
          projectId: "project-johnson",
          description: "Extra editing",
          amount: 10000,
          paid: 0,
          kind: "other",
        },
      },
      {
        type: "CREATE_INVOICE",
        invoice: {
          id: "late-invoice",
          projectId: "project-johnson",
          number: "INV-LATE",
          description: "Extra editing",
          amount: 15000,
          paid: 0,
          status: "draft",
          dueDate: "2026-11-01",
        },
      },
    ] as const) {
      const next = reducer(s, action);
      expect(next.projects[0].status).toBe("active");
      expect(s.projects[0].status).toBe("completed");
    }
  });
  it("reopens on refunds without reopening again for duplicate deliveries", () => {
    const s = closed();
    const event = {
      type: "REFUND_PAYMENT",
      id: "demo-booking",
      amount: 100,
      eventId: "late-refund",
    } as const;
    const next = reducer(s, event);
    expect(next.projects[0].status).toBe("active");
    expect(reducer(next, event)).toBe(next);
  });
  it("reopens both affected projects when moving an expense, but not on category or receipt metadata", () => {
    const s = closed();
    s.expenses.push(lateExpense);
    s.projects[1].status = "completed";
    const next = reducer(s, {
      type: "ASSIGN_EXPENSE",
      id: lateExpense.id,
      projectId: s.projects[1].id,
    });
    expect(next.projects.slice(0, 2).map((p) => p.status)).toEqual([
      "active",
      "active",
    ]);
    expect(
      reducer(s, {
        type: "UPDATE_EXPENSE",
        id: lateExpense.id,
        category: "Fuel",
        receipt: "receipt-id",
      }).projects[0].status,
    ).toBe("completed");
    expect(
      reducer(s, {
        type: "ASSIGN_EXPENSE",
        id: lateExpense.id,
        projectId: lateExpense.projectId,
      }).projects[0].status,
    ).toBe("completed");
  });
});
