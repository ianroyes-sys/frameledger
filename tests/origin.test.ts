import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { sameOrigin } from "../src/server/auth";

describe("configured application origin", () => {
  it("accepts the configured public origin behind a rewritten server URL", () => {
    vi.stubEnv("APP_ORIGIN", "https://workspace.example.com");
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3212/api/workspace", {
          headers: { origin: "https://workspace.example.com" },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3212/api/workspace", {
          headers: {
            origin: "https://attacker.example.com",
            "x-forwarded-host": "workspace.example.com",
          },
        }),
      ),
    ).toThrow();
    vi.unstubAllEnvs();
  });
});
