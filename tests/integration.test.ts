import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import { WhopProductionAdapter, decimalToMinor } from "../src/server/whop";
import { commandSchema } from "../src/server/validation";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("provider boundaries", () => {
  it("fails closed without credentials", () => {
    vi.stubEnv("WHOP_API_KEY", "");
    expect(() => new WhopProductionAdapter()).toThrow("not configured");
  });
  it("defaults to sandbox and pins version with no browser key", async () => {
    vi.stubEnv("WHOP_API_KEY", "synthetic-test-key");
    vi.stubEnv("WHOP_ENVIRONMENT", "");
    const mock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          balances: [{ symbol: "USD", breakdown: { available: "16.01" } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mock);
    expect(await new WhopProductionAdapter().availableBalance("biz_test")).toBe(
      1601,
    );
    expect(mock.mock.calls[0][0]).toBe(
      "https://sandbox-api.whop.com/api/v1/accounts/biz_test",
    );
    expect(mock.mock.calls[0][1].headers["Api-Version-Date"]).toBe(
      "2026-06-09",
    );
  });
  it("does not count stablecoins as USD cash", async () => {
    vi.stubEnv("WHOP_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            balances: [{ symbol: "USDT", breakdown: { available: "4000" } }],
          }),
        ),
      ),
    );
    expect(await new WhopProductionAdapter().availableBalance("biz_test")).toBe(
      0,
    );
  });
  it("rejects malformed money, nonUSD and uncertain subcents", () => {
    expect(decimalToMinor("-14.25")).toBe(-1425);
    expect(decimalToMinor("10.0000")).toBe(1000);
    expect(() => decimalToMinor("1.001")).toThrow();
    expect(() => decimalToMinor("NaN")).toThrow();
  });
  it("financial mutations cannot be submitted through general context endpoint", () => {
    for (const type of [
      "PAY_INVOICE",
      "REFUND_PAYMENT",
      "PAY_COMMITMENT",
      "RESET",
    ])
      expect(commandSchema.safeParse({ type, id: "x" }).success).toBe(false);
  });
  it("provider failures propagate without fabricated success", async () => {
    vi.stubEnv("WHOP_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("no", { status: 503 })),
    );
    await expect(
      new WhopProductionAdapter().availableBalance("biz_test"),
    ).rejects.toThrow("503");
  });
  it("rejects cross-tenant invalid references at schema boundary", () => {
    expect(
      commandSchema.safeParse({
        type: "CREATE_PROJECT",
        project: {
          id: "x",
          clientId: "c",
          name: "N",
          type: "Wedding",
          date: "not-date",
          value: -1,
          status: "active",
        },
      }).success,
    ).toBe(false);
  });
});
