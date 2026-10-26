/** Read-only provider connectivity checks. No provisioning or money movement. */
const accountId = process.env.WHOP_PLATFORM_ACCOUNT_ID;
const key = process.env.WHOP_API_KEY;
const environment = process.env.WHOP_ENVIRONMENT;
if (
  !/^biz_[a-zA-Z0-9]+$/.test(accountId ?? "") ||
  !key ||
  !["sandbox", "production"].includes(environment ?? "")
) {
  console.error(
    "Required: WHOP_PLATFORM_ACCOUNT_ID, WHOP_API_KEY, explicit WHOP_ENVIRONMENT. No request sent.",
  );
  process.exitCode = 1;
} else {
  const base =
    environment === "production"
      ? "https://api.whop.com/api/v1"
      : "https://sandbox-api.whop.com/api/v1";
  for (const [name, path, validate] of [
    [
      "Platform account access",
      `/accounts/${encodeURIComponent(accountId)}`,
      (data) => data?.id === accountId,
    ],
    [
      "Card read permission",
      `/cards?account_id=${encodeURIComponent(accountId)}`,
      (data) => Array.isArray(data?.data),
    ],
    [
      "Fee administration read permission",
      `/fee_markups?account_id=${encodeURIComponent(accountId)}`,
      (data) => Array.isArray(data?.data),
    ],
  ]) {
    try {
      const response = await fetch(base + path, {
        headers: {
          Authorization: `Bearer ${key}`,
          "Api-Version-Date": "2026-06-09",
        },
        signal: AbortSignal.timeout(12000),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!validate(await response.json()))
        throw new Error("Unexpected response shape/account");
      console.log(`PASS ${name}`);
    } catch (error) {
      console.log(
        `FAIL ${name}: ${error instanceof Error && /^HTTP \d{3}$/.test(error.message) ? error.message : "unavailable or invalid response"}`,
      );
      process.exitCode = 1;
    }
  }
  console.log(
    "Read access only. Does not prove connected-account ownership, issuance eligibility, fee activation, full paginated inventory, webhook delivery or revenue settlement. No provider records were changed.",
  );
}
