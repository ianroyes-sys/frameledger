import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
const envelope = z.object({
  id: z.string(),
  type: z.string(),
  api_version: z.literal("v1"),
  api_version_date: z.string().optional(),
  timestamp: z.iso.datetime(),
  company_id: z.string().optional(),
  account_id: z.string().optional(),
  data: z.object({ id: z.string() }).passthrough(),
});
export function verifyWebhook(
  raw: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
) {
  if (!secret) throw new Error("Webhook signing secret unavailable");
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sig = headers.get("webhook-signature");
  if (
    !id ||
    !ts ||
    !/^\d+$/.test(ts) ||
    !sig ||
    Math.abs(now / 1000 - Number(ts)) > 300
  )
    throw new Error("Invalid webhook headers or timestamp");
  const expected = createHmac("sha256", secret)
    .update(`${id}.${ts}.${raw}`)
    .digest();
  const valid = sig.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const actual = Buffer.from(value, "base64");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  });
  if (!valid) throw new Error("Invalid webhook signature");
  const event = envelope.parse(JSON.parse(raw));
  if (event.id !== id) throw new Error("Webhook ID mismatch");
  return event;
}
