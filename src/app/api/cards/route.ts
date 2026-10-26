import { readJson } from "@/server/auth";
import { z } from "zod";
import { authorize, apiError, HttpError, sameOrigin } from "@/server/auth";
import { WhopProductionAdapter } from "@/server/whop";
import {
  safeCard as card,
  cardIssueInput,
  cardIssueResult,
  cardIssueBody,
  cardIssuingEnabled,
} from "@/server/cards";
export async function GET(request: Request) {
  try {
    const businessId = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("businessId"));
    const { business } = await authorize(request, businessId);
    if (!business.whop_account_id)
      throw new HttpError(409, "Connect a verified Whop account");
    const provider = new WhopProductionAdapter();
    const result = z
      .object({ data: z.array(card) })
      .parse(
        await provider.request(
          `/cards?account_id=${encodeURIComponent(business.whop_account_id)}`,
        ),
      );
    return Response.json(
      {
        ...result,
        issuanceEnabled: cardIssuingEnabled(),
        termsUrl: process.env.WHOP_CARD_TERMS_URL ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const input = z
      .object({
        businessId: z.uuid(),
        cardId: z.string().regex(/^icrd_[a-zA-Z0-9]+$/),
        action: z.enum(["freeze", "unfreeze", "cancel"]),
        confirmed: z.literal(true),
      })
      .strict()
      .parse(await readJson(request));
    const { db, business, user } = await authorize(request, input.businessId);
    if (!business.whop_account_id)
      throw new HttpError(409, "Connect a verified Whop account");
    const provider = new WhopProductionAdapter();
    const owned = z
      .object({ data: z.array(card) })
      .parse(
        await provider.request(
          `/cards?account_id=${encodeURIComponent(business.whop_account_id)}`,
        ),
      );
    if (!owned.data.some((c) => c.id === input.cardId))
      throw new HttpError(403, "Card is not in this workspace");
    const audit = await db.from("audit_logs").insert({
      business_id: input.businessId,
      actor_id: user.id,
      action: `CARD_${input.action.toUpperCase()}_REQUESTED`,
      resource_id: input.cardId,
    });
    if (audit.error) throw audit.error;
    const result = card.parse(
      await provider.request(
        `/cards/${encodeURIComponent(input.cardId)}`,
        "PATCH",
        input.action === "cancel"
          ? { account_id: business.whop_account_id, canceled: true }
          : {
              account_id: business.whop_account_id,
              frozen: input.action === "freeze",
            },
      ),
    );
    if (result.id !== input.cardId)
      throw new HttpError(
        502,
        "Provider returned an unexpected card. Refresh before another change.",
      );
    const completedAudit = await db.from("audit_logs").insert({
      business_id: input.businessId,
      actor_id: user.id,
      action: `CARD_${input.action.toUpperCase()}_PROVIDER_CONFIRMED`,
      resource_id: input.cardId,
    });
    if (completedAudit.error)
      throw new HttpError(
        503,
        "Provider processed the card request, but its audit record needs repair. Refresh cards before another change.",
      );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = cardIssueInput.parse(await readJson(request));
    const { db, business, user } = await authorize(request, input.businessId);
    if (!business.whop_account_id)
      throw new HttpError(409, "Connect a verified Whop account");
    const binding = await db
      .from("cardholder_bindings")
      .select("whop_user_id,whop_account_id")
      .eq("business_id", input.businessId)
      .single();
    if (
      binding.error ||
      binding.data?.whop_account_id !== business.whop_account_id
    )
      throw new HttpError(409, "A verified cardholder binding is required");
    const body = cardIssueBody(
      input,
      business.whop_account_id,
      binding.data.whop_user_id,
    );
    const existing = await db
      .from("card_issuance_requests")
      .select("business_id,request_body,status,result")
      .eq("id", input.requestId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const previous = existing.data;
      if (
        previous.business_id !== input.businessId ||
        Object.entries(body).some(([k, v]) => previous.request_body[k] !== v)
      )
        throw new HttpError(
          409,
          "Card request does not match the original confirmation",
        );
      if (previous.status !== "confirmed")
        throw new HttpError(
          409,
          "Card request outcome is unconfirmed. Contact support before requesting another card.",
        );
      return Response.json(cardIssueResult.parse(previous.result), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const reservation = await db.from("card_issuance_requests").insert({
      id: input.requestId,
      business_id: input.businessId,
      actor_id: user.id,
      request_body: body,
      terms_url: process.env.WHOP_CARD_TERMS_URL,
    });
    if (reservation.error)
      throw new HttpError(
        409,
        "An existing card request needs review. Refresh cards or contact support.",
      );
    const audit = await db.from("audit_logs").insert({
      business_id: input.businessId,
      actor_id: user.id,
      action: "CARD_ISSUANCE_USER_CONFIRMED",
      resource_id: input.requestId,
    });
    if (audit.error) throw audit.error;
    const provider = new WhopProductionAdapter();
    const result = cardIssueResult.parse(
      await provider.request("/cards", "POST", body, `card-${input.requestId}`),
    );
    const saved = await db
      .from("card_issuance_requests")
      .update({ status: "confirmed", result })
      .eq("id", input.requestId);
    if (saved.error)
      throw new HttpError(
        503,
        "Card request outcome needs reconciliation. Contact support before requesting another card.",
      );
    return Response.json(result, {
      status: result.object === "card" ? 201 : 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
