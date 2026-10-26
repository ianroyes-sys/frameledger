// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth }) }));
import LiveGate from "../src/components/live-gate";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public-key");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const mount = () =>
  render(
    <LiveGate>{(s) => <p>Authenticated workspace {s.businessId}</p>}</LiveGate>,
  );
describe("Supabase sign-in boundary (mocked provider)", () => {
  it("accepts an existing valid shorter password instead of imposing signup rules at login", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ businesses: [{ id: "owned-business" }] }),
          ),
        ),
    );
    mount();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "creator@example.com");
    await user.type(screen.getByLabelText("Password"), "valid8pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(
        screen.getByText("Authenticated workspace owned-business"),
      ).toBeTruthy(),
    );
  });
  it("does not present auth success when backend workspace loading fails", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Workspace unavailable" }), {
          status: 503,
        }),
      ),
    );
    mount();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "creator@example.com");
    await user.type(screen.getByLabelText("Password"), "long-test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Workspace unavailable",
      ),
    );
    expect(screen.queryByText(/Authenticated workspace/)).toBeNull();
  });
  it("keeps email confirmation separate from workspace activation", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    mount();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Create a new account" }),
    );
    await user.type(screen.getByLabelText("Email"), "creator@example.com");
    await user.type(screen.getByLabelText("Password"), "long-test-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Check your email",
      ),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
