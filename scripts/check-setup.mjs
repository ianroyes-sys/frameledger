/** Local-only prerequisite check. Never prints credential values or calls providers. */
const required = [
  "APP_ORIGIN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WHOP_API_KEY",
  "WHOP_WEBHOOK_SECRET",
  "CRON_SECRET",
];
const failures = [];
for (const name of required) {
  const present = Boolean(process.env[name]?.trim());
  console.log(`${present ? "PRESENT" : "MISSING"} ${name}`);
  if (!present) failures.push(name);
}
if (process.env.FRAMELEDGER_MODE !== "production")
  failures.push(
    "FRAMELEDGER_MODE must be production for authenticated service testing",
  );
if (!["sandbox", "production"].includes(process.env.WHOP_ENVIRONMENT ?? ""))
  failures.push(
    "WHOP_ENVIRONMENT must explicitly select sandbox or production",
  );
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      failures.push("Supabase URL must use HTTPS outside local development");
  } catch {
    failures.push("Supabase URL is invalid");
  }
}
if (process.env.CRON_SECRET && process.env.CRON_SECRET.length < 32)
  failures.push("Use at least 32 random characters for CRON_SECRET");
if (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ===
    process.env.SUPABASE_SERVICE_ROLE_KEY
)
  failures.push("Public and service credentials must differ");
if (
  process.env.WHOP_PAYOUTS_ENABLED === "true" &&
  !process.env.WHOP_TRANSFER_FEE_DISCLOSURE?.trim()
)
  failures.push("Enabled payouts require verified fee disclosure");
if (process.env.WHOP_CARD_ISSUING_ENABLED === "true") {
  if (process.env.WHOP_ENVIRONMENT !== "production")
    failures.push("Card issuance has no verified ordinary sandbox support");
  try {
    const terms = new URL(process.env.WHOP_CARD_TERMS_URL ?? "");
    if (
      terms.protocol !== "https:" ||
      !(
        terms.hostname === "whop.com" || terms.hostname.endsWith(".whop.com")
      ) ||
      terms.username ||
      terms.password
    )
      throw new Error();
  } catch {
    failures.push("Card issuance requires applicable HTTPS Whop card terms");
  }
}
if (
  process.env.WHOP_FEE_CHANGES_ENABLED === "true" &&
  !/^biz_[a-zA-Z0-9]+$/.test(process.env.WHOP_PLATFORM_ACCOUNT_ID ?? "")
)
  failures.push(
    "Fee administration requires an explicitly identified platform account",
  );
console.log(
  "\nThis checks configuration presence only. Database migration, credential validity, provider approval, webhook delivery and real integration behavior require separate verification.",
);
if (failures.length) {
  console.log(
    "\nConfiguration is incomplete:\n" +
      failures.map((item) => `- ${item}`).join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    "\nLocal configuration prerequisites are present. Proceed to staging acceptance; no money was moved.",
  );
