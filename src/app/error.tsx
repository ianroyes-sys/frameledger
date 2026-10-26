"use client";
export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main className="loading">
      <section className="panel">
        <h1>We couldn’t open this page.</h1>
        <p className="subtitle">
          Your saved records have not been removed. Try loading the page again.
        </p>
        <button className="btn primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
