import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  reconcile: vi.fn(),
  verify: vi.fn(),
  after: vi.fn(),
}));
vi.mock("../src/server/auth", () => ({ adminDb: mocks.db }));
vi.mock("../src/server/reconcile", () => ({
  reconcileBusiness: mocks.reconcile,
}));
vi.mock("../src/server/webhook-signature", () => ({
  verifyWebhook: mocks.verify,
}));
vi.mock("next/server", () => ({ after: mocks.after }));
import { POST } from "../src/app/api/webhooks/whop/route";
import { GET } from "../src/app/api/cron/reconcile/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("bounded queue failure handling", () => {
  it("cancels a chunked oversized webhook before reading the remaining body", async () => {
    vi.stubEnv("WHOP_WEBHOOK_SECRET", "synthetic");
    let chunks = 0;
    const cancel = vi.fn();
    const body = new ReadableStream({
      pull(controller) {
        chunks++;
        controller.enqueue(new Uint8Array(65536));
      },
      cancel,
    });
    const request = new Request("http://localhost/api/webhooks/whop", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    expect((await POST(request)).status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunks).toBeLessThanOrEqual(6);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("returns service unavailable when the stale-account query fails", async () => {
    vi.stubEnv("CRON_SECRET", "synthetic");
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(() => chain),
      is: vi.fn(() => chain),
      not: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi
        .fn()
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: "synthetic database failure" },
        }),
    };
    mocks.db.mockReturnValue({ from: () => chain });
    const response = await GET(
      new Request("http://localhost/api/cron/reconcile", {
        headers: { authorization: "Bearer synthetic" },
      }),
    );
    expect(response.status).toBe(503);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});
