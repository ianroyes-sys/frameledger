import { describe, expect, it } from "vitest";
import { answerQuestion } from "../src/lib/intelligence";
import { initialState } from "../src/domain";
describe("Explainable intelligence", () => {
  it("uses actual cash and commitments for a lens purchase", () => {
    const result = answerQuestion(initialState, "Can I afford a $2,400 lens?");
    expect(
      result.facts.find((f) => f.label === "Safe to spend after")?.amount,
    ).toBe(-193000);
    expect(result.answer).toContain("exceeds");
  });
  it("does not act on financial instructions", () => {
    const result = answerQuestion(initialState, "Pay the contractor now");
    expect(result).not.toHaveProperty("action");
    expect(initialState.commitments[0].paid).toBe(0);
  });
  it("does not fabricate an answer to unsupported questions", () => {
    expect(
      answerQuestion(initialState, "Predict next year precisely").facts,
    ).toEqual([]);
  });
});
