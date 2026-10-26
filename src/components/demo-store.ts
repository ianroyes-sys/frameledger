"use client";
import { useEffect, useRef, useState } from "react";
import {
  initialState,
  reducer,
  type Action,
  type FinancialState,
} from "@/domain";
import {
  parseFinancialState,
  workspaceSnapshotSchema,
} from "@/domain/state-schema";
import type { LiveSession } from "./live-gate";
export const STORAGE_KEY = "frameledger-demo-v1";
const emptyState: FinancialState = {
  ...initialState,
  projects: [],
  clients: [],
  invoices: [],
  expenses: [],
  commitments: [],
  collaborators: [],
  payments: [],
  processedEvents: [],
};
export function useFinancialStore(liveSession?: LiveSession) {
  const [state, setState] = useState<FinancialState>(
    liveSession ? emptyState : initialState,
  );
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState("");
  const revision = useRef(-1),
    stateRef = useRef(state),
    inFlight = useRef(false);
  const token = liveSession?.token,
    businessId = liveSession?.businessId;
  function acceptSnapshot(raw: unknown) {
    const snapshot = workspaceSnapshotSchema.parse(raw);
    if (snapshot.revision < revision.current) return stateRef.current;
    revision.current = snapshot.revision;
    stateRef.current = snapshot.state;
    setState(snapshot.state);
    setReady(true);
    setStorageError("");
    return snapshot.state;
  }
  useEffect(() => {
    let cancelled = false;
    if (token && businessId) {
      fetch(`/api/workspace?businessId=${encodeURIComponent(businessId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error ?? "Unable to load your workspace.");
          const snapshot = workspaceSnapshotSchema.parse(data);
          if (!cancelled && snapshot.revision >= revision.current) {
            revision.current = snapshot.revision;
            stateRef.current = snapshot.state;
            setState(snapshot.state);
            setStorageError("");
            setReady(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStorageError(
              "Your workspace could not be loaded or verified. Check your connection and retry.",
            );
            setReady(false);
          }
        });
    } else {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = parseFinancialState(JSON.parse(raw));
            stateRef.current = data;
            setState(data);
          }
        } catch {
          setStorageError(
            "Saved demo data could not be loaded. Your current session is usable; reset demo data in Settings if the saved records are damaged.",
          );
        }
        setReady(true);
      });
    }
    const onStorage = (event: StorageEvent) => {
      if (token || event.key !== STORAGE_KEY) return;
      try {
        const data = event.newValue
          ? parseFinancialState(JSON.parse(event.newValue))
          : structuredClone(initialState);
        stateRef.current = data;
        setState(data);
        setStorageError("");
      } catch {
        setStorageError(
          "A change from another tab could not be verified. Your last valid records are still displayed. Reset damaged demo data in Settings.",
        );
      }
    };
    if (!token) window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [token, businessId]);
  async function refresh() {
    if (!token || !businessId) return;
    const response = await fetch(
      `/api/workspace?businessId=${encodeURIComponent(businessId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error ?? "Workspace refresh failed.");
    acceptSnapshot(data);
  }
  async function dispatch(action: Action): Promise<FinancialState> {
    if (inFlight.current)
      throw new Error("A change is still saving. Please wait.");
    inFlight.current = true;
    try {
      if (token && businessId) {
        if (
          ["PAY_INVOICE", "PAY_COMMITMENT", "REFUND_PAYMENT", "RESET"].includes(
            action.type,
          )
        )
          throw new Error("This simulation is available only in Demo Mode.");
        const invoiceAction = action.type === "SEND_INVOICE";
        let response: Response;
        try {
          response = await fetch(
            invoiceAction ? "/api/invoices" : "/api/workspace",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(
                invoiceAction
                  ? { businessId, invoiceId: action.id, confirmed: true }
                  : { businessId, revision: revision.current, command: action },
              ),
            },
          );
        } catch {
          throw new Error(
            "The save could not be confirmed. Check your connection and refresh before retrying.",
          );
        }
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 409) {
            try {
              await refresh();
            } catch {
              throw new Error(
                "Workspace changed and could not be refreshed. Reconnect before retrying.",
              );
            }
          }
          throw new Error(
            data.error ?? "Your change was not confirmed. Please retry.",
          );
        }
        return acceptSnapshot(data);
      }
      // Read the latest valid browser snapshot so a payment in another tab is not lost.
      let current = stateRef.current;
      if (action.type !== "RESET")
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) current = parseFinancialState(JSON.parse(raw));
        } catch {
          /* Storage may be disabled; retain the last valid in-memory snapshot. */
        }
      const next = reducer(current, action);
      parseFinancialState(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setStorageError("");
      } catch {
        setStorageError(
          "Changes are in memory only. Browser storage is unavailable.",
        );
      }
      stateRef.current = next;
      setState(next);
      return next;
    } finally {
      inFlight.current = false;
    }
  }
  return {
    state,
    dispatch,
    refresh,
    ready,
    storageError,
    mode: liveSession ? ("live" as const) : ("demo" as const),
  };
}
export function useDemoStore() {
  return useFinancialStore();
}
