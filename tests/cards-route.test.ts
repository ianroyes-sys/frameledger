import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), request: vi.fn() }));
vi.mock("../src/server/auth", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  authorize: mocks.authorize,
}));
vi.mock("../src/server/whop", () => ({
  WhopProductionAdapter: class {
    request = mocks.request;
  },
}));
import { POST } from "../src/app/api/cards/route";
const input = {
  businessId: "22222222-2222-4222-8222-222222222222",
  requestId: "11111111-1111-4111-8111-111111111111",
  name: "Gear",
  spendLimitCents: 50000,
  frequency: "monthly",
  confirmed: true,
};
const issued = {
  object: "card",
  id: "icrd_new",
  name: "Gear",
  last4: "1234",
  type: "virtual",
  status: "active",
  secrets: { cvc: "never-return" },
};
function req(body: unknown = input) {
  return new Request("https://app.test/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function setup(existing: unknown = null, reserveError = false) {
  const db = {
    from: vi.fn((table: string) => {
      const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        single: vi.fn(async () => ({
          data: { whop_user_id: "user_holder", whop_account_id: "biz_owner" },
          error: null,
        })),
        maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
        insert: vi.fn(async () => ({
          error: table === "card_issuance_requests" && reserveError ? {} : null,
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      };
      return q;
    }),
  };
  mocks.authorize.mockResolvedValue({
    business: { whop_account_id: "biz_owner" },
    user: { id: "owner" },
    db,
  });
  return db;
}
beforeEach(() => {
  vi.stubEnv("WHOP_CARD_ISSUING_ENABLED", "true");
  vi.stubEnv("WHOP_ENVIRONMENT", "production");
  vi.stubEnv("WHOP_CARD_TERMS_URL", "https://whop.com/us-card-business-terms");
  mocks.request.mockResolvedValue(issued);
  setup();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("sends only trusted cardholder IDs and stable idempotency key; strips secrets", async () => {
  const response = await POST(req());
  expect(response.status).toBe(201);
  expect(await response.json()).not.toHaveProperty("secrets");
  expect(mocks.request).toHaveBeenCalledWith(
    "/cards",
    "POST",
    {
      account_id: "biz_owner",
      assigned_user_id: "user_holder",
      name: "Gear",
      spend_limit: 500,
      spend_limit_frequency: "monthly",
    },
    `card-${input.requestId}`,
  );
});
it("does not treat an application as an issued card", async () => {
  mocks.request.mockResolvedValue({
    object: "card_application",
    id: "ciac_new",
    status: "pending",
  });
  expect((await POST(req())).status).toBe(202);
});
it("unknown persisted operation never sends another request", async () => {
  setup({
    business_id: input.businessId,
    request_body: {
      account_id: "biz_owner",
      assigned_user_id: "user_holder",
      name: "Gear",
      spend_limit: 500,
      spend_limit_frequency: "monthly",
    },
    status: "unconfirmed",
  });
  expect((await POST(req())).status).toBe(409);
  expect(mocks.request).not.toHaveBeenCalled();
});
it("concurrent reservation conflict cannot issue twice", async () => {
  setup(null, true);
  expect((await POST(req())).status).toBe(409);
  expect(mocks.request).not.toHaveBeenCalled();
});
it("disabled or unconfirmed requests cannot reach provider", async () => {
  vi.stubEnv("WHOP_CARD_ISSUING_ENABLED", "");
  expect((await POST(req())).status).toBe(409);
  expect((await POST(req({ ...input, confirmed: false }))).status).toBe(400);
  expect(mocks.request).not.toHaveBeenCalled();
});
it("cross-origin request fails before authorization", async () => {
  const request = req();
  request.headers.set("origin", "https://attacker.test");
  expect((await POST(request)).status).toBe(403);
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
});
