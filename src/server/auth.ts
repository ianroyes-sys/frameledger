import { readLimitedBody } from "./body-limit";
import "server-only";
import { createClient } from "@supabase/supabase-js";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new HttpError(503, "Workspace service is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function authenticate(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Sign in to continue");
  const db = adminDb();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Session expired");
  const rate = await db.rpc("check_rate_limit", { p_actor: data.user.id });
  if (rate.error) throw new HttpError(503, "Request protection unavailable");
  if (!rate.data)
    throw new HttpError(429, "Too many requests. Retry in one minute.");
  return { db, user: data.user };
}
export async function authorize(request: Request, businessId: string) {
  const session = await authenticate(request);
  const { data, error } = await session.db
    .from("businesses")
    .select("id,owner_id,whop_account_id")
    .eq("id", businessId)
    .eq("owner_id", session.user.id)
    .single();
  if (error || !data) throw new HttpError(403, "Workspace access denied");
  return { ...session, business: data };
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "ZodError")
    return Response.json({ error: "Invalid input" }, { status: 400 });
  return Response.json(
    { error: "Request could not be completed. Please retry." },
    { status: 500 },
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next's production server may rewrite Request.url to its internal hostname.
  // Trust operator configuration, never caller-supplied forwarded headers.
  const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  if (origin && origin !== expected)
    throw new HttpError(403, "Cross-origin request denied");
}

/** Bound JSON before parsing or authorization; never trust Content-Length. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    const bytes = await readLimitedBody(request, 65536);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof RangeError)
      throw new HttpError(413, "Request body exceeds limit");
    throw new HttpError(400, "Invalid JSON request body");
  }
}
