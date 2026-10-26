export default function Loading() {
  return (
    <main className="loading" aria-label="Loading workspace">
      <div>
        <h2>Opening your workspace</h2>
        <div className="skeleton" style={{ marginTop: 20 }} />
      </div>
    </main>
  );
}
