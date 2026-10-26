import { describe, it, expect } from "vitest";
import {
  prepareFeePolicy,
  estimateMarkup,
} from "../scripts/lib/fee-policy.mjs";
const policy = {
  accountId: "biz_synthetic",
  environment: "sandbox",
  feeType: "payment_markup",
  basisPoints: 50,
  fixedMinor: 0,
  disclosure:
    "Platform fee: 0.50% of each qualifying payment, in addition to provider fees.",
  approvalReference: "TEST-ONLY",
};
describe("operator fee policy", () => {
  it("converts basis points to percent and cents to dollars, not a fraction", () => {
    expect(
      prepareFeePolicy({ ...policy, fixedMinor: 30 }).payload,
    ).toMatchObject({ percentage_fee: 0.5, fixed_fee_usd: 0.3 });
  });
  it("binds confirmation to account, environment, rate and disclosure", () => {
    const original = prepareFeePolicy(policy).digest;
    for (const change of [
      { accountId: "biz_other" },
      { environment: "production" },
      { basisPoints: 60 },
      { disclosure: "A different complete disclosure." },
    ])
      expect(prepareFeePolicy({ ...policy, ...change }).digest).not.toBe(
        original,
      );
  });
  it("rejects undocumented types, bad money and absent approval", () => {
    for (const change of [
      { feeType: "interchange" },
      { basisPoints: 2501 },
      { basisPoints: 1.5 },
      { fixedMinor: -1 },
      { fixedMinor: 5001 },
      { approvalReference: "" },
      { disclosure: "" },
    ])
      expect(() => prepareFeePolicy({ ...policy, ...change })).toThrow();
  });
  it("estimates integer cents without claiming provider rounding", () => {
    expect(estimateMarkup(160000, 50, 0)).toBe(800);
    expect(estimateMarkup(101, 50, 0)).toBe(1);
    expect(() => estimateMarkup(Number.MAX_SAFE_INTEGER, 10000, 1)).toThrow();
  });
});
