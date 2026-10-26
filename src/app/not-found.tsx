import Link from "next/link";
export default function NotFound() {
  return (
    <main className="invoice-page">
      <section className="invoice-sheet">
        <div className="brand">
          <span className="brandmark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          FrameLedger
        </div>
        <p className="eyebrow">Page not found</p>
        <h1 style={{ marginTop: 16 }}>Back to your work.</h1>
        <p className="subtitle">
          This page has moved or the address is incomplete. Your workspace is
          one click away.
        </p>
        <Link className="btn primary" href="/">
          Open workspace
        </Link>
      </section>
    </main>
  );
}
