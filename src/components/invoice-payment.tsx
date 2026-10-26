"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { useFinancialStore } from "./demo-store";
import { formatMoney } from "@/domain";
export default function InvoicePayment({
  id,
  live,
}: {
  id: string;
  live: boolean;
}) {
  return live ? (
    <main className="invoice-page">
      <section className="invoice-sheet">
        <h1>Open your secure payment link</h1>
        <p className="subtitle">
          Live invoices use the verified payment link created by Whop. Contact
          the business that sent your invoice for the secure link. No payment
          details are collected here.
        </p>
      </section>
    </main>
  ) : (
    <DemoInvoicePayment id={id} />
  );
}
function DemoInvoicePayment({ id }: { id: string }) {
  const { state, dispatch, ready, storageError } = useFinancialStore();
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ready) return <main className="loading">Loading invoice…</main>;
  const invoice = state.invoices.find((i) => i.id === id);
  if (!invoice)
    return (
      <main className="invoice-page">
        <section className="invoice-sheet">
          <h1>Invoice not found</h1>
          <p className="subtitle">
            This demo invoice belongs to the browser where it was created. Ask
            the business for its live payment link.
          </p>
          <Link className="btn" href="/">
            Back to workspace
          </Link>
        </section>
      </main>
    );
  const project = state.projects.find((p) => p.id === invoice.projectId);
  const client = state.clients.find((c) => c.id === project?.clientId);
  const due = invoice.amount - invoice.paid;
  function paymentAmount() {
    if (amount && !/^\d+(\.\d{1,2})?$/.test(amount))
      throw new Error("Enter an amount with no more than two decimal places.");
    const cents = amount ? Math.round(Number(amount) * 100) : due;
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > due)
      throw new Error(
        "Enter a positive amount no greater than the balance due.",
      );
    return cents;
  }
  async function pay() {
    setBusy(true);
    setError("");
    try {
      const cents = paymentAmount();
      await dispatch({
        type: "PAY_INVOICE",
        id,
        amount: cents,
        eventId: crypto.randomUUID(),
      });
      setConfirm(false);
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment simulation failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="invoice-page">
      <div
        className="actions"
        style={{ justifyContent: "space-between", marginBottom: 23 }}
      >
        <Link className="textbtn" href="/">
          <ArrowLeft size={13} />
          Back to workspace
        </Link>
        <span className="demo">DEMO INVOICE · NO REAL PAYMENT</span>
      </div>
      <section className="invoice-sheet">
        <div className="invoice-brand">
          <div className="actions">
            <span className="brandmark">
              <i />
              <i />
              <i />
            </span>
            <strong>Your creative studio</strong>
          </div>
          <span className={"chip " + invoice.status}>{invoice.status}</span>
        </div>
        <div className="eyebrow">{invoice.number}</div>
        <h1 style={{ marginTop: 9 }}>{project?.name}</h1>
        <p className="subtitle">
          Good work. Clear details. One simple invoice.
        </p>
        <div className="invoice-meta">
          <div>
            <div className="statlabel">Billed to</div>
            <strong>{client?.name}</strong>
            <p className="projectmeta" style={{ marginTop: 6 }}>
              {client?.email}
            </p>
          </div>
          <div>
            <div className="statlabel">Payment due</div>
            <strong>
              {new Date(invoice.dueDate + "T12:00:00").toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" },
              )}
            </strong>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{invoice.description}</td>
              <td className="right">{formatMoney(invoice.amount)}</td>
            </tr>
            <tr>
              <td>Already paid</td>
              <td className="right">{formatMoney(-invoice.paid)}</td>
            </tr>
          </tbody>
        </table>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 23,
          }}
        >
          <strong>Balance due</strong>
          <div className="big-money">{formatMoney(due)}</div>
        </div>
        {invoice.status === "paid" ? (
          <div className="notice">
            <CheckCircle2
              size={16}
              style={{ verticalAlign: "middle", marginRight: 8 }}
            />
            Paid in demo. Thank you for supporting independent creative work.
          </div>
        ) : invoice.status === "void" ? (
          <div className="notice">
            This invoice has been voided. No payment is due.
          </div>
        ) : invoice.status === "draft" ? (
          <div className="notice">
            This is a draft preview. Mark the invoice sent in your workspace
            before simulating a payment.
          </div>
        ) : (
          <div>
            <label className="field">
              Payment amount (USD)
              <input
                aria-label="Payment amount (USD)"
                type="number"
                step="0.01"
                min="0.01"
                max={due / 100}
                placeholder={(due / 100).toFixed(2)}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setConfirm(false);
                }}
              />
            </label>
            {confirm ? (
              <div className="notice" style={{ marginTop: 18 }}>
                <p>
                  Confirm a synthetic payment of{" "}
                  {formatMoney(amount ? Math.round(Number(amount) * 100) : due)}
                  ? This updates the project, balance, and allocation records.
                  No money will move.
                </p>
                <div className="actions" style={{ marginTop: 13 }}>
                  <button className="btn primary" disabled={busy} onClick={pay}>
                    {busy ? "Recording…" : "Confirm demo payment"}
                  </button>
                  <button className="btn" onClick={() => setConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn primary"
                style={{ width: "100%", marginTop: 17 }}
                onClick={() => {
                  try {
                    paymentAmount();
                    setError("");
                    setConfirm(true);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Check the payment amount.",
                    );
                  }
                }}
              >
                Simulate payment
              </button>
            )}
          </div>
        )}
        {(error || storageError) && (
          <div className="error" role="alert">
            {error || storageError}
          </div>
        )}
        <p
          className="projectmeta"
          style={{ textAlign: "center", lineHeight: 1.7, marginTop: 24 }}
        >
          <ShieldCheck size={12} style={{ verticalAlign: "middle" }} /> Demo
          mode uses synthetic funds. This page never collects card or bank
          details.
          <br />
          Live payments use hosted Whop payment infrastructure.
        </p>
      </section>
      <p className="projectmeta" style={{ textAlign: "center", marginTop: 23 }}>
        Organized with FrameLedger · A financial workspace for creative
        businesses
      </p>
    </main>
  );
}
