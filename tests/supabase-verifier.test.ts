import { describe, expect, it, vi } from "vitest";
import {
  main,
  validateConfiguration,
  verifySupabase,
} from "../scripts/verify-supabase.mjs";

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://exampleproject.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_synthetic",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic",
};
const checks = Object.fromEntries(
  [
    "required_tables",
    "table_rls_enabled",
    "browser_writes_denied",
    "privileged_functions_restricted",
    "private_receipt_bucket",
    "receipt_read_policy",
    "tenant_read_policies",
    "service_table_privileges",
  ].map((name) => [name, true]),
);
function responses(overrides = {}) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(
      Response.json({
        contract_version: 1,
        checks: { ...checks, ...overrides },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
}

describe("Read-only Supabase verifier", () => {
  it("refuses credential-forwarding destinations and mismatched credential configuration", () => {
    for (const url of [
      "https://evil.example",
      "https://exampleproject.supabase.co.evil.example",
      "https://key@exampleproject.supabase.co",
      "https://exampleproject.supabase.co/path",
      "http://exampleproject.supabase.co",
    ]) {
      expect(() =>
        validateConfiguration({
          ...environment,
          NEXT_PUBLIC_SUPABASE_URL: url,
        }),
      ).toThrow();
    }
    expect(() =>
      validateConfiguration({
        ...environment,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: environment.SUPABASE_SERVICE_ROLE_KEY,
      }),
    ).toThrow();
    expect(() =>
      validateConfiguration({
        ...environment,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`,
      }),
    ).toThrow();
    expect(() => validateConfiguration({})).toThrow();
    expect(
      validateConfiguration({
        ...environment,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }).origin,
    ).toBe("http://127.0.0.1:54321");
  });
  it("only sends nonredirecting GETs and retrieves no financial/customer records", async () => {
    const request = responses();
    expect(
      (await verifySupabase(environment, request)).every(
        (result) => result.pass,
      ),
    ).toBe(true);
    expect(request).toHaveBeenCalledTimes(4);
    for (const [, options] of request.mock.calls) {
      expect(options?.method).toBe("GET");
      expect(options?.redirect).toBe("error");
      expect(options?.body).toBeUndefined();
      expect(options?.headers).not.toHaveProperty("Authorization");
    }
    expect(request.mock.calls[2][0]).toContain("select=id&limit=0");
  });
  it("fails when security metadata is false or anonymous table access succeeds", async () => {
    const request = responses({ table_rls_enabled: false });
    expect(
      (await verifySupabase(environment, request)).find(
        (result) => result.check === "table_rls_enabled",
      )?.pass,
    ).toBe(false);
    const exposed = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({ contract_version: 1, checks }))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({}));
    const results = await verifySupabase(environment, exposed);
    expect(
      results.filter((result) => !result.pass).map((result) => result.check),
    ).toEqual([
      "anonymous_business_read_denied",
      "anonymous_inspection_denied",
    ]);
  });
  it("requires explicit network invocation and redacts all exception content", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("sb_secret_synthetic PRIVATE_CUSTOMER"));
    try {
      expect(await main([], environment)).toBe(1);
      expect(request).not.toHaveBeenCalled();
      expect(await main(["--allow-network"], environment)).toBe(1);
      expect(log.mock.calls.flat().join(" ")).not.toMatch(
        /sb_secret_synthetic|PRIVATE_CUSTOMER/,
      );
    } finally {
      log.mockRestore();
      request.mockRestore();
    }
  });
});
