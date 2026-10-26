// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFinancialStore } from "../src/components/demo-store";
import { initialState, reducer } from "../src/domain";
const session = {
  token: "test-session",
  businessId: "test-business",
  signOut: async () => {},
};
const snapshot = (revision: number, state = initialState) =>
  new Response(JSON.stringify({ revision, state }), { status: 200 });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe("Live workspace client contract (mocked API)", () => {
  it("shows a failed load without substituting demo money", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Unavailable" }), {
          status: 503,
        }),
      ),
    );
    const { result } = renderHook(() => useFinancialStore(session));
    await waitFor(() =>
      expect(result.current.storageError).toContain("could not be loaded"),
    );
    expect(result.current.ready).toBe(false);
    expect(result.current.state.payments).toEqual([]);
  });
  it("submits authorized command and consumes server revision", async () => {
    const next = reducer(initialState, {
      type: "SET_PROTECTED_RESERVES",
      amount: 1000,
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(snapshot(1))
      .mockResolvedValueOnce(snapshot(2, next));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useFinancialStore(session));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.dispatch({
        type: "SET_PROTECTED_RESERVES",
        amount: 1000,
      });
    });
    expect(result.current.state.protectedReserves).toBe(1000);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({
      revision: 1,
      businessId: "test-business",
      command: { type: "SET_PROTECTED_RESERVES" },
    });
  });
  it("refreshes a conflict without replaying the financial action", async () => {
    const next = reducer(initialState, {
      type: "SET_PROTECTED_RESERVES",
      amount: 2000,
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(snapshot(1))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "Workspace changed. Refresh and retry." }),
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(snapshot(2, next));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useFinancialStore(session));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await expect(
        result.current.dispatch({
          type: "SET_PROTECTED_RESERVES",
          amount: 1000,
        }),
      ).rejects.toThrow("Workspace changed");
    });
    expect(result.current.state.protectedReserves).toBe(2000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("rejects synthetic payment commands in a live session", async () => {
    const fetcher = vi.fn().mockResolvedValue(snapshot(1));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useFinancialStore(session));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await expect(
      result.current.dispatch({ type: "PAY_INVOICE", id: "invoice-final" }),
    ).rejects.toThrow("Demo Mode");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not overwrite a saved change with an older in-flight read", async () => {
    let resolveRead!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveRead = resolve;
    });
    const next = reducer(initialState, {
      type: "SET_PROTECTED_RESERVES",
      amount: 3000,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(snapshot(1))
        .mockReturnValueOnce(pending)
        .mockResolvedValueOnce(snapshot(2, next)),
    );
    const { result } = renderHook(() => useFinancialStore(session));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const refreshing = result.current.refresh();
    await act(async () => {
      await result.current.dispatch({
        type: "SET_PROTECTED_RESERVES",
        amount: 3000,
      });
    });
    await act(async () => {
      resolveRead(snapshot(1));
      await refreshing;
    });
    expect(result.current.state.protectedReserves).toBe(3000);
  });
});
