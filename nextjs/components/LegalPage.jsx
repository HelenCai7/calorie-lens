import Link from "next/link";

export default function LegalPage({ title, updated, children }) {
  return (
    <main className="stats-shell">
      <article className="analysis-panel legal-page">
        <header className="topbar">
          <div>
            <p className="eyebrow">Calorie Lens</p>
            <h1>{title}</h1>
            <p className="legal-updated">Last updated: {updated}</p>
          </div>
          <Link className="text-button" href="/">
            ← Back to app
          </Link>
        </header>
        {children}
      </article>
    </main>
  );
}
