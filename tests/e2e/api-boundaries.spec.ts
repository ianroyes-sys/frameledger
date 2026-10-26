import { test, expect } from "@playwright/test";
test.describe("Unauthenticated API boundaries", () => {
  test("rejects workspace reads and financial mutations without a session", async ({
    request,
  }) => {
    const read = await request.get("/api/workspace");
    expect(read.status()).toBe(401);
    const businessId = "11111111-1111-4111-8111-111111111111";
    const invoice = await request.post("/api/invoices", {
      data: { businessId, invoiceId: "invoice-retainer", confirmed: true },
    });
    expect(invoice.status()).toBe(401);
    const reconcile = await request.post("/api/reconcile", {
      data: { businessId },
    });
    expect(reconcile.status()).toBe(401);
  });
  test("rejects forged cross-origin changes before processing", async ({
    request,
  }) => {
    const response = await request.post("/api/workspace", {
      headers: { Origin: "https://attacker.example" },
      data: {},
    });
    expect(response.status()).toBe(403);
  });
  test("never accepts an unsigned financial webhook", async ({ request }) => {
    const response = await request.post("/api/webhooks/whop", {
      data: { id: "fake", type: "invoice.paid" },
    });
    expect([400, 401, 503]).toContain(response.status());
  });
  test("protects reconciliation scheduler from public invocation", async ({
    request,
  }) => {
    const response = await request.get("/api/cron/reconcile");
    expect([401, 503]).toContain(response.status());
  });
});
