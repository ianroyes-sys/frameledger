/** Explicit, allowlisted upload to this app's already-linked evaluation project. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const linked = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
for (const name of ["STAGING_VERCEL_PROJECT_ID", "STAGING_VERCEL_ORG_ID", "STAGING_VERCEL_SCOPE", "STAGING_APP_ORIGIN"])
  if (!process.env[name]) throw new Error(`Missing ${name}`);
if (
  linked.projectId !== process.env.STAGING_VERCEL_PROJECT_ID ||
  linked.orgId !== process.env.STAGING_VERCEL_ORG_ID
)
  throw new Error("Unexpected deployment project");
const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
];
const values = {
  FRAMELEDGER_MODE: "production",
  APP_ORIGIN: process.env.STAGING_APP_ORIGIN,
  NEXT_PUBLIC_APP_STAGE: "staging",
  WHOP_ENVIRONMENT: "sandbox",
  WHOP_PAYOUTS_ENABLED: "false",
  WHOP_CARD_ISSUING_ENABLED: "false",
  WHOP_FEE_CHANGES_ENABLED: "false",
};
for (const name of names) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  values[name] = process.env[name];
}
for (const [name, value] of Object.entries(values)) {
  const secret = name === "SUPABASE_SERVICE_ROLE_KEY" || name === "CRON_SECRET";
  const result = spawnSync(
    "vercel",
    [
      "env",
      "add",
      name,
      "production",
      "--force",
      "--yes",
      ...(secret ? ["--sensitive"] : []),
      "--scope",
      process.env.STAGING_VERCEL_SCOPE,
    ],
    { input: value, encoding: "utf8", timeout: 60000 },
  );
  if (result.status !== 0) {
    console.error(
      `FAILED ${name}; provider output withheld to protect credentials`,
    );
    process.exit(1);
  }
  console.log(`CONFIGURED ${name}`);
}
