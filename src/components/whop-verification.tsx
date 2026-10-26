"use client";
import { useCallback, useState } from "react";
import { loadWhop } from "@whop/elements";
import { WhopElements, Verifications, KycElement } from "@whop/elements-react";
import type { LiveSession } from "./live-gate";
export default function WhopVerification({
  session,
}: {
  session: LiveSession;
}) {
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [elements, setElements] = useState<ReturnType<typeof loadWhop> | null>(
    null,
  );
  const getToken = useCallback(async () => {
    const response = await fetch("/api/whop/access-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: session.businessId,
        purpose: "verification",
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error ?? "Verification is unavailable.");
    setAccountId(payload.accountId);
    return payload.token as string;
  }, [session.token, session.businessId]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      await getToken();
      setElements(loadWhop());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification is unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Identity verification</h2>
      <p className="subtitle">
        Complete the required verification securely with Whop. Identity
        documents go to the hosted verification provider.
      </p>
      {!elements && (
        <button className="btn primary" disabled={busy} onClick={start}>
          {busy ? "Preparing verification…" : "Open secure verification"}
        </button>
      )}
      {error && (
        <div className="notice warn" role="alert">
          {error}
        </div>
      )}
      {status && (
        <p role="status" className="subtitle">
          {status}
        </p>
      )}
      {elements && accountId && (
        <WhopElements
          elements={elements}
          onLoadError={() =>
            setError(
              "The secure verification form could not load. Reload and retry.",
            )
          }
        >
          <Verifications
            accountId={accountId}
            kind="business"
            getToken={getToken}
            analytics={false}
            appearance={{
              classes: {
                "whop-KycFrame": { borderRadius: "12px" },
                "whop-KycSurface": {
                  fontFamily: "Instrument Sans, sans-serif",
                  color: "#f5f4fb",
                  backgroundColor: "#151720",
                },
              },
            }}
          >
            <KycElement
              onCompleted={() =>
                setStatus(
                  "Whop reports verification complete. Account capabilities are confirmed separately by the provider.",
                )
              }
              onActionRequired={() =>
                setStatus(
                  "Whop needs more information. Follow the instructions in the secure form.",
                )
              }
              onLoadFailed={() =>
                setError(
                  "Whop could not load verification for this account. Check account setup and try again.",
                )
              }
              onError={() =>
                setError(
                  "The verification form encountered a problem. Reload to retry.",
                )
              }
            />
          </Verifications>
        </WhopElements>
      )}
    </section>
  );
}
