import { readJson } from "@/server/auth";
import { z } from "zod";
import { authorize, apiError, HttpError, sameOrigin } from "@/server/auth";
import { WhopProductionAdapter } from "@/server/whop";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { businessId } = z
      .object({ businessId: z.uuid(), purpose: z.literal("verification") })
      .strict()
      .parse(await readJson(request));
    const { db, business, user } = await authorize(request, businessId);
    if (!business.whop_account_id)
      throw new HttpError(409, "Connect a Whop account before verification");
    const provider = new WhopProductionAdapter();
    if (provider.mode !== "production")
      throw new HttpError(
        409,
        "Whop Elements sandbox is not available. No identity data will be collected.",
      );
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const result = z
      .object({ token: z.string(), expires_at: z.string() })
      .parse(
        await provider.request("/access_tokens", "POST", {
          account_id: business.whop_account_id,
          expires_at: expiresAt,
          scoped_actions: ["identity:read", "identity:write"],
        }),
      );
    const audit = await db.from("audit_logs").insert({
      business_id: businessId,
      actor_id: user.id,
      action: "VERIFICATION_TOKEN_CREATED",
    });
    if (audit.error) throw audit.error;
    return Response.json(
      { ...result, accountId: business.whop_account_id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
