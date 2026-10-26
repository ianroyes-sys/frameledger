import { readJson } from "@/server/auth";
import { z } from "zod";
import { authorize, apiError, HttpError, sameOrigin } from "@/server/auth";
import { WhopProductionAdapter } from "@/server/whop";
import { reducer, type FinancialState } from "@/domain";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = z
      .object({
        businessId: z.uuid(),
        invoiceId: z.string().min(1).max(100),
        confirmed: z.literal(true),
      })
      .parse(await readJson(request));
    const { db, business, user } = await authorize(request, input.businessId);
    if (!business.whop_account_id)
      throw new HttpError(
        409,
        "A verified Whop account must be connected by your platform administrator",
      );
    const { data: workspace, error } = await db
      .from("workspace_states")
      .select("state,revision")
      .eq("business_id", input.businessId)
      .single();
    if (error) throw error;
    const state = workspace.state as FinancialState;
    const invoice = state.invoices.find((i) => i.id === input.invoiceId);
    const project = state.projects.find((p) => p.id === invoice?.projectId);
    const client = state.clients.find((c) => c.id === project?.clientId);
    if (!invoice || !client || invoice.status !== "draft")
      throw new HttpError(422, "A draft invoice and client are required");
    const provider = new WhopProductionAdapter();
    const key = `invoice-${input.businessId}-${invoice.id}`;
    const operation = await db
      .from("invoice_metadata")
      .insert({
        business_id: input.businessId,
        local_invoice_id: invoice.id,
        operation_key: key,
      })
      .select("id")
      .single();
    if (operation.error)
      throw new HttpError(
        409,
        "This invoice already has a send operation. Reconcile its status before retrying.",
      );
    const remote = await provider.createInvoice({
      accountId: business.whop_account_id,
      customerName: client.name,
      email: client.email,
      description: invoice.description,
      amount: invoice.amount,
      dueDate: `${invoice.dueDate}T23:59:59Z`,
      idempotencyKey: key,
    });
    const linked = await db
      .from("invoice_metadata")
      .update({ whop_invoice_id: remote.id, state: "sent" })
      .eq("id", operation.data.id);
    if (linked.error) throw linked.error;
    const next = reducer(state, { type: "SEND_INVOICE", id: invoice.id });
    if (remote.pay_online_url) {
      const url = new URL(remote.pay_online_url);
      if (
        url.protocol === "https:" &&
        (url.hostname === "whop.com" || url.hostname.endsWith(".whop.com"))
      )
        next.invoices.find((i) => i.id === invoice.id)!.paymentUrl =
          remote.pay_online_url;
    }
    const commit = await db.rpc("commit_workspace", {
      p_business_id: input.businessId,
      p_actor: user.id,
      p_expected_revision: workspace.revision,
      p_state: next,
      p_action: "SEND_INVOICE",
    });
    if (commit.error)
      throw new HttpError(
        409,
        "Whop created the invoice; refresh and reconcile before retrying",
      );
    return Response.json({
      state: next,
      revision: commit.data,
      providerInvoiceId: remote.id,
    });
  } catch (e) {
    return apiError(e);
  }
}
