import {
  retrieveOrSubmitTransfer,
  applyCompletedTransfer,
  type TransferOperation,
} from "./transfers";
import "server-only";
import { adminDb, HttpError } from "./auth";
import { WhopProductionAdapter } from "./whop";
import { reconcilePayment } from "./payment-reconciliation";
import { type FinancialState } from "@/domain";
import { z } from "zod";
export async function reconcileBusiness(businessId: string) {
  const db = adminDb();
  const { data: business, error: businessError } = await db
    .from("businesses")
    .select("owner_id,whop_account_id")
    .eq("id", businessId)
    .single();
  if (businessError || !business?.whop_account_id)
    throw new HttpError(409, "Connect a verified Whop account first");
  const provider = new WhopProductionAdapter();
  const [{ data: workspace, error }, { data: links, error: linkError }] =
    await Promise.all([
      db
        .from("workspace_states")
        .select("state,revision")
        .eq("business_id", businessId)
        .single(),
      db
        .from("invoice_metadata")
        .select("local_invoice_id,whop_invoice_id")
        .eq("business_id", businessId)
        .not("whop_invoice_id", "is", null),
    ]);
  if (error || linkError || !workspace)
    throw new Error("Workspace unavailable");
  let state = workspace.state as FinancialState;
  for (const link of links ?? []) {
    const current = await provider.retrieveInvoice(link.whop_invoice_id);
    const resource = z
      .object({ id: z.string(), company: z.object({ id: z.string() }) })
      .parse(current);
    if (
      resource.id !== link.whop_invoice_id ||
      resource.company.id !== business.whop_account_id
    )
      throw new Error("Invoice identity differs from connected account");
    const local = state.invoices.find((i) => i.id === link.local_invoice_id);
    if (!local) continue;
    if (typeof current.pay_online_url === "string") {
      const url = new URL(current.pay_online_url);
      if (
        url.protocol === "https:" &&
        (url.hostname === "whop.com" || url.hostname.endsWith(".whop.com"))
      )
        local.paymentUrl = current.pay_online_url;
    }
    if (
      ["open", "past_due"].includes(String(current.status)) &&
      local.status === "draft"
    )
      local.status = "sent";
    if (current.status === "void" && local.paid === 0) local.status = "void";
    const paymentRef = z.object({ id: z.string() }).safeParse(current.payment);
    if (!paymentRef.success) continue;
    state = reconcilePayment(
      state,
      local.id,
      paymentRef.data.id,
      business.whop_account_id,
      await provider.request(
        `/payments/${encodeURIComponent(paymentRef.data.id)}`,
      ),
    );
  }
  const { data: operations, error: payoutError } = await db
    .from("payout_operations")
    .select("*")
    .eq("business_id", businessId);
  if (payoutError) throw payoutError;
  for (const raw of operations ?? []) {
    const operation = raw as TransferOperation;
    const transfer = await retrieveOrSubmitTransfer(provider, operation);
    const saved = await db
      .from("payout_operations")
      .update({
        whop_transfer_id: transfer.id,
        status: transfer.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", operation.id);
    if (saved.error) throw saved.error;
    state = applyCompletedTransfer(state, operation, transfer);
  }
  state.actualSettledBalance = await provider.availableBalance(
    business.whop_account_id,
  );
  state.balanceSyncedAt = new Date().toISOString();
  const committed = await db.rpc("commit_workspace", {
    p_business_id: businessId,
    p_actor: business.owner_id,
    p_expected_revision: workspace.revision,
    p_state: state,
    p_action: "WHOP_RECONCILE",
  });
  if (committed.error)
    throw new HttpError(
      409,
      "Workspace changed during sync; retry reconciliation",
    );
  const snapshot = await db.from("financial_snapshots").insert({
    business_id: businessId,
    available_cents: state.actualSettledBalance,
    currency: "USD",
  });
  if (snapshot.error) throw snapshot.error;
  const syncStatus = await db
    .from("businesses")
    .update({ reconciled_at: state.balanceSyncedAt })
    .eq("id", businessId);
  if (syncStatus.error) throw syncStatus.error;
  return { state, revision: committed.data };
}
