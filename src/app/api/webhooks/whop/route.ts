import { readLimitedBody } from "@/server/body-limit";
import { after } from "next/server";
import { reconcileBusiness } from "@/server/reconcile";
import { verifyWebhook } from "@/server/webhook-signature";
import { adminDb } from "@/server/auth";
export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret)
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 262144)
    return new Response(null, { status: 413 });
  let raw: string;
  try {
    raw = new TextDecoder("utf-8", { fatal: true }).decode(
      await readLimitedBody(request, 262144),
    );
  } catch (error) {
    return new Response(null, {
      status: error instanceof RangeError ? 413 : 400,
    });
  }
  let event;
  try {
    event = verifyWebhook(raw, request.headers, secret);
  } catch {
    return Response.json(
      { error: "Invalid signature or envelope" },
      { status: 401 },
    );
  }
  try {
    const db = adminDb();
    const accountId = event.account_id ?? event.company_id;
    if (!accountId)
      return Response.json({ error: "Account missing" }, { status: 400 });
    const { data: business, error } = await db
      .from("businesses")
      .select("id")
      .eq("whop_account_id", accountId)
      .single();
    if (error || !business)
      return Response.json({ received: true, ignored: true });
    const result = await db.from("webhook_events").insert({
      id: event.id,
      business_id: business.id,
      event_type: event.type,
      resource_id: event.data.id,
      occurred_at: event.timestamp,
    });
    if (result.error && result.error.code !== "23505") throw result.error;
    after(async () => {
      try {
        await reconcileBusiness(business.id);
        await db
          .from("webhook_events")
          .update({ processed_at: new Date().toISOString(), last_error: null })
          .eq("id", event.id);
      } catch {
        await db
          .from("webhook_events")
          .update({
            last_error: "Reconciliation pending; retry worker required",
          })
          .eq("id", event.id);
      }
    });
    return Response.json({ received: true, queued: true });
  } catch {
    return Response.json(
      { error: "Event queue unavailable; retry required" },
      { status: 503 },
    );
  }
}
