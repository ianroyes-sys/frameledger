import { z } from "zod";
import { safeToSpend, type FinancialState } from "./index";
const id = z.string().min(1).max(100);
const text = z.string().max(2000);
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const signedCents = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const fields = {
  version: z.literal(1),
  currency: z.literal("USD"),
  openingBalance: signedCents,
  actualSettledBalance: signedCents.optional(),
  balanceSyncedAt: z.iso.datetime().optional(),
  taxBps: z.number().int().min(0).max(10000),
  gearBps: z.number().int().min(0).max(10000),
  protectedReserves: cents,
  projects: z.array(
    z.object({
      id,
      name: text,
      clientId: id,
      type: text,
      date: z.iso.date(),
      value: cents,
      status: z.enum(["active", "completed"]),
    }),
  ),
  clients: z.array(
    z.object({ id, name: text, email: text, company: text.optional() }),
  ),
  invoices: z.array(
    z.object({
      id,
      projectId: id,
      number: text,
      description: text,
      amount: cents,
      paid: cents,
      dueDate: z.iso.date(),
      paymentUrl: z
        .url()
        .refine((value) => {
          const u = new URL(value);
          return (
            u.protocol === "https:" &&
            (u.hostname === "whop.com" || u.hostname.endsWith(".whop.com"))
          );
        })
        .optional(),
      status: z.enum(["draft", "sent", "partial", "paid", "void"]),
    }),
  ),
  expenses: z.array(
    z.object({
      id,
      merchant: text,
      amount: cents,
      category: text,
      date: z.iso.date(),
      projectId: id.optional(),
      commitmentId: id.optional(),
      settledExternally: z.boolean().optional(),
      receipt: text.optional(),
    }),
  ),
  commitments: z.array(
    z.object({
      id,
      projectId: id,
      collaboratorId: id.optional(),
      description: text,
      amount: cents,
      paid: cents,
      kind: z.enum(["contractor", "travel", "other"]),
    }),
  ),
  collaborators: z.array(
    z.object({ id, name: text, role: text, email: text, taxStatus: text }),
  ),
  payments: z.array(
    z.object({
      id,
      invoiceId: id,
      amount: cents,
      tax: cents,
      gear: cents,
      refunded: cents,
      fee: cents,
    }),
  ),
  processedEvents: z.array(id),
};
export const financialStateSchema = z
  .object(fields)
  .superRefine((state, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (state.taxBps + state.gearBps > 10000)
      invalid("Allocation exceeds 100%");
    for (const list of [
      state.projects,
      state.clients,
      state.invoices,
      state.expenses,
      state.commitments,
      state.collaborators,
      state.payments,
    ])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        invalid("Duplicate resource IDs");
    for (const invoice of state.invoices)
      if (invoice.paid > invoice.amount) invalid("Invoice overpayment");
    for (const commitment of state.commitments)
      if (commitment.paid > commitment.amount)
        invalid("Commitment overpayment");
    for (const payment of state.payments)
      if (
        payment.refunded > payment.amount ||
        payment.tax + payment.gear > payment.amount - payment.refunded
      )
        invalid("Invalid payment allocation");
    try {
      safeToSpend(state);
    } catch {
      invalid("Cash calculation exceeds supported range");
    }
  });
export function parseFinancialState(input: unknown): FinancialState {
  return financialStateSchema.parse(input);
}
export const workspaceSnapshotSchema = z.object({
  state: financialStateSchema,
  revision: z.number().int().nonnegative(),
});
