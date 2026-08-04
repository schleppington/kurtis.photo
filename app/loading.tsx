export default function Loading() {
  return (
    <main className="route-loading" aria-busy="true" aria-live="polite">
      <div className="page-shell">
        <section className="route-loading-intro" aria-hidden="true">
          <span className="route-loading-kicker" />
          <span className="route-loading-title" />
          <span className="route-loading-copy" />
        </section>
        <div className="route-loading-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </div>
      </div>
    </main>
  );
}
