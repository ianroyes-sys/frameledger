/** Read-only hosted/local verification. No credentials, URLs, provider errors or rows are logged. */
import { pathToFileURL } from "node:url";

const expectedChecks = [
  "required_tables",
  "table_rls_enabled",
  "browser_writes_denied",
  "privileged_functions_restricted",
  "private_receipt_bucket",
  "receipt_read_policy",
  "tenant_read_policies",
  "service_table_privileges",
];

export function validateConfiguration(env) {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  if (names.some((name) => !env[name]?.trim()))
    throw new Error(
      "Missing Supabase configuration. Supply the three documented Supabase environment variables.",
    );
  const publicKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY.trim();
  if (publicKey === serviceKey || publicKey.startsWith("sb_secret_"))
    throw new Error(
      "Public and server credentials must be distinct and correctly scoped.",
    );
  for (const [key, role] of [
    [publicKey, "anon"],
    [serviceKey, "service_role"],
  ]) {
    if (key.split(".").length !== 3) continue;
    let payload;
    try {
      payload = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
      );
    } catch {
      throw new Error("Malformed legacy API key.");
    }
    // Parsing is a local misconfiguration check, not signature verification.
    if (payload.role !== role)
      throw new Error("Legacy API key has the wrong role.");
  }
  if (serviceKey.startsWith("sb_publishable_"))
    throw new Error("Server credential must not be a publishable key.");
  let url;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw new Error("Invalid Supabase URL.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !(local
      ? ["http:", "https:"].includes(url.protocol)
      : url.protocol === "https:" &&
        /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) &&
        !url.port)
  ) {
    throw new Error(
      "Use an HTTPS project.supabase.co origin or local development origin. Custom domains require a separately reviewed verifier.",
    );
  }
  return { origin: url.origin, publicKey, serviceKey };
}

function headers(key) {
  // Publishable/secret keys belong in apikey, not an Authorization JWT.
  return {
    apikey: key,
    ...(key.split(".").length === 3 ? { Authorization: `Bearer ${key}` } : {}),
  };
}

export async function verifySupabase(env, request = fetch) {
  const { origin, publicKey, serviceKey } = validateConfiguration(env);
  const results = [];
  async function read(path, key) {
    // Redirects cannot forward privileged headers to a different origin.
    return request(`${origin}${path}`, {
      method: "GET",
      headers: headers(key),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  }
  const auth = await read("/auth/v1/settings", publicKey);
  results.push({ check: "public_key_auth_endpoint", pass: auth.ok });
  const inspection = await read(
    "/rest/v1/rpc/inspect_financial_setup",
    serviceKey,
  );
  if (!inspection.ok) {
    results.push({ check: "server_key_and_readiness_migration", pass: false });
  } else {
    let body;
    try {
      body = await inspection.json();
    } catch {
      body = null;
    }
    results.push({
      check: "readiness_contract",
      pass: body?.contract_version === 1,
    });
    for (const check of expectedChecks)
      results.push({ check, pass: body?.checks?.[check] === true });
  }
  // limit=0 means even an accidentally exposed table returns no customer rows.
  const anonymous = await read(
    "/rest/v1/businesses?select=id&limit=0",
    publicKey,
  );
  results.push({
    check: "anonymous_business_read_denied",
    pass: [401, 403].includes(anonymous.status),
  });
  const rpcAnonymous = await read(
    "/rest/v1/rpc/inspect_financial_setup",
    publicKey,
  );
  results.push({
    check: "anonymous_inspection_denied",
    pass: [401, 403, 404].includes(rpcAnonymous.status),
  });
  return results;
}

/** @param {string[]} args @param {Record<string, string | undefined>} env */
export async function main(args = process.argv.slice(2), env = process.env) {
  if (args.length !== 1 || args[0] !== "--allow-network") {
    console.error(
      "No requests sent. Explicitly run with --allow-network to perform read-only Supabase checks.",
    );
    return 1;
  }
  try {
    const results = await verifySupabase(env);
    for (const { check, pass } of results)
      console.log(`${pass ? "PASS" : "FAIL"} ${check}`);
    console.log(
      "Checks inspect configuration metadata only. They do not prove email delivery, cross-tenant behavior, backups, or Whop payment operation. No data was changed.",
    );
    return results.every((result) => result.pass) ? 0 : 1;
  } catch {
    // Network/client exceptions may contain URLs or keys: never print raw errors.
    console.error(
      "Verification could not complete. Check configuration, network access and migration deployment locally. No credential values or server response bodies are logged.",
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
