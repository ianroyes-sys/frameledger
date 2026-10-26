import { describe, it, expect } from "vitest";
import { initialState } from "../src/domain";
import {
  parseFinancialState,
  workspaceSnapshotSchema,
} from "../src/domain/state-schema";
describe("Workspace boundary validation", () => {
  it("accepts a valid financial snapshot", () => {
    expect(parseFinancialState(initialState)).toEqual(initialState);
  });
  it("rejects malformed nested rows instead of crashing during rendering", () => {
    expect(() =>
      parseFinancialState({ ...initialState, clients: [null] }),
    ).toThrow();
  });
  it("rejects fractional, overflowing and mixed currency money", () => {
    for (const change of [
      { openingBalance: 0.1 },
      { openingBalance: Number.MAX_SAFE_INTEGER + 1 },
      { currency: "EUR" },
    ])
      expect(() =>
        parseFinancialState({ ...initialState, ...change }),
      ).toThrow();
  });
  it("rejects executable and nonprovider payment URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "https://whop.com.attacker.example/invoice",
    ])
      expect(() =>
        parseFinancialState({
          ...initialState,
          invoices: [{ ...initialState.invoices[0], paymentUrl: url }],
        }),
      ).toThrow();
  });
  it("requires versioned API snapshots", () => {
    expect(
      workspaceSnapshotSchema.safeParse({ state: initialState }).success,
    ).toBe(false);
  });
});
