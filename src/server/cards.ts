import "server-only";
import { z } from "zod";
import { HttpError } from "./auth";
export const safeCard = z.object({
  id: z.string().regex(/^icrd_[a-zA-Z0-9]+$/),
  name: z.string().nullable(),
  last4: z.string().nullable(),
  status: z.string().nullable(),
  type: z.string().nullable(),
  limit: z
    .object({
      amount: z.number().finite().nonnegative(),
      frequency: z.string(),
    })
    .nullable()
    .optional(),
});
export const cardIssueInput = z
  .object({
    businessId: z.uuid(),
    requestId: z.uuid(),
    name: z.string().trim().min(1).max(80),
    spendLimitCents: z.number().int().positive().max(100000000),
    frequency: z.enum(["daily", "weekly", "monthly", "one_time"]),
    confirmed: z.literal(true),
  })
  .strict();
export const cardIssueResult = z.discriminatedUnion("object", [
  safeCard.extend({ object: z.literal("card") }),
  z.object({
    object: z.literal("card_application"),
    id: z.string().regex(/^ciac_/),
    status: z.enum([
      "approved",
      "pending",
      "manual_review",
      "denied",
      "locked",
      "canceled",
      "needs_verification",
      "needs_information",
    ]),
  }),
  z.object({
    object: z.literal("card_provisioning"),
    provisioning_job_id: z.string(),
  }),
  z.object({
    object: z.literal("card_invitation"),
    invitation_sent: z.boolean(),
  }),
]);
export function cardIssuingEnabled() {
  return (
    process.env.WHOP_CARD_ISSUING_ENABLED === "true" &&
    process.env.WHOP_ENVIRONMENT === "production" &&
    validCardTermsUrl(process.env.WHOP_CARD_TERMS_URL)
  );
}
export function cardIssueBody(
  input: z.infer<typeof cardIssueInput>,
  accountId: string,
  assignedUserId: string,
) {
  if (!cardIssuingEnabled())
    throw new HttpError(
      409,
      "Card issuing is disabled pending provider approval and disclosure setup",
    );
  z.string()
    .regex(/^biz_[a-zA-Z0-9]+$/)
    .parse(accountId);
  z.string()
    .regex(/^user_[a-zA-Z0-9]+$/)
    .parse(assignedUserId);
  return {
    account_id: accountId,
    assigned_user_id: assignedUserId,
    name: input.name,
    spend_limit: input.spendLimitCents / 100,
    spend_limit_frequency: input.frequency,
  };
}

function validCardTermsUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return (
      url.protocol === "https:" &&
      (url.hostname === "whop.com" || url.hostname.endsWith(".whop.com")) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
