import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  cardIssueBody,
  cardIssueInput,
  cardIssueResult,
  cardIssuingEnabled,
  safeCard,
} from "../src/server/cards";
const input = {
  businessId: "22222222-2222-4222-8222-222222222222",
  requestId: "11111111-1111-4111-8111-111111111111",
  name: "Gear",
  spendLimitCents: 50000,
  frequency: "monthly" as const,
  confirmed: true as const,
};
afterEach(() => vi.unstubAllEnvs());
describe("virtual card issuance boundary", () => {
  it("defaults disabled and refuses sandbox issuance", () => {
    vi.stubEnv("WHOP_CARD_ISSUING_ENABLED", "");
    expect(cardIssuingEnabled()).toBe(false);
    vi.stubEnv("WHOP_CARD_ISSUING_ENABLED", "true");
    vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
    vi.stubEnv(
      "WHOP_CARD_TERMS_URL",
      "https://whop.com/us-card-business-terms",
    );
    expect(() => cardIssueBody(input, "biz_owner", "user_holder")).toThrow(
      "disabled",
    );
  });
  it("uses trusted identity and documented dollar limits", () => {
    vi.stubEnv("WHOP_CARD_ISSUING_ENABLED", "true");
    vi.stubEnv("WHOP_ENVIRONMENT", "production");
    vi.stubEnv(
      "WHOP_CARD_TERMS_URL",
      "https://whop.com/us-card-business-terms",
    );
    expect(cardIssueBody(input, "biz_owner", "user_holder")).toEqual({
      account_id: "biz_owner",
      assigned_user_id: "user_holder",
      name: "Gear",
      spend_limit: 500,
      spend_limit_frequency: "monthly",
    });
    expect(() =>
      cardIssueInput.parse({ ...input, assigned_user_id: "user_other" }),
    ).toThrow();
  });
  it("requires explicit confirmation and integer limits", () => {
    expect(() =>
      cardIssueInput.parse({ ...input, confirmed: false }),
    ).toThrow();
    expect(() =>
      cardIssueInput.parse({ ...input, spendLimitCents: 0.5 }),
    ).toThrow();
  });
  it("distinguishes pending application, invitation and provisioning from issuance", () => {
    for (const result of [
      {
        object: "card_application",
        id: "ciac_test",
        status: "pending",
        hosted_url: "https://sensitive.example",
      },
      { object: "card_invitation", invitation_sent: true },
      { object: "card_provisioning", provisioning_job_id: "job_test" },
    ]) {
      const parsed = cardIssueResult.parse(result);
      expect(parsed.object).not.toBe("card");
      expect(parsed).not.toHaveProperty("hosted_url");
    }
  });
  it("strips provider sensitive fields and rejects malformed IDs", () => {
    const card = {
      id: "icrd_test",
      name: "Gear",
      last4: "1234",
      status: "active",
      type: "virtual",
      secrets: { card_number: "sensitive", cvc: "sensitive" },
    };
    expect(safeCard.parse(card)).not.toHaveProperty("secrets");
    expect(() => safeCard.parse({ ...card, id: "other" })).toThrow();
  });
});
