import "server-only";
import { z } from "zod";
import { minor, positive } from "@/domain";
export const WHOP_VERSION = "2026-06-09";
export function decimalToMinor(value: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(value))
    throw new Error("Invalid provider decimal");
  const neg = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  if (fraction.slice(2).replace(/0/g, ""))
    throw new Error("Sub-cent balance cannot be represented safely");
  return minor(
    Number(
      (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2))) *
        (neg ? -1n : 1n),
    ),
  );
}
export const invoiceInput = z.object({
  accountId: z.string().regex(/^biz_[a-zA-Z0-9]+$/),
  customerName: z.string().min(1).max(150),
  email: z.email(),
  description: z.string().min(1).max(500),
  amount: z.number().int().positive().max(100000000),
  dueDate: z.iso.datetime(),
  idempotencyKey: z.string().min(10).max(128),
});
export interface FinancialProvider {
  mode: "sandbox" | "production" | "mock";
  availableBalance(accountId: string): Promise<number>;
  createInvoice(
    input: z.infer<typeof invoiceInput>,
  ): Promise<{ id: string; status: string; pay_online_url?: string | null }>;
  retrieveInvoice(id: string): Promise<Record<string, unknown>>;
}
export class WhopProductionAdapter implements FinancialProvider {
  readonly mode: "sandbox" | "production";
  private key: string;
  private base: string;
  constructor() {
    this.mode =
      process.env.WHOP_ENVIRONMENT === "production" ? "production" : "sandbox";
    this.key = process.env.WHOP_API_KEY ?? "";
    if (!this.key) throw new Error("Whop is not configured");
    this.base =
      this.mode === "production"
        ? "https://api.whop.com/api/v1"
        : "https://sandbox-api.whop.com/api/v1";
  }
  async request(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
  ): Promise<unknown> {
    const response = await fetch(this.base + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Api-Version-Date": WHOP_VERSION,
        "Content-Type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw new Error(
        `Whop request failed (${response.status}); no local financial change confirmed`,
      );
    return response.json();
  }
  async availableBalance(accountId: string) {
    const account = z
      .object({
        balances: z.array(
          z.object({
            symbol: z.string(),
            breakdown: z.object({ available: z.string() }),
          }),
        ),
      })
      .parse(await this.request(`/accounts/${encodeURIComponent(accountId)}`));
    return account.balances
      .filter((b) => b.symbol.toUpperCase() === "USD")
      .reduce((n, b) => minor(n + decimalToMinor(b.breakdown.available)), 0);
  }
  async createInvoice(raw: z.infer<typeof invoiceInput>) {
    const i = invoiceInput.parse(raw);
    positive(i.amount);
    return z
      .object({
        id: z.string(),
        status: z.string(),
        pay_online_url: z.url().nullable().optional(),
      })
      .parse(
        await this.request(
          "/invoices",
          "POST",
          {
            account_id: i.accountId,
            collection_method: "send_invoice",
            customer_name: i.customerName,
            email_address: i.email,
            due_date: i.dueDate,
            save_as_draft: false,
            charge_buyer_fee: false,
            product: { title: i.description },
            plan: {
              currency: "usd",
              plan_type: "one_time",
              initial_price: i.amount / 100,
            },
            line_items: [
              { label: i.description, quantity: 1, unit_price: i.amount / 100 },
            ],
          },
          i.idempotencyKey,
        ),
      );
  }
  async retrieveInvoice(id: string) {
    return z
      .record(z.string(), z.unknown())
      .parse(await this.request(`/invoices/${encodeURIComponent(id)}`));
  }
}
export class MockFinancialAdapter implements FinancialProvider {
  readonly mode = "mock" as const;
  async availableBalance() {
    return 160000;
  }
  async createInvoice(i: z.infer<typeof invoiceInput>) {
    invoiceInput.parse(i);
    return { id: `demo_${i.idempotencyKey}`, status: "open" };
  }
  async retrieveInvoice(id: string) {
    return { id, status: "open", demo: true };
  }
}
