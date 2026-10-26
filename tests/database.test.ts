import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Compatibility harness: real embedded PostgreSQL policy/function execution with
// mocked Supabase auth/storage schemas. This is not hosted Supabase validation.
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
let db: PGlite;
let aliceBusiness: string;
let bobBusiness: string;
async function role<T>(
  name: "authenticated" | "anon" | "service_role",
  user: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role ${name}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    user ?? "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function create(
  actor: string,
  name: string,
  state: unknown = { currency: "USD" },
) {
  return role("service_role", null, async () => {
    const result = await db.query<{ id: string }>(
      "select public.create_workspace($1::uuid,$2,$3::jsonb) as id",
      [actor, name, state === null ? null : JSON.stringify(state)],
    );
    return result.rows[0].id;
  });
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select string_to_array(name, '/') $$;
    grant usage on schema storage to authenticated, service_role;
    grant select on storage.objects to authenticated;
    -- Automatic table grants are disabled in the hosted staging project.
    -- Migrations must explicitly grant every server table privilege.
  `);
  await db.query("insert into auth.users(id) values ($1),($2)", [alice, bob]);
  const migrations = fileURLToPath(
    new URL("../supabase/migrations/", import.meta.url),
  );
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(`${migrations}/${file}`, "utf8").replace(
      /^create extension if not exists pgcrypto;\s*$/m,
      "",
    );
    await db.exec(sql);
  }
  aliceBusiness = await create(alice, "Alice studio");
  bobBusiness = await create(bob, "Bob studio");
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("PostgreSQL migration and authorization compatibility", () => {
  it("creates business, workspace and audit as one transaction", async () => {
    const joined = await db.query(
      "select b.id from public.businesses b join public.workspace_states w on w.business_id=b.id join public.audit_logs a on a.business_id=b.id where b.id=$1 and a.action=$2",
      [aliceBusiness, "WORKSPACE_CREATED"],
    );
    expect(joined.rows).toHaveLength(1);
    await expect(create(alice, "Must roll back", null)).rejects.toThrow();
    const rows = await db.query("select id from businesses where name=$1", [
      "Must roll back",
    ]);
    expect(rows.rows).toHaveLength(0);
  });
  it("limits business and aggregate reads to the authenticated owner", async () => {
    await role("authenticated", alice, async () => {
      const businesses = await db.query<{ id: string }>(
        "select id from businesses",
      );
      expect(businesses.rows.map((r) => r.id)).toEqual([aliceBusiness]);
      expect(
        (
          await db.query(
            "select * from workspace_states where business_id=$1",
            [bobBusiness],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "select * from workspace_states where business_id=$1",
            [aliceBusiness],
          )
        ).rows,
      ).toHaveLength(1);
    });
  });
  it("denies anonymous reads and authenticated direct writes", async () => {
    await role("anon", null, async () => {
      await expect(db.query("select * from businesses")).rejects.toThrow(
        /permission denied/,
      );
    });
    await role("authenticated", alice, async () => {
      await expect(
        db.query(
          "update workspace_states set revision=100 where business_id=$1",
          [aliceBusiness],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("insert into businesses(owner_id,name) values ($1,$2)", [
          alice,
          "Bypass",
        ]),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it("denies direct privileged RPC calls even with a forged actor parameter", async () => {
    await role("authenticated", bob, async () => {
      await expect(
        db.query("select create_workspace($1,$2,$3::jsonb)", [
          alice,
          "Forged",
          "{}",
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select commit_workspace($1,$2,0,$3::jsonb,$4)", [
          aliceBusiness,
          alice,
          "{}",
          "FORGED",
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select check_rate_limit($1)", [alice]),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it("checks actor ownership and optimistic revision inside privileged commit", async () => {
    await role("service_role", null, async () => {
      await expect(
        db.query("select commit_workspace($1,$2,0,$3::jsonb,$4)", [
          aliceBusiness,
          bob,
          "{}",
          "WRONG_ACTOR",
        ]),
      ).rejects.toThrow(/Forbidden/);
      const result = await db.query<{ revision: number }>(
        "select commit_workspace($1,$2,0,$3::jsonb,$4) as revision",
        [aliceBusiness, alice, '{"verified":true}', "TEST_COMMIT"],
      );
      expect(result.rows[0].revision).toBe(1);
      await expect(
        db.query("select commit_workspace($1,$2,0,$3::jsonb,$4)", [
          aliceBusiness,
          alice,
          "{}",
          "STALE_COMMIT",
        ]),
      ).rejects.toThrow(/Revision conflict/);
    });
    const audit = await db.query<{ action: string }>(
      "select action from audit_logs where business_id=$1 order by created_at",
      [aliceBusiness],
    );
    expect(audit.rows.map((r) => r.action)).toEqual([
      "WORKSPACE_CREATED",
      "TEST_COMMIT",
    ]);
    expect(
      (
        await db.query<{ revision: number }>(
          "select revision from workspace_states where business_id=$1",
          [aliceBusiness],
        )
      ).rows[0].revision,
    ).toBe(1);
  });
  it("persists limiter counts and isolates actor quotas", async () => {
    await role("service_role", null, async () => {
      const allowed = await db.query<{ allowed: boolean }>(
        "select check_rate_limit($1) as allowed from generate_series(1,120)",
        [alice],
      );
      expect(allowed.rows.every((r) => r.allowed)).toBe(true);
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select check_rate_limit($1) as allowed",
            [alice],
          )
        ).rows[0].allowed,
      ).toBe(false);
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select check_rate_limit($1) as allowed",
            [bob],
          )
        ).rows[0].allowed,
      ).toBe(true);
    });
    const persisted = await db.query<{ hits: number }>(
      "select hits from rate_limits where actor_id=$1",
      [alice],
    );
    expect(persisted.rows[0].hits).toBe(121);
  });
  it("applies tenant RLS to extension records", async () => {
    await db.query(
      "insert into clients(business_id,context) values ($1,$3::jsonb),($2,$3::jsonb)",
      [aliceBusiness, bobBusiness, "{}"],
    );
    await role("authenticated", alice, async () => {
      const rows = await db.query<{ business_id: string }>(
        "select business_id from clients",
      );
      expect(rows.rows.map((r) => r.business_id)).toEqual([aliceBusiness]);
    });
  });
  it("protects private receipt object paths using the business owner", async () => {
    await db.query(
      "insert into storage.objects(bucket_id,name) values ($1,$2),($1,$3)",
      [
        "receipts",
        `${aliceBusiness}/receipt.pdf`,
        `${bobBusiness}/receipt.pdf`,
      ],
    );
    await role("authenticated", alice, async () => {
      const rows = await db.query<{ name: string }>(
        "select name from storage.objects",
      );
      expect(rows.rows.map((r) => r.name)).toEqual([
        `${aliceBusiness}/receipt.pdf`,
      ]);
    });
  });
});

async function payoutFixture(overrides: Record<string, unknown> = {}) {
  const state = {
    currency: "USD",
    collaborators: [{ id: "maya", name: "Maya" }],
    commitments: [
      {
        id: "crew",
        projectId: "project",
        collaboratorId: "maya",
        kind: "contractor",
        amount: 45000,
        paid: 0,
      },
    ],
    expenses: [],
    ...overrides,
  };
  const business = await create(alice, "Payout fixture", state);
  await db.query("update businesses set whop_account_id=$1 where id=$2", [
    `biz_origin${business.replaceAll("-", "")}`,
    business,
  ]);
  await db.query(
    "insert into collaborator_payout_destinations(business_id,collaborator_id,whop_account_id,verified_name,verified_at,verified_by) values ($1,$2,$3,$4,now(),$5)",
    [business, "maya", "biz_maya", "Maya verified", alice],
  );
  return { business, state };
}
async function prepare(
  business: string,
  actor = alice,
  amount = 45000,
  destination = "biz_maya",
) {
  return role("service_role", null, async () => {
    const result = await db.query<{ id: string }>(
      "select prepare_payout($1,$2,$3,$4,$5) as id",
      [business, actor, "crew", amount, destination],
    );
    return result.rows[0].id;
  });
}
describe("Prepared contractor payout database boundary", () => {
  it("requires authenticated server authority and matching owner, amount and verified recipient", async () => {
    const { business } = await payoutFixture();
    await role("authenticated", alice, async () => {
      await expect(
        db.query("select prepare_payout($1,$2,$3,$4,$5)", [
          business,
          alice,
          "crew",
          45000,
          "biz_maya",
        ]),
      ).rejects.toThrow(/permission denied/);
    });
    await expect(prepare(business, bob)).rejects.toThrow();
    await expect(prepare(business, alice, 44999)).rejects.toThrow();
    await expect(
      prepare(business, alice, 45000, "biz_attacker"),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "select id from payout_operations where business_id=$1",
          [business],
        )
      ).rows,
    ).toHaveLength(0);
    const id = await prepare(business);
    const operation = await db.query<{
      id: string;
      amount_cents: number;
      destination_id: string;
    }>(
      "select id,amount_cents,destination_id from payout_operations where business_id=$1",
      [business],
    );
    expect(operation.rows).toHaveLength(1);
    expect(operation.rows[0].id).toBe(id);
    expect(Number(operation.rows[0].amount_cents)).toBe(45000);
    expect(operation.rows[0].destination_id).toBe("biz_maya");
  });
  it("reuses identical prepared operation and never appends a second confirmation", async () => {
    const { business } = await payoutFixture();
    const first = await prepare(business);
    expect(await prepare(business)).toBe(first);
    expect(
      (
        await db.query(
          "select id from payout_operations where business_id=$1",
          [business],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select id from audit_logs where business_id=$1 and action='PAYOUT_CONFIRMED'",
          [business],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("locks commitment release, edits and expense linkage while a payout exists", async () => {
    const { business, state } = await payoutFixture();
    await prepare(business);
    await role("service_role", null, async () => {
      const released = {
        ...state,
        commitments: [{ ...state.commitments[0], amount: 0 }],
      };
      await expect(
        db.query("select commit_workspace($1,$2,0,$3::jsonb,$4)", [
          business,
          alice,
          JSON.stringify(released),
          "RELEASE_COMMITMENT",
        ]),
      ).rejects.toThrow(/locked/);
      const expense = {
        ...state,
        expenses: [
          { id: "duplicate-cost", commitmentId: "crew", amount: 45000 },
        ],
      };
      await expect(
        db.query("select commit_workspace($1,$2,0,$3::jsonb,$4)", [
          business,
          alice,
          JSON.stringify(expense),
          "ADD_EXPENSE",
        ]),
      ).rejects.toThrow(/expense/);
      const settled = {
        ...state,
        commitments: [{ ...state.commitments[0], paid: 45000 }],
      };
      expect(
        (
          await db.query<{ revision: number }>(
            "select commit_workspace($1,$2,0,$3::jsonb,$4) as revision",
            [business, alice, JSON.stringify(settled), "WHOP_RECONCILE"],
          )
        ).rows[0].revision,
      ).toBe(1);
    });
  });
  it("rejects missing monetary state, unsupported currency and expense-linked commitments", async () => {
    for (const overrides of [
      { currency: "EUR" },
      { currency: null },
      {
        commitments: [
          { id: "crew", collaboratorId: "maya", amount: 45000, paid: 0 },
        ],
      },
      {
        commitments: [
          { id: "crew", collaboratorId: "maya", kind: "contractor", paid: 0 },
        ],
      },
      {
        commitments: [
          {
            id: "crew",
            collaboratorId: "maya",
            kind: "contractor",
            amount: 45000,
            paid: null,
          },
        ],
      },
      { expenses: [{ id: "fuel", commitmentId: "crew", amount: 100 }] },
    ]) {
      const { business } = await payoutFixture(overrides);
      await expect(prepare(business)).rejects.toThrow();
      expect(
        (
          await db.query(
            "select id from payout_operations where business_id=$1",
            [business],
          )
        ).rows,
      ).toHaveLength(0);
    }
  });
  it("keeps destination bindings and outbox rows private and unwritable by browser roles", async () => {
    const { business } = await payoutFixture();
    await prepare(business);
    await role("authenticated", bob, async () => {
      expect(
        (
          await db.query(
            "select id from collaborator_payout_destinations where business_id=$1",
            [business],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "select id from payout_operations where business_id=$1",
            [business],
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          "update collaborator_payout_destinations set whop_account_id=$1 where business_id=$2",
          ["biz_attacker", business],
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("Explicit server privileges with automatic grants disabled", () => {
  it("grants server DML on every owned table without expanding browser permissions", async () => {
    const privileges = await db.query<{ name: string; allowed: boolean }>(`
      select c.relname as name,
        has_table_privilege('service_role', c.oid, 'SELECT') and
        has_table_privilege('service_role', c.oid, 'INSERT') and
        has_table_privilege('service_role', c.oid, 'UPDATE') and
        has_table_privilege('service_role', c.oid, 'DELETE') as allowed
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'
    `);
    expect(privileges.rows).toHaveLength(28);
    expect(privileges.rows.every((row) => row.allowed)).toBe(true);
    await role("service_role", null, async () => {
      const created = await db.query<{ id: string }>(
        "insert into invoice_metadata(business_id,local_invoice_id,operation_key) values($1,'grant-test','grant-test-operation') returning id",
        [aliceBusiness],
      );
      const id = created.rows[0].id;
      await db.query(
        "update invoice_metadata set state='confirmed' where id=$1",
        [id],
      );
      expect(
        (
          await db.query<{ state: string }>(
            "select state from invoice_metadata where id=$1",
            [id],
          )
        ).rows[0].state,
      ).toBe("confirmed");
      await db.query("delete from invoice_metadata where id=$1", [id]);
    });
  });
  it("does not grant access to unrelated future tables", async () => {
    await db.exec("create table public.unrelated_future_table(id integer)");
    try {
      await role("service_role", null, async () => {
        await expect(
          db.query("select * from unrelated_future_table"),
        ).rejects.toThrow(/permission denied/);
      });
    } finally {
      await db.exec("drop table public.unrelated_future_table");
    }
  });
  it("flags a missing individual DML grant even when other permissions remain", async () => {
    await db.exec("revoke update on public.invoice_metadata from service_role");
    try {
      const result = await db.query<{
        result: { checks: Record<string, boolean> };
      }>("select inspect_financial_setup() as result");
      expect(result.rows[0].result.checks.service_table_privileges).toBe(false);
    } finally {
      await db.exec("grant update on public.invoice_metadata to service_role");
    }
  });
});

describe("Operational read-only inspection", () => {
  it("exposes only readiness booleans to the service role", async () => {
    await role("service_role", null, async () => {
      const result = await db.query<{
        result: { contract_version: number; checks: Record<string, boolean> };
      }>("select inspect_financial_setup() as result");
      expect(result.rows[0].result.contract_version).toBe(1);
      expect(Object.values(result.rows[0].result.checks)).toEqual(
        Array(8).fill(true),
      );
    });
    for (const browser of ["anon", "authenticated"] as const) {
      await role(browser, alice, async () => {
        await expect(
          db.query("select inspect_financial_setup()"),
        ).rejects.toThrow(/permission denied/);
      });
    }
  });
  it("detects disabled RLS and excessive privileges without reading customer rows", async () => {
    await db.exec(
      "alter table public.projects disable row level security; grant update on public.projects to authenticated;",
    );
    try {
      const result = await db.query<{
        result: { checks: Record<string, boolean> };
      }>("select inspect_financial_setup() as result");
      expect(result.rows[0].result.checks.table_rls_enabled).toBe(false);
      expect(result.rows[0].result.checks.browser_writes_denied).toBe(false);
    } finally {
      await db.exec(
        "alter table public.projects enable row level security; revoke update on public.projects from authenticated;",
      );
    }
  });
});

describe("Card issuance storage boundaries", () => {
  it("denies browser access and blocks a second unresolved request", async () => {
    for (const table of ["cardholder_bindings", "card_issuance_requests"]) {
      for (const browser of ["anon", "authenticated"] as const) {
        await role(browser, alice, async () => {
          await expect(
            db.query(`select * from public.${table}`),
          ).rejects.toThrow(/permission denied/);
        });
      }
    }
    await role("service_role", null, async () => {
      const first = "20000000-0000-4000-8000-000000000001";
      const second = "20000000-0000-4000-8000-000000000002";
      await db.query(
        "insert into card_issuance_requests(id,business_id,actor_id,request_body,terms_url) values($1,$2,$3,'{}','https://whop.com/test-terms')",
        [first, aliceBusiness, alice],
      );
      await expect(
        db.query(
          "insert into card_issuance_requests(id,business_id,actor_id,request_body,terms_url) values($1,$2,$3,'{}','https://whop.com/test-terms')",
          [second, aliceBusiness, alice],
        ),
      ).rejects.toThrow(/one_unconfirmed_card_request/);
      await db.query(
        "update card_issuance_requests set status='confirmed',result='{}' where id=$1",
        [first],
      );
      await db.query(
        "insert into card_issuance_requests(id,business_id,actor_id,request_body,terms_url) values($1,$2,$3,'{}','https://whop.com/test-terms')",
        [second, aliceBusiness, alice],
      );
    });
  });
});
