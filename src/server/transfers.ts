import { z } from "zod";
import { decimalToMinor, WhopProductionAdapter } from "./whop";
import { type FinancialState } from "@/domain";
export const transferSchema = z.object({
  id: z.string(),
  object: z.literal("transfer"),
  amount: z.number(),
  currency: z.literal("usd"),
  origin: z.object({ id: z.string() }),
  destination: z.object({ id: z.string() }),
  status: z.enum(["processing", "succeeded", "failed"]),
  fee_amount: z.number().nullable().optional(),
});
export type Transfer = z.infer<typeof transferSchema>;
export type TransferOperation = {
  id: string;
  business_id: string;
  commitment_id: string;
  origin_id: string;
  destination_id: string;
  amount_cents: number;
  operation_key: string;
  whop_transfer_id: string | null;
  created_at: string;
  status: string;
};
export function verifyTransfer(
  transfer: Transfer,
  operation: TransferOperation,
) {
  if (
    (operation.whop_transfer_id !== null &&
      transfer.id !== operation.whop_transfer_id) ||
    transfer.origin.id !== operation.origin_id ||
    transfer.destination.id !== operation.destination_id ||
    decimalToMinor(String(transfer.amount)) !== operation.amount_cents
  )
    throw new Error("Transfer differs from confirmed payout");
  return transfer;
}
export async function retrieveOrSubmitTransfer(
  provider: WhopProductionAdapter,
  operation: TransferOperation,
) {
  if (operation.whop_transfer_id)
    return verifyTransfer(
      transferSchema.parse(
        await provider.request(
          `/transfers/${encodeURIComponent(operation.whop_transfer_id)}`,
        ),
      ),
      operation,
    );
  if (
    provider.mode !== "production" ||
    process.env.WHOP_PAYOUTS_ENABLED !== "true"
  )
    throw new Error("Confirmed payout delivery is disabled");
  if (Date.now() - new Date(operation.created_at).getTime() > 23 * 3600000)
    throw new Error(
      "Payout outcome requires operator verification; retry window expired",
    );
  return verifyTransfer(
    transferSchema.parse(
      await provider.request(
        "/transfers",
        "POST",
        {
          origin_id: operation.origin_id,
          destination_id: operation.destination_id,
          amount: operation.amount_cents / 100,
          currency: "usd",
          type: "ledger",
          idempotence_key: operation.operation_key,
          metadata: { frameledger_operation: operation.id },
        },
        operation.operation_key,
      ),
    ),
    operation,
  );
}
export function applyCompletedTransfer(
  state: FinancialState,
  operation: TransferOperation,
  transfer: Transfer,
): FinancialState {
  verifyTransfer(transfer, operation);
  if (transfer.status !== "succeeded") return state;
  const eventId = `whop-transfer-${transfer.id}`;
  if (state.processedEvents.includes(eventId)) return state;
  const next = structuredClone(state);
  const commitment = next.commitments.find(
    (c) => c.id === operation.commitment_id,
  );
  if (
    !commitment ||
    commitment.amount - commitment.paid !== operation.amount_cents
  )
    throw new Error(
      "Commitment changed during payout; operator review required",
    );
  commitment.paid += operation.amount_cents;
  next.processedEvents.push(eventId);
  const fee = transfer.fee_amount
    ? decimalToMinor(String(transfer.fee_amount))
    : 0;
  if (fee < 0) throw new Error("Unexpected negative payout fee");
  if (fee)
    next.expenses.push({
      id: `transfer-fee-${transfer.id}`,
      merchant: "Whop transfer fee",
      amount: fee,
      category: "Payment Fees",
      date: new Date().toISOString().slice(0, 10),
      projectId: commitment.projectId,
      settledExternally: true,
    });
  return next;
}
