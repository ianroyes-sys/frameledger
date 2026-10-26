import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { apiError, readJson } from "../src/server/auth";
it("returns 413 for oversized JSON and 400 for malformed or invalid UTF-8", async () => {
  for (const [body, status] of [
    ["x".repeat(65537), 413],
    ["{broken", 400],
    [new Uint8Array([0xff]), 400],
  ] as const) {
    try {
      await readJson(new Request("http://localhost", { method: "POST", body }));
      throw new Error("Expected rejection");
    } catch (error) {
      expect(apiError(error).status).toBe(status);
    }
  }
});
it("accepts ordinary bounded JSON", async () => {
  expect(
    await readJson(
      new Request("http://localhost", {
        method: "POST",
        body: '{"confirmed":true}',
      }),
    ),
  ).toEqual({ confirmed: true });
});
