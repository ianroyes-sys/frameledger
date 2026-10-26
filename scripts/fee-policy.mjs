/** Operator-only tool. Preview is default. No customer-facing fee-setting endpoint. */
import { readFile, appendFile } from "node:fs/promises";
import { prepareFeePolicy } from "./lib/fee-policy.mjs";
const [file, action, confirmation] = process.argv.slice(2);
try {
  if (!file)
    throw new Error(
      "Usage: npm run fees:review -- policy.json [--apply REVIEW_DIGEST]",
    );
  const review = prepareFeePolicy(JSON.parse(await readFile(file, "utf8")));
  if (!action) {
    console.log(JSON.stringify(review, null, 2));
    console.log(
      "PREVIEW ONLY. This does not activate fees, publish disclosure, verify approval, or establish revenue settlement.",
    );
  } else {
    if (action !== "--apply" || confirmation !== review.digest)
      throw new Error("Apply requires the exact reviewed policy digest");
    if (process.env.WHOP_FEE_CHANGES_ENABLED !== "true")
      throw new Error("Fee changes are disabled");
    if (
      process.env.WHOP_ENVIRONMENT !== review.environment ||
      !process.env.WHOP_API_KEY
    )
      throw new Error("Matching environment and server credential required");
    const base =
      review.environment === "production"
        ? "https://api.whop.com/api/v1"
        : "https://sandbox-api.whop.com/api/v1";
    // Durable local intent before network submission. Never retry an uncertain result automatically.
    const auditFile = ".fee-policy-audit.jsonl";
    await appendFile(
      auditFile,
      JSON.stringify({
        at: new Date().toISOString(),
        status: "requested",
        ...review,
      }) + "\n",
      { mode: 0o600 },
    );
    const response = await fetch(base + "/fee_markups", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
        "Content-Type": "application/json",
        "Api-Version-Date": "2026-06-09",
      },
      body: JSON.stringify(review.payload),
      signal: AbortSignal.timeout(12000),
      redirect: "error",
    });
    if (!response.ok)
      throw new Error(
        `Provider HTTP ${response.status}; inspect provider configuration before retry`,
      );
    const result = await response.json();
    if (
      result.fee_type !== review.payload.fee_type ||
      result.percentage_fee !== review.payload.percentage_fee ||
      result.fixed_fee_usd !== review.payload.fixed_fee_usd ||
      typeof result.id !== "string"
    )
      throw new Error(
        "Provider response mismatch; verify current configuration before retry",
      );
    await appendFile(
      auditFile,
      JSON.stringify({
        at: new Date().toISOString(),
        status: "provider_confirmed",
        digest: review.digest,
        resourceId: result.id,
      }) + "\n",
      { mode: 0o600 },
    );
    console.log(
      "Provider accepted this fee configuration. Separately verify customer disclosure and settlement.",
    );
  }
} catch (error) {
  console.error(
    error instanceof Error && error.name === "TimeoutError"
      ? "Outcome uncertain after timeout. Inspect provider configuration before retry."
      : error instanceof Error
        ? error.message
        : "Fee configuration failed",
  );
  process.exitCode = 1;
}
