// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import LiveCards from "../src/components/live-cards";
const session = {
  businessId: "22222222-2222-4222-8222-222222222222",
  token: "test-token",
  signOut: async () => {},
};
function setup() {
  const fetch = vi.fn(
    async (_url: unknown, options?: RequestInit) =>
      new Response(
        JSON.stringify(
          options?.method === "POST"
            ? { object: "card_application", id: "ciac_test", status: "pending" }
            : {
                data: [],
                issuanceEnabled: true,
                termsUrl: "https://whop.com/us-card-business-terms",
              },
        ),
        { status: options?.method === "POST" ? 202 : 200 },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  render(<LiveCards session={session} />);
  return fetch;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("requires consent and explains that a202 application is not an issued card", async () => {
  const fetch = setup(),
    user = userEvent.setup();
  const button = await screen.findByRole("button", {
    name: "Confirm card request",
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("checkbox"));
  await user.click(button);
  expect(
    await screen.findByText(/Card application: pending. No issued card/),
  ).toBeTruthy();
  const post = fetch.mock.calls.find(
    ([, options]) => options?.method === "POST",
  );
  expect(post).toBeDefined();
  expect(JSON.parse(post![1]!.body as string)).toMatchObject({
    businessId: session.businessId,
    confirmed: true,
    spendLimitCents: 50000,
    frequency: "monthly",
  });
});
it("overprecision fails before submission and leaves input editable", async () => {
  const fetch = setup(),
    user = userEvent.setup();
  const field = await screen.findByLabelText("Monthly spending limit (USD)");
  await user.clear(field);
  await user.type(field, "10.001");
  await user.click(screen.getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: "Confirm card request" }),
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(
    fetch.mock.calls.some(([, options]) => options?.method === "POST"),
  ).toBe(false);
  expect((field as HTMLInputElement).disabled).toBe(false);
});
