"use client";
import { useCallback, useEffect, useState } from "react";
import type { LiveSession } from "./live-gate";
type Card = {
  id: string;
  name: string | null;
  last4: string | null;
  status: string | null;
  type: string | null;
};
type Issuance = { enabled: boolean; terms: string | null };
type CardAction = "freeze" | "unfreeze" | "cancel";
export default function LiveCards({ session }: { session: LiveSession }) {
  const [cards, setCards] = useState<Card[]>([]),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [issuance, setIssuance] = useState<Issuance>({
    enabled: false,
    terms: null,
  });
  const [issueName, setIssueName] = useState("Business expenses"),
    [issueLimit, setIssueLimit] = useState("500"),
    [issueAccepted, setIssueAccepted] = useState(false),
    [issueRequestId, setIssueRequestId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    card: Card;
    action: CardAction;
  } | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/cards?businessId=${encodeURIComponent(session.businessId)}`,
        {
          headers: { Authorization: `Bearer ${session.token}` },
          cache: "no-store",
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Cards could not load.");
      setCards(data.data);
      setIssuance({
        enabled: data.issuanceEnabled === true,
        terms: data.termsUrl,
      });
      setError("");
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cards could not load.");
    }
  }, [session.businessId, session.token]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  async function issueCard(event: React.FormEvent) {
    event.preventDefault();
    if (!issueAccepted || busy) return;
    if (
      !/^\d+(\.\d{1,2})?$/.test(issueLimit) ||
      Number(issueLimit) <= 0 ||
      Number(issueLimit) > 1000000
    ) {
      setError(
        "Enter a positive limit up to $1,000,000 with at most two decimal places.",
      );
      return;
    }
    const id = issueRequestId ?? crypto.randomUUID();
    setIssueRequestId(id);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: session.businessId,
          requestId: id,
          name: issueName,
          spendLimitCents: Math.round(Number(issueLimit) * 100),
          frequency: "monthly",
          confirmed: true,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ??
            "Card request outcome unconfirmed. Refresh cards or contact support before another request.",
        );
      setNotice(
        result.object === "card"
          ? `Whop returned a card with status ${result.status ?? "unknown"}.`
          : result.object === "card_application"
            ? `Card application: ${result.status}. No issued card has been confirmed.`
            : "Card onboarding or provisioning is pending. Refresh cards after completing Whop onboarding.",
      );
      setIssueRequestId(null);
      setIssueAccepted(false);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Card request outcome unconfirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/cards", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: session.businessId,
          cardId: pending.card.id,
          action: pending.action,
          confirmed: true,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "The card change was not confirmed.");
      setNotice(
        `Card change confirmed by Whop: ${result.status ?? pending.action}.`,
      );
      setPending(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Card change failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panelhead">
        <h2>Your Whop cards</h2>
        <button className="btn" disabled={busy} onClick={load}>
          Refresh cards
        </button>
      </div>
      <p className="subtitle">
        Only cards returned for your connected account appear here. Full card
        numbers and security codes are never stored in FrameLedger.
      </p>
      {ready && !issuance.enabled && (
        <p className="notice">
          New card requests are unavailable until the card program and terms are
          configured.
        </p>
      )}
      {ready && issuance.enabled && (
        <form
          onSubmit={issueCard}
          className="notice"
          aria-label="Request a virtual card"
        >
          <h3>Request a virtual business card</h3>
          <p>
            Subject to Whop and issuer approval. This may start an application
            or invitation; it does not guarantee issuance.
          </p>
          <label>
            Card name
            <input
              required
              maxLength={80}
              value={issueName}
              onChange={(e) => setIssueName(e.target.value)}
              disabled={busy || !!issueRequestId}
            />
          </label>
          <label>
            Monthly spending limit (USD)
            <input
              required
              inputMode="decimal"
              value={issueLimit}
              onChange={(e) => setIssueLimit(e.target.value)}
              disabled={busy || !!issueRequestId}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={issueAccepted}
              onChange={(e) => setIssueAccepted(e.target.checked)}
              disabled={busy}
            />{" "}
            I reviewed the{" "}
            <a
              href={issuance.terms ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              card terms and fees
            </a>{" "}
            and confirm this card request.
          </label>
          <button className="btn primary" disabled={busy || !issueAccepted}>
            {busy
              ? "Waiting for Whop…"
              : issueRequestId
                ? "Check original request"
                : "Confirm card request"}
          </button>
        </form>
      )}
      {error && (
        <p className="notice warn" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!ready && !error && <p role="status">Loading account cards…</p>}
      {ready && cards.length === 0 && (
        <p className="notice">
          No accessible cards were returned. Issuance requires provider
          eligibility and account setup.
        </p>
      )}
      {cards.map((card) => (
        <article className="projectcard" key={card.id}>
          <div className="panelhead">
            <div>
              <h3>{card.name ?? "Business card"}</h3>
              <p className="subtitle">
                Ending {card.last4 ?? "unavailable"} ·{" "}
                {card.status ?? "Unknown status"}
              </p>
            </div>
          </div>
          <div className="actions">
            <button
              className="btn"
              disabled={busy || !!pending || card.status === "canceled"}
              onClick={() =>
                setPending({
                  card,
                  action: card.status === "frozen" ? "unfreeze" : "freeze",
                })
              }
            >
              {card.status === "frozen" ? "Unfreeze" : "Freeze"}
            </button>
            <button
              className="btn danger"
              disabled={busy || !!pending || card.status === "canceled"}
              onClick={() => setPending({ card, action: "cancel" })}
            >
              Cancel card
            </button>
          </div>
        </article>
      ))}
      {pending && (
        <section className="notice warn" aria-label="Confirm card change">
          <h3>
            {pending.action === "cancel"
              ? "Cancel this card permanently?"
              : `${pending.action === "freeze" ? "Freeze" : "Unfreeze"} this card?`}
          </h3>
          <p style={{ margin: "12px 0" }}>
            Card ending {pending.card.last4 ?? "unavailable"}.{" "}
            {pending.action === "cancel"
              ? "Cancellation cannot be undone."
              : "This changes whether the card can be used for spending."}
          </p>
          <div className="actions">
            <button
              className={`btn ${pending.action === "cancel" ? "danger" : "primary"}`}
              disabled={busy}
              onClick={confirm}
            >
              {busy ? "Waiting for Whop…" : `Confirm ${pending.action}`}
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Keep current settings
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
