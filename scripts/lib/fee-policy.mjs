import { createHash } from "node:crypto";
export const feeTypes = [
  "payment_markup",
  "transfer_markup",
  "bank_deposit_markup",
  "next_day_bank_withdrawal_markup",
  "rtp_withdrawal_markup",
  "bank_wire_withdrawal_markup",
  "digital_wallet_withdrawal_markup",
  "crypto_withdrawal_markup",
  "crypto_deposit_markup",
  "crypto_swap_markup",
];
export function prepareFeePolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy))
    throw new Error("Invalid fee policy");
  if (!/^biz_[a-zA-Z0-9]+$/.test(policy.accountId ?? ""))
    throw new Error("Exact target account required");
  if (!["sandbox", "production"].includes(policy.environment))
    throw new Error("Explicit environment required");
  if (!feeTypes.includes(policy.feeType))
    throw new Error("Unsupported fee type");
  if (
    !Number.isSafeInteger(policy.basisPoints) ||
    policy.basisPoints < 0 ||
    policy.basisPoints > 2500
  )
    throw new Error("Basis points must be an integer from 0 to 2500");
  if (
    !Number.isSafeInteger(policy.fixedMinor) ||
    policy.fixedMinor < 0 ||
    policy.fixedMinor > 5000
  )
    throw new Error("Fixed USD cents must be an integer from 0 to 5000");
  if (
    typeof policy.disclosure !== "string" ||
    policy.disclosure.trim().length < 20 ||
    policy.disclosure.length > 2000
  )
    throw new Error("Customer fee disclosure required");
  if (
    typeof policy.approvalReference !== "string" ||
    policy.approvalReference.trim().length < 5
  )
    throw new Error("Provider/commercial approval reference required");
  const payload = {
    account_id: policy.accountId,
    fee_type: policy.feeType,
    percentage_fee: policy.basisPoints / 100,
    fixed_fee_usd: policy.fixedMinor / 100,
    notes: `Approved policy: ${policy.approvalReference}`,
  };
  const review = {
    environment: policy.environment,
    payload,
    disclosure: policy.disclosure,
  };
  return {
    ...review,
    digest: createHash("sha256").update(JSON.stringify(review)).digest("hex"),
  };
}
export function estimateMarkup(amountMinor, basisPoints, fixedMinor) {
  for (const value of [amountMinor, basisPoints, fixedMinor])
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Nonnegative integer required");
  const result =
    (BigInt(amountMinor) * BigInt(basisPoints) + 5000n) / 10000n +
    BigInt(fixedMinor);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Overflow");
  return Number(result);
}
