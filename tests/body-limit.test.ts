import { describe, expect, it } from "vitest";
import { readLimitedBody } from "../src/server/body-limit";
describe("Upload body limit", () => {
  it("accepts a bounded body", async () => {
    expect(
      new TextDecoder().decode(
        await readLimitedBody(
          new Request("http://localhost", { method: "POST", body: "receipt" }),
          7,
        ),
      ),
    ).toBe("receipt");
  });
  it("rejects an oversized body without trusting content-length", async () => {
    await expect(
      readLimitedBody(
        new Request("http://localhost", {
          method: "POST",
          body: "toolarge",
          headers: { "Content-Length": "1" },
        }),
        4,
      ),
    ).rejects.toThrow("limit");
  });
});
