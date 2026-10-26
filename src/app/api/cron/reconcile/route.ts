import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/server/auth";
import { reconcileBusiness } from "@/server/reconcile";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return new Response(null, { status: 401 });
  try {
    const db = adminDb();
    const { data: events, error } = await db
      .from("webhook_events")
      .select("id,business_id")
      .is("processed_at", null)
      .order("received_at")
      .limit(50);
    if (error) throw error;
    const ids = [
      ...new Set((events ?? []).map((e) => e.business_id).filter(Boolean)),
    ];
    const { data: stale, error: staleError } = await db
      .from("businesses")
      .select("id")
      .not("whop_account_id", "is", null)
      .order("reconciled_at", { ascending: true, nullsFirst: true })
      .limit(50);
    if (staleError) throw staleError;
    for (const b of stale ?? []) if (!ids.includes(b.id)) ids.push(b.id);
    let synced = 0,
      failed = 0;
    for (const id of ids) {
      try {
        await reconcileBusiness(id);
        const result = await db
          .from("webhook_events")
          .update({ processed_at: new Date().toISOString(), last_error: null })
          .in(
            "id",
            (events ?? []).filter((e) => e.business_id === id).map((e) => e.id),
          );
        if (result.error) throw result.error;
        synced++;
      } catch {
        failed++;
      }
    }
    return Response.json({ synced, failed }, { status: failed ? 503 : 200 });
  } catch {
    return Response.json(
      { error: "Reconciliation unavailable" },
      { status: 503 },
    );
  }
}
