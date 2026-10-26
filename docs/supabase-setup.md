# Supabase setup and acceptance

Updated 2026-09-28. The application has migrations and local PostgreSQL security tests. **Hosted staging is now provisioned and two-user acceptance passed.** Project credentials are now configured locally; Supabase CLI and Docker remain unavailable. Local configuration is prepared; full local Supabase startup remains unexecuted.

## 1. Choose isolated environments

Create a dedicated staging project in the intended organization's Supabase dashboard. Use a separate project for production. Do not reuse unrelated application's database or keys. Keep region, retention and capacity choices aligned with the operating entity's requirements. Project creation/paid plan selection is an account-owner operation.

Copy the project URL and public and server keys into uncommitted `.env.local` or the deployment environment's secret manager. The existing application variable names are retained:

| Variable                        | Purpose                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project API origin                                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key or legacy anon key; visible to the browser              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server secret key or legacy service_role key; never browser-visible     |
| `FRAMELEDGER_MODE`              | `production` for authenticated storage, even while testing Whop sandbox |

Supabase recommends publishable/secret keys for new applications. Legacy names above are compatibility labels, not a requirement to generate old JWT keys. Never put the server key in a `NEXT_PUBLIC_` variable. See [official API key guidance](https://supabase.com/docs/guides/api/api-keys).

## 2. Install and apply migrations

Use the official [Supabase CLI installation instructions](https://supabase.com/docs/guides/local-development/cli/getting-started), pinning the chosen CLI version in your development environment. These commands are **instructions, not evidence of execution**. From the repository directory:

```sh
supabase login
supabase link --project-ref YOUR_STAGING_PROJECT_REF
supabase migration list
supabase db push --dry-run
supabase db push
supabase migration list
```

Check the target project before the push. Apply every migration in filename order, including `202609280004_readiness.sql`. Do not run `db reset --linked`; resets destroy data. Follow [official migration guidance](https://supabase.com/docs/guides/deployment/database-migrations). Before updating an existing environment, preserve backup and rollback evidence and investigate any migration-history mismatch.

The migrations create tenant-scoped context, server-only financial commands, audit records, webhook processing records, payout outbox, verified payout destinations and a private receipt bucket. They deliberately deny direct browser writes: mutations must pass server authorization and validation.

### Optional local full-stack setup

`supabase/config.toml` is supplied for a local Docker-compatible runtime:

```sh
supabase start
```

It uses API port 54321, database 54322, Studio 54323 and mail testing 54324; application auth points to `http://127.0.0.1:3210`. Local signup requires email confirmation. Inspect local confirmation mail in the local mail tool. Do not assume this TOML configures the hosted project's authentication, SMTP, backups or regions. `supabase start` may show local keys in your terminal: do not paste that output in chat, commits or shared logs.

## 3. Configure authentication and delivery

In the hosted project's Auth settings:

- Set the exact staging HTTPS origin as Site URL and allow only required redirect URLs. Set production separately. Avoid broad production wildcard redirects.
- Enable email confirmation and an appropriate password policy (the product signup requires at least 12 characters).
- Configure and verify custom SMTP delivery before inviting customers; verify sender domain and bounce handling.
- Verify sign-up, confirmation and return-to-sign-in. Current sessions are in memory and refresh requires signing in again. Password recovery, account deletion and enhanced authentication remain separate launch work; a Supabase checkbox does not implement the corresponding app screens.
- Verify rate limits with the expected invitation volume.

Sources: [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 4. Run credential-safe checks

Local-only presence check:

```sh
npm run check:setup
```

Explicit read-only service check (does **not** provision or modify anything):

```sh
node --env-file-if-exists=.env.local scripts/verify-supabase.mjs --allow-network
```

The verifier defaults to no network unless explicitly invoked with the flag. It accepts official HTTPS `project.supabase.co` origins or local development origins, refuses redirects, never logs keys/URLs/customer rows/provider error bodies, and sends only GET requests. Custom API domains require a reviewed adjustment to the allowlist; do not bypass destination checks casually.

It checks:

- Public credential access to Auth settings.
- Server credential access to a read-only, service-only inspection function.
- Required tables and RLS, browser write restrictions, privileged function restrictions, expected tenant policy presence and private receipt bucket configuration.
- Anonymous business reads and inspection are denied. The business probe uses `limit=0` even if the database is accidentally exposed.

An all-pass result proves these checks against the configured service at that moment. It **does not** prove policy expressions are correct, Auth email is delivered, two real users are isolated, backups restore, or Whop works. The inspection reports booleans only and cannot expose financial rows. It checks configuration presence, not an exhaustive database-security audit. [Supabase function security guidance](https://supabase.com/docs/guides/database/functions) explains function privileges and the importance of restricting execution.

## 5. Hosted acceptance evidence

Use two synthetic staging users A and B with separate workspaces. Record outcomes without personal information:

1. A creates a project and invoice draft; B cannot read or mutate them, including attempts with A's business ID.
2. Anonymous requests and expired tokens receive errors without data. Direct browser writes to tables and privileged RPCs fail.
3. A uploads a small permitted receipt. B cannot read it; a public object URL does not work. Invalid types and oversized files fail. Inspect signed-URL expiry if using a signed delivery flow.
4. Concurrent revisions conflict instead of overwriting each other. Sensitive server actions create audits.
5. A signs out, B signs in, and no prior workspace remains visible. Confirm refresh/login behavior is acceptable.
6. Restore a staging backup into an isolated environment and reconcile against provider data before considering recovery complete. Database backups alone do not back up Storage object content; include a separate receipt-object backup strategy. [Supabase backup guidance](https://supabase.com/docs/guides/platform/backups).

Do not mark the database operational until these hosted tests and operational recovery steps pass. The local PGlite suite executes actual PostgreSQL policy/function logic with simulated Auth/Storage schemas; it is valuable evidence but not hosted Supabase acceptance.

## 6. Financial provider mapping

Supabase stores creator context and external IDs; Whop remains the source of actual balances and financial events. Connect business and collaborator account IDs only after verified ownership/recipient review. Do not enable browser-editable payout destinations. Account association, signing secrets, approved scopes, capabilities, reconciliation and money-operation verification are covered by [operational launch](operational-launch.md) and [Whop capabilities](whop-capabilities.md).

## Current evidence

- Prepared: local Supabase config, five ordered migrations, read-only hosted checker and exact setup instructions.
- Verified locally: migration execution, tenant isolation and read-only inspection permissions through embedded PostgreSQL; verifier rejects unsafe destinations and redacts exceptions.
- Not executed: full Docker/Supabase startup, hosted migration push, hosted credential check, real Auth emails, hosted storage isolation, backup restore.
- Required input: dedicated Supabase project and its three credentials, supplied privately to `.env.local`/deployment settings. No secrets should be pasted into conversation. The project and credentials above have now been provisioned; remaining operational gates are tracked in the provisioning record.

## Executed update

The earlier procedural checklist describes setup work and limitations. Current outcome: five migrations deployed, twelve read-only hosted checks passed, real two-user database/app/receipt acceptance passed and synthetic test records removed. Migration history includes full SQL. SMTP delivery and backup restoration remain untested.
