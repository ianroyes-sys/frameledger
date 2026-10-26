/** Synthetic staging acceptance only. Never prints credentials, records or provider errors. */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { validateConfiguration } from "./verify-supabase.mjs";

const results = {};
const users = [];
const businessIds = new Set();
let admin;
let stage = "configuration";
const app = process.argv.includes("--vercel-staging")
  ? process.env.STAGING_APP_ORIGIN
  : "http://127.0.0.1:3212";
function check(label, condition) {
  results[label] = Boolean(condition);
  if (!condition) throw new Error("Acceptance check failed");
}
function ok(result) {
  if (result.error) throw new Error("Provider operation failed");
  return result.data;
}
async function api(token, method, path, body, origin = app) {
  return fetch(`${app}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Origin: origin,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
}
try {
  check(
    "explicit_staging_write_permission",
    process.argv.includes("--allow-staging-write"),
  );
  validateConfiguration(process.env);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  check(
    "expected_staging_project",
    Boolean(process.env.STAGING_SUPABASE_URL) &&
      new URL(url).origin === new URL(process.env.STAGING_SUPABASE_URL).origin,
  );
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
  const anonymous = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    options,
  );
  const actors = [];
  stage = "synthetic_auth";
  for (let i = 0; i < 2; i++) {
    const email = `staging-acceptance-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa!9`;
    const created = ok(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { synthetic_acceptance: true },
      }),
    );
    users.push(created.user.id);
    const db = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      options,
    );
    const session = ok(await db.auth.signInWithPassword({ email, password }));
    actors.push({ db, token: session.session.access_token });
  }
  check("two_synthetic_users_authenticated_without_email", actors.length === 2);
  const [owner, stranger] = actors;
  stage = "workspace_creation";
  for (const actor of actors) {
    const response = await api(actor.token, "PUT", "/api/workspace", {
      name: "Synthetic staging acceptance — delete after test",
    });
    results[`workspace_http_status_${actors.indexOf(actor) + 1}`] =
      response.status;
    check(
      `workspace_created_${actors.indexOf(actor) + 1}`,
      response.status === 201,
    );
    actor.workspace = await response.json();
    businessIds.add(actor.workspace.businessId);
  }
  const id = owner.workspace.businessId;
  let revision = owner.workspace.revision;
  const clientId = randomUUID(),
    projectId = randomUUID(),
    expenseId = randomUUID();
  async function command(value) {
    const response = await api(owner.token, "POST", "/api/workspace", {
      businessId: id,
      revision,
      command: value,
    });
    if (response.status !== 200) throw new Error("Workspace command failed");
    const snapshot = await response.json();
    revision = snapshot.revision;
    return snapshot;
  }
  stage = "context_persistence";
  await command({
    type: "CREATE_CLIENT",
    client: {
      id: clientId,
      name: "Synthetic client",
      email: "synthetic@example.com",
    },
  });
  await command({
    type: "CREATE_PROJECT",
    project: {
      id: projectId,
      clientId,
      name: "Synthetic wedding",
      type: "Wedding",
      date: "2026-10-01",
      value: 320000,
      status: "active",
    },
  });
  await command({
    type: "ADD_EXPENSE",
    expense: {
      id: expenseId,
      merchant: "Synthetic fuel",
      amount: 6700,
      category: "Travel",
      date: "2026-09-28",
      projectId,
    },
  });
  await command({ type: "SET_ALLOCATIONS", taxBps: 2500, gearBps: 1000 });
  const persistedResponse = await api(
    owner.token,
    "GET",
    `/api/workspace?businessId=${id}`,
  );
  check("workspace_read_success", persistedResponse.status === 200);
  const persisted = await persistedResponse.json();
  check(
    "project_expense_and_allocations_persisted",
    persisted.revision === revision &&
      persisted.state.taxBps === 2500 &&
      persisted.state.gearBps === 1000 &&
      persisted.state.actualSettledBalance === 0 &&
      persisted.state.projects.some((p) => p.id === projectId) &&
      persisted.state.expenses.some(
        (e) => e.id === expenseId && e.projectId === projectId,
      ),
  );
  stage = "tenant_and_write_isolation";
  check(
    "cross_tenant_api_denied",
    (await api(stranger.token, "GET", `/api/workspace?businessId=${id}`))
      .status === 403,
  );
  check(
    "anonymous_api_denied",
    (await api(null, "GET", `/api/workspace?businessId=${id}`)).status === 401,
  );
  check(
    "cross_origin_mutation_denied",
    (
      await api(
        owner.token,
        "POST",
        "/api/workspace",
        {
          businessId: id,
          revision,
          command: { type: "SET_PROTECTED_RESERVES", amount: 1 },
        },
        "https://untrusted.example",
      )
    ).status === 403,
  );
  check(
    "stale_revision_denied",
    (
      await api(owner.token, "POST", "/api/workspace", {
        businessId: id,
        revision: 0,
        command: { type: "SET_PROTECTED_RESERVES", amount: 1 },
      })
    ).status === 409,
  );
  const ownRead = ok(
    await owner.db
      .from("workspace_states")
      .select("business_id")
      .eq("business_id", id),
  );
  check("owner_direct_rls_read", ownRead.length === 1);
  const otherRead = await stranger.db
    .from("workspace_states")
    .select("business_id")
    .eq("business_id", id);
  check(
    "cross_tenant_rls_hidden",
    !otherRead.error && otherRead.data.length === 0,
  );
  const anonymousRead = await anonymous
    .from("workspace_states")
    .select("business_id")
    .eq("business_id", id);
  check(
    "anonymous_rows_hidden",
    Boolean(anonymousRead.error) || anonymousRead.data.length === 0,
  );
  const protectedRow = { business_id: id, state: persisted.state, revision };
  check(
    "anonymous_direct_write_denied",
    Boolean(
      (await anonymous.from("workspace_states").upsert(protectedRow)).error,
    ),
  );
  check(
    "authenticated_direct_write_denied",
    Boolean(
      (await owner.db.from("workspace_states").upsert(protectedRow)).error,
    ),
  );
  check(
    "browser_privileged_rpc_denied",
    Boolean(
      (
        await owner.db.rpc("commit_workspace", {
          p_business_id: id,
          p_actor: users[0],
          p_expected_revision: revision,
          p_state: persisted.state,
          p_action: "SYNTHETIC_DENIED",
        })
      ).error,
    ),
  );
  stage = "private_receipt_storage";
  const form = new FormData();
  form.set("expenseId", expenseId);
  form.set(
    "file",
    new Blob(["%PDF-1.4\n% Synthetic acceptance fixture\n%%EOF"], {
      type: "application/pdf",
    }),
    "synthetic.pdf",
  );
  const upload = await api(
    owner.token,
    "POST",
    `/api/receipts?businessId=${id}`,
    form,
  );
  check("receipt_uploaded_through_server", upload.status === 201);
  const { receiptId } = await upload.json();
  const receipt = ok(
    await admin
      .from("receipts")
      .select("storage_path")
      .eq("id", receiptId)
      .eq("business_id", id)
      .single(),
  );
  check(
    "owner_receipt_download",
    !(await owner.db.storage.from("receipts").download(receipt.storage_path))
      .error,
  );
  check(
    "other_tenant_receipt_denied",
    Boolean(
      (
        await stranger.db.storage
          .from("receipts")
          .download(receipt.storage_path)
      ).error,
    ),
  );
  check(
    "anonymous_receipt_denied",
    Boolean(
      (await anonymous.storage.from("receipts").download(receipt.storage_path))
        .error,
    ),
  );
  const signed = await api(
    owner.token,
    "GET",
    `/api/receipts?businessId=${id}&receiptId=${receiptId}`,
  );
  check(
    "authorized_signed_receipt_url",
    signed.status === 200 && typeof (await signed.json()).url === "string",
  );
  check(
    "cross_tenant_signed_url_denied",
    (
      await api(
        stranger.token,
        "GET",
        `/api/receipts?businessId=${id}&receiptId=${receiptId}`,
      )
    ).status === 403,
  );
  check(
    "anonymous_storage_upload_denied",
    Boolean(
      (
        await anonymous.storage
          .from("receipts")
          .upload(
            `${id}/anonymous-denied.pdf`,
            new Blob(["%PDF-1.4"], { type: "application/pdf" }),
          )
      ).error,
    ),
  );
  stage = "complete";
} catch {
  results.acceptance_passed = false;
  results.failed_stage = stage;
  process.exitCode = 1;
} finally {
  if (admin && users.length) {
    try {
      // Recover only workspaces owned by the users created in THIS invocation.
      const owned = ok(
        await admin.from("businesses").select("id").in("owner_id", users),
      );
      for (const row of owned) businessIds.add(row.id);
      for (const id of businessIds) {
        const files = ok(await admin.storage.from("receipts").list(id));
        if (files.length)
          ok(
            await admin.storage
              .from("receipts")
              .remove(files.map((f) => `${id}/${f.name}`)),
          );
        for (const table of ["receipts", "audit_logs"])
          ok(await admin.from(table).delete().eq("business_id", id));
        ok(
          await admin
            .from("businesses")
            .delete()
            .eq("id", id)
            .in("owner_id", users),
        );
      }
      ok(await admin.from("rate_limits").delete().in("actor_id", users));
      for (const id of users) ok(await admin.auth.admin.deleteUser(id));
      results.synthetic_records_removed = true;
    } catch {
      results.synthetic_records_removed = false;
      process.exitCode = 1;
    }
  }
  results.acceptance_passed =
    stage === "complete" && results.synthetic_records_removed === true;
  console.log(JSON.stringify(results, null, 2));
}
