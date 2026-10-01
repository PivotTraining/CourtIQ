"use client";

export default function RecordsUnavailable() {
  return <div role="alert" style={{ background: "var(--color-card)", padding: 20, borderRadius: 16 }}>
    <h2 style={{ fontSize: 17, fontWeight: 700 }}>Records unavailable</h2>
    <p style={{ color: "var(--color-text-sec)", fontSize: 13, lineHeight: 1.5 }}>We couldn't load these records. This is not an empty-history result. Check your connection, then reload.</p>
    <button onClick={() => window.location.reload()} style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 12, background: "var(--color-accent)", color: "white", fontWeight: 700 }}>Reload</button>
  </div>;
}
