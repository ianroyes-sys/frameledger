"use client";
import { useState } from "react";
import { formatMoney } from "@/domain";
import type { LiveSession } from "./live-gate";
type Preview = {
  amount: number;
  destinationId: string;
  recipient: string;
  verifiedAt: string;
  feeDisclosure?: string | null;
  operation?: { status: string } | null;
};
export default function LivePayout({
  session,
  commitmentId,
  onRefresh,
}: {
  session: LiveSession;
  commitmentId: string;
  onRefresh: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function review() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/collaborators/pay?businessId=${encodeURIComponent(session.businessId)}&commitmentId=${encodeURIComponent(commitmentId)}`,
        {
          headers: { Authorization: `Bearer ${session.token}` },
          cache: "no-store",
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Payment setup is incomplete.");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare payment.");
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (!preview?.feeDisclosure) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/collaborators/pay", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: session.businessId,
          commitmentId,
          confirmed: true,
          expectedAmount: preview.amount,
          expectedDestinationId: preview.destinationId,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Payment was not confirmed.");
      setMessage(
        "Payment request recorded. The commitment stays reserved until Whop confirms completion.",
      );
      setPreview(null);
      await onRefresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Payment status is uncertain. Refresh before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="btn" disabled={busy} onClick={review}>
        {busy ? "Checking…" : "Review Whop payment"}
      </button>
      {error && (
        <p
          className="error"
          role="alert"
          style={{ maxWidth: 320, whiteSpace: "normal" }}
        >
          {error}
        </p>
      )}
      {message && (
        <p
          className="notice"
          role="status"
          style={{ maxWidth: 320, whiteSpace: "normal" }}
        >
          {message}
        </p>
      )}
      {preview && (
        <section
          className="notice"
          aria-label="Confirm collaborator payment"
          style={{ maxWidth: 360, whiteSpace: "normal" }}
        >
          <h3>Pay {preview.recipient}</h3>
          <p style={{ margin: "12px 0" }}>
            Amount: {formatMoney(preview.amount)}
            <br />
            Verified recipient account: {preview.destinationId}
            <br />
            This sends a real Whop transfer. Review the recipient and amount
            before confirming.
          </p>
          <p>
            {preview.feeDisclosure ??
              "Payment unavailable until transfer fees have been verified and disclosed."}
          </p>
          {preview.operation && (
            <p>
              Existing request: {preview.operation.status}. Repeated
              confirmation uses the same payment operation.
            </p>
          )}
          <div className="actions" style={{ flexWrap: "wrap" }}>
            <button
              className="btn primary"
              disabled={busy || !preview.feeDisclosure}
              onClick={pay}
            >
              Confirm payment
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
