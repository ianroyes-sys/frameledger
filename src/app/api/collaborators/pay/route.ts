import { readJson } from "@/server/auth";
import { z } from "zod";
import { authorize, apiError, HttpError, sameOrigin } from "@/server/auth";
import { WhopProductionAdapter } from "@/server/whop";
import {
  retrieveOrSubmitTransfer,
  type TransferOperation,
} from "@/server/transfers";
import { type FinancialState } from "@/domain";
import { reconcileBusiness } from "@/server/reconcile";
const input = z.object({
  businessId: z.uuid(),
  commitmentId: z.string().min(1).max(100),
});
export async function GET(request: Request) {
  try {
    const values = input.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const { db } = await authorize(request, values.businessId);
    const { data: workspace, error } = await db
      .from("workspace_states")
      .select("state")
      .eq("business_id", values.businessId)
      .single();
    if (error) throw error;
    const commitment = (workspace.state as FinancialState).commitments.find(
      (c) => c.id === values.commitmentId,
    );
    if (
      !commitment ||
      commitment.kind !== "contractor" ||
      !commitment.collaboratorId
    )
      throw new HttpError(422, "Contractor commitment required");
    const { data: destination } = await db
      .from("collaborator_payout_destinations")
      .select("whop_account_id,verified_name,verified_at")
      .eq("business_id", values.businessId)
      .eq("collaborator_id", commitment.collaboratorId)
      .single();
    if (!destination)
      throw new HttpError(
        409,
        "Recipient Whop account must be verified and linked by the platform administrator before payment",
      );
    const { data: operation } = await db
      .from("payout_operations")
      .select("id,status,whop_transfer_id")
      .eq("business_id", values.businessId)
      .eq("commitment_id", values.commitmentId)
      .maybeSingle();
    return Response.json(
      {
        amount: commitment.amount - commitment.paid,
        destinationId: destination.whop_account_id,
        recipient: destination.verified_name,
        verifiedAt: destination.verified_at,
        feeDisclosure: process.env.WHOP_TRANSFER_FEE_DISCLOSURE ?? null,
        operation,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (
      process.env.WHOP_PAYOUTS_ENABLED !== "true" ||
      !process.env.WHOP_TRANSFER_FEE_DISCLOSURE
    )
      throw new HttpError(
        409,
        "Live collaborator payouts require platform approval, verified fee disclosures, and completed provider testing",
      );
    const values = input
      .extend({
        confirmed: z.literal(true),
        expectedAmount: z.number().int().positive().max(100000000),
        expectedDestinationId: z.string().regex(/^biz_[a-zA-Z0-9]+$/),
      })
      .strict()
      .parse(await readJson(request));
    const { db, user, business } = await authorize(request, values.businessId);
    const provider = new WhopProductionAdapter();
    if (provider.mode !== "production")
      throw new HttpError(
        409,
        "Whop sandbox payouts are unavailable; no transfer was attempted",
      );
    if (
      !business.whop_account_id ||
      (await provider.availableBalance(business.whop_account_id)) <
        values.expectedAmount
    )
      throw new HttpError(422, "Insufficient settled USD cash for this payout");
    const prepared = await db.rpc("prepare_payout", {
      p_business: values.businessId,
      p_actor: user.id,
      p_commitment: values.commitmentId,
      p_amount: values.expectedAmount,
      p_destination: values.expectedDestinationId,
    });
    if (prepared.error)
      throw new HttpError(
        409,
        "Payout already exists or commitment/verified recipient changed. Refresh before retrying.",
      );
    const { data: operation, error } = await db
      .from("payout_operations")
      .select("*")
      .eq("id", prepared.data)
      .single();
    if (error) throw error;
    const remote = await retrieveOrSubmitTransfer(
      provider,
      operation as TransferOperation,
    );
    const saved = await db
      .from("payout_operations")
      .update({
        whop_transfer_id: remote.id,
        status: remote.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", operation.id);
    if (saved.error)
      throw new HttpError(
        503,
        "Payout submitted; reconciliation will recover status. Do not submit again.",
      );
    const workspace = await reconcileBusiness(values.businessId);
    return Response.json(
      { ...workspace, transferStatus: remote.status, transferId: remote.id },
      { status: remote.status === "succeeded" ? 200 : 202 },
    );
  } catch (e) {
    return apiError(e);
  }
}
