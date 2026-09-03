import Link from "next/link";

const features = [
  ["Game intelligence", "Log real game performance and turn the box score into clear development priorities."],
  ["Training that adapts", "Connect what happened in games to drills and workouts that attack the right weaknesses."],
  ["Progress you can see", "Track shooting, skills, heat maps, journal notes, trends, and CourtIQ insights over time."],
];

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#0F1117", color: "#F8FAFC" }}>
      <nav style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <Link href="/" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 20 }}>
          <img src="/logo.svg" alt="CourtIQ" width="38" height="38" style={{ borderRadius: 10 }} />
          CourtIQ
        </Link>
        <Link href="/dashboard" style={{ color: "#fff", textDecoration: "none", background: "#FF6B35", borderRadius: 12, padding: "11px 16px", fontWeight: 800, fontSize: 14 }}>
          Open CourtIQ
        </Link>
      </nav>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px 48px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "center", gap: 56 }}>
        <div>
          <div style={{ color: "#FF8B61", fontWeight: 900, letterSpacing: 1.8, fontSize: 12, textTransform: "uppercase", marginBottom: 18 }}>Basketball development intelligence</div>
          <h1 style={{ fontSize: "clamp(44px, 7vw, 82px)", lineHeight: 0.96, letterSpacing: -3.4, margin: 0, maxWidth: 760 }}>
            Know what to work on <span style={{ color: "#FF6B35" }}>next.</span>
          </h1>
          <p style={{ maxWidth: 650, color: "#A9B1C1", fontSize: "clamp(17px, 2vw, 21px)", lineHeight: 1.6, margin: "28px 0 0" }}>
            CourtIQ turns games, workouts, shooting sessions, and player habits into a clear development plan. Less guessing. Better reps. Smarter players.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Link href="/dashboard" style={{ color: "#fff", textDecoration: "none", background: "#FF6B35", borderRadius: 14, padding: "14px 20px", fontWeight: 900 }}>Start training smarter</Link>
            <a href="#how-it-works" style={{ color: "#E5E7EB", textDecoration: "none", border: "1px solid #303644", borderRadius: 14, padding: "14px 20px", fontWeight: 800 }}>See how it works</a>
          </div>
        </div>

        <div style={{ background: "linear-gradient(145deg, #181C25, #11141B)", border: "1px solid #2A303C", borderRadius: 28, padding: 24, boxShadow: "0 28px 80px rgba(0,0,0,.35)" }}>
          <div style={{ color: "#8C94A3", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4 }}>Your next move</div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 8 }}>Attack the rim under pressure</div>
          <p style={{ color: "#A9B1C1", lineHeight: 1.55, marginBottom: 24 }}>Your recent game profile shows your biggest opportunity is finishing efficiency when contact increases.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[["CourtIQ", "78"], ["Trend", "+6"], ["Focus", "Finishing"]].map(([label, value]) => (
              <div key={label} style={{ background: "#0D1016", border: "1px solid #252B36", borderRadius: 16, padding: 14 }}>
                <div style={{ color: "#778091", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: value.length > 4 ? 14 : 24, fontWeight: 900, color: label === "Trend" ? "#43D17B" : "#F8FAFC", marginTop: 6 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, background: "#FF6B35", color: "#fff", borderRadius: 16, padding: "14px 16px", fontWeight: 900 }}>Recommended workout · 28 min →</div>
        </div>
      </section>

      <section id="how-it-works" style={{ maxWidth: 1180, margin: "0 auto", padding: "62px 24px 96px" }}>
        <div style={{ maxWidth: 700, marginBottom: 30 }}>
          <div style={{ color: "#FF8B61", fontSize: 12, fontWeight: 900, letterSpacing: 1.6, textTransform: "uppercase" }}>One development loop</div>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 52px)", letterSpacing: -2, margin: "8px 0 0" }}>Play. Track. Understand. Improve.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {features.map(([title, body], index) => (
            <article key={title} style={{ background: "#171A22", border: "1px solid #292E39", borderRadius: 20, padding: 22 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,107,53,.14)", color: "#FF7B4A", display: "grid", placeItems: "center", fontWeight: 900 }}>{index + 1}</div>
              <h3 style={{ fontSize: 21, margin: "18px 0 8px" }}>{title}</h3>
              <p style={{ color: "#9BA4B4", lineHeight: 1.6, margin: 0 }}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #242A34", padding: "28px 24px", color: "#7E8797" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <strong style={{ color: "#D7DBE2" }}>CourtIQ</strong>
          <div style={{ display: "flex", gap: 18 }}><Link href="/privacy" style={{ color: "inherit" }}>Privacy</Link><Link href="/terms" style={{ color: "inherit" }}>Terms</Link></div>
        </div>
      </footer>
    </main>
  );
}
