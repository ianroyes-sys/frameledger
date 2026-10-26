import { z } from "zod";
import { reducer, type FinancialState } from "@/domain";
import { decimalToMinor } from "./whop";

const amount = z.object({ amount: z.string(), currency: z.literal("usd") });
const identity = z.object({
  id: z.string(),
  account_id: z.string().nullable(),
  status: z.string(),
  substatus: z.string().optional(),
});
const paidPayment = identity.extend({
  total: amount,
  amount_after_fees: amount,
  refunded_amount: amount.nullable(),
});

/** Reconcile current provider truth; webhook order never determines money state. */
export function reconcilePayment(
  state: FinancialState,
  invoiceId: string,
  paymentId: string,
  accountId: string,
  raw: unknown,
): FinancialState {
  const reference = identity.parse(raw);
  if (reference.id !== paymentId || reference.account_id !== accountId)
    throw new Error("Payment identity differs from connected invoice account");
  if (["dispute_lost", "resolution_lost"].includes(reference.substatus ?? ""))
    throw new Error(
      "Payment loss requires verified ledger reconciliation and operator review",
    );
  // Unpaid payments can legitimately have a null total. Do not attempt to
  // parse paid-only money fields or allocate pending/failed income.
  if (reference.status !== "paid") {
    if (state.payments.some((p) => p.id === `whop-payment-${paymentId}`))
      throw new Error(
        "Previously collected payment changed state; operator review required",
      );
    return state;
  }
  const payment = paidPayment.parse(raw);
  const local = state.invoices.find((i) => i.id === invoiceId);
  if (!local) throw new Error("Invoice not found");
  const gross = decimalToMinor(payment.total.amount);
  const net = decimalToMinor(payment.amount_after_fees.amount);
  const refunded = payment.refunded_amount
    ? decimalToMinor(payment.refunded_amount.amount)
    : 0;
  if (gross !== local.amount)
    throw new Error("Invoice total mismatch requires review");
  if (gross <= 0 || net < 0 || net > gross || refunded < 0 || refunded > gross)
    throw new Error("Provider payment amounts require review");
  const eventId = `whop-payment-${payment.id}`;
  let next = structuredClone(state);
  if (!next.processedEvents.includes(eventId)) {
    if (local.status === "draft")
      next = reducer(next, { type: "SEND_INVOICE", id: local.id });
    next = reducer(next, {
      type: "PAY_INVOICE",
      id: local.id,
      amount: gross,
      eventId,
    });
  }
  const saved = next.payments.find((p) => p.id === eventId);
  if (!saved || saved.invoiceId !== invoiceId || saved.amount !== gross)
    throw new Error("Stored payment differs from invoice; review required");
  // A smaller cumulative refund is never treated as fresh income. Preserve
  // recorded refunds across temporarily older provider reads.
  const fee = gross - net;
  if (saved.fee !== fee) {
    const project = next.projects.find((p) => p.id === local.projectId);
    if (project?.status === "completed") project.status = "active";
  }
  saved.fee = fee;
  if (refunded > saved.refunded)
    next = reducer(next, {
      type: "REFUND_PAYMENT",
      id: saved.id,
      amount: refunded - saved.refunded,
      eventId: `whop-refund-${payment.id}-${refunded}`,
    });
  return next;
}
