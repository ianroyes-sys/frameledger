"use client";
import { useState } from "react";
import { formatMoney, type Action, type FinancialState } from "@/domain";
export default function ProtectedReserve({
  amount,
  dispatch,
}: {
  amount: number;
  dispatch: (action: Action) => Promise<FinancialState>;
}) {
  const [value, setValue] = useState((amount / 100).toFixed(2)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="panel">
      <h2>Protect a little breathing room.</h2>
      <p className="subtitle">
        Keep booking retainers, upcoming software bills, or a seasonal buffer
        out of Safe to Spend. This is an extra virtual reserve; avoid including
        costs already recorded as commitments.
      </p>
      <form
        className="actions"
        style={{ alignItems: "flex-end", flexWrap: "wrap" }}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setMessage("");
          setBusy(true);
          try {
            if (!/^\d+(\.\d{1,2})?$/.test(value))
              throw new Error(
                "Enter a nonnegative dollar amount with at most two decimal places.",
              );
            const cents = Math.round(Number(value) * 100);
            await dispatch({ type: "SET_PROTECTED_RESERVES", amount: cents });
            setMessage(`${formatMoney(cents)} protected from Safe to Spend.`);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Reserve could not be saved.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Protected reserve (USD)
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving…" : "Save protected reserve"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
