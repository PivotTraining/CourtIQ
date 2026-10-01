import Link from "next/link";
import Image from "next/image";
import { DRILL_BANK, DRILL_CATEGORIES, SKILL_LEVELS } from "@/lib/drillBank";

const featureCards = [
  ["Gametime", "Track shots, free throws, assists, rebounds, steals, blocks, turnovers, fouls, and minutes while the game is happening."],
  ["162-drill library", "Train across shooting, ball handling, finishing, defense, rebounding, passing, conditioning, and agility."],
  ["My IQ", "Turn recorded games and sessions into skill ratings, trends, and a clear next development priority."],
  ["Heat maps", "See where shots are coming from and where efficiency is strongest or needs work."],
  ["Journal", "Capture confidence, focus, mood, and reflections alongside basketball performance."],
  ["Reports", "Review game and season performance with shooting splits, box-score context, and exportable summaries."],
];

const loop = [
  ["1", "Play", "Record what actually happened in a game or workout."],
  ["2", "Understand", "CourtIQ turns the data into patterns, strengths, and development priorities."],
  ["3", "Train", "Use the drill library and recommended work to attack the right skill."],
  ["4", "Measure", "Come back after the next game and see whether the work is translating."],
];

export default function Home() {
  const drillCount = DRILL_BANK.length;
  const categoryCount = DRILL_CATEGORIES.length;
  const levelCount = SKILL_LEVELS.length;

  return (
    <main style={{ width: "100%", minHeight: "100dvh", background: "#0F1117", color: "#F8FAFC" }}>
      <nav style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <Link href="/" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 20 }}>
          <Image src="/logo.svg" alt="CourtIQ" width={38} height={38} style={{ borderRadius: 10 }} />
          CourtIQ
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#778091", fontSize: 12, fontWeight: 700 }}>Made in Atlanta</span>
          <Link href="/dashboard" style={{ color: "#fff", textDecoration: "none", background: "#FF6B35", borderRadius: 12, padding: "11px 16px", fontWeight: 800, fontSize: 14 }}>
            Open CourtIQ
          </Link>
        </div>
      </nav>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "74px 24px 54px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", alignItems: "center", gap: 56 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#FF8B61", fontWeight: 900, letterSpacing: 1.5, fontSize: 11, textTransform: "uppercase", marginBottom: 18, border: "1px solid #3A2923", borderRadius: 999, padding: "7px 11px", background: "#171310" }}>
            Basketball development intelligence · Atlanta, GA
          </div>
          <h1 style={{ fontSize: "clamp(44px, 7vw, 82px)", lineHeight: 0.96, letterSpacing: -3.4, margin: 0, maxWidth: 780 }}>
            Track the game. Know what to work on <span style={{ color: "#FF6B35" }}>next.</span>
          </h1>
          <p style={{ maxWidth: 680, color: "#A9B1C1", fontSize: "clamp(17px, 2vw, 21px)", lineHeight: 1.6, margin: "28px 0 0" }}>
            CourtIQ connects game tracking, player analytics, a {drillCount}-drill development library, heat maps, journaling, and training recommendations in one basketball platform.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Link href="/dashboard" style={{ color: "#fff", textDecoration: "none", background: "#FF6B35", borderRadius: 14, padding: "14px 20px", fontWeight: 900 }}>Open the web app</Link>
            <a href="#product" style={{ color: "#E5E7EB", textDecoration: "none", border: "1px solid #303644", borderRadius: 14, padding: "14px 20px", fontWeight: 800 }}>See the product</a>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 34, maxWidth: 620 }}>
            {[
              [String(drillCount), "basketball drills"],
              [String(categoryCount), "skill categories"],
              [String(levelCount), "development levels"],
              ["Web", "phone · tablet · desktop"],
            ].map(([value, label]) => (
              <div key={label} style={{ border: "1px solid #292E39", borderRadius: 16, padding: "14px 16px", background: "#151821" }}>
                <div style={{ fontSize: 24, fontWeight: 950 }}>{value}</div>
                <div style={{ color: "#8791A2", fontSize: 11, fontWeight: 750, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "linear-gradient(145deg, #181C25, #11141B)", border: "1px solid #2A303C", borderRadius: 28, padding: 24, boxShadow: "0 28px 80px rgba(0,0,0,.35)" }}>
          <div style={{ color: "#8C94A3", fontSize: 11, marginBottom: 14 }}>The CourtIQ development loop</div>
          <div style={{ color: "#8C94A3", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4 }}>Your next move</div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 8 }}>Turn performance into a plan.</div>
          <p style={{ color: "#A9B1C1", lineHeight: 1.55, marginBottom: 24 }}>Log the game, identify the pattern, prescribe the work, then measure whether the player improved.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[["Game", "Tracked"], ["Pattern", "Found"], ["Work", "Assigned"]].map(([label, value]) => (
              <div key={label} style={{ background: "#0D1016", border: "1px solid #252B36", borderRadius: 16, padding: 14 }}>
                <div style={{ color: "#778091", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#F8FAFC", marginTop: 6 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, background: "#FF6B35", color: "#fff", borderRadius: 16, padding: "14px 16px", fontWeight: 900 }}>Play → Understand → Train → Measure</div>
        </div>
      </section>

      <section id="product" style={{ maxWidth: 1180, margin: "0 auto", padding: "54px 24px 90px" }}>
        <div style={{ maxWidth: 760, marginBottom: 30 }}>
          <div style={{ color: "#FF8B61", fontSize: 12, fontWeight: 900, letterSpacing: 1.6, textTransform: "uppercase" }}>Inside CourtIQ</div>
          <h2 style={{ fontSize: "clamp(34px, 5vw, 54px)", letterSpacing: -2, margin: "8px 0 0" }}>Built for the gym. Useful after the gym.</h2>
          <p style={{ color: "#9BA4B4", lineHeight: 1.65, fontSize: 16, marginTop: 14 }}>The tracker is optimized for quick entry on a phone. The web experience expands the same data into a larger review and development workspace.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 18, alignItems: "stretch" }}>
          <figure style={{ margin: 0, background: "#151821", border: "1px solid #292E39", borderRadius: 22, overflow: "hidden" }}>
            <Image src="/product-desktop.jpg" alt="CourtIQ desktop Gametime tracker" width={1200} height={840} style={{ width: "100%", height: "auto", objectFit: "cover", display: "block" }} />
          </figure>
          <figure style={{ margin: 0, background: "#151821", border: "1px solid #292E39", borderRadius: 22, overflow: "hidden", minHeight: 420 }}>
            <Image src="/product-mobile.jpg" alt="CourtIQ mobile Gametime tracker" width={430} height={850} style={{ width: "100%", height: "auto", objectFit: "cover", objectPosition: "top", display: "block" }} />
          </figure>
        </div>
        <div style={{ color: "#697386", fontSize: 11, marginTop: 10 }}>Product screenshots use sample data.</div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 86px" }}>
        <div style={{ maxWidth: 760, marginBottom: 30 }}>
          <div style={{ color: "#FF8B61", fontSize: 12, fontWeight: 900, letterSpacing: 1.6, textTransform: "uppercase" }}>What is live now</div>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 52px)", letterSpacing: -2, margin: "8px 0 0" }}>A complete player-development workspace.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {featureCards.map(([title, body]) => (
            <article key={title} style={{ background: "#171A22", border: "1px solid #292E39", borderRadius: 20, padding: 22 }}>
              <h3 style={{ fontSize: 20, margin: 0 }}>{title}</h3>
              <p style={{ color: "#9BA4B4", lineHeight: 1.6, margin: "9px 0 0" }}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 96px" }}>
        <div style={{ maxWidth: 760, marginBottom: 30 }}>
          <div style={{ color: "#FF8B61", fontSize: 12, fontWeight: 900, letterSpacing: 1.6, textTransform: "uppercase" }}>One development loop</div>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 52px)", letterSpacing: -2, margin: "8px 0 0" }}>The point is not more data. It is better decisions.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {loop.map(([number, title, body]) => (
            <article key={number} style={{ background: "#171A22", border: "1px solid #292E39", borderRadius: 20, padding: 22 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,107,53,.14)", color: "#FF7B4A", display: "grid", placeItems: "center", fontWeight: 900 }}>{number}</div>
              <h3 style={{ fontSize: 21, margin: "18px 0 8px" }}>{title}</h3>
              <p style={{ color: "#9BA4B4", lineHeight: 1.6, margin: 0 }}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ borderTop: "1px solid #242A34", borderBottom: "1px solid #242A34", background: "#12151D" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "52px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 950 }}>Made in Atlanta. Built for players everywhere.</div>
            <div style={{ color: "#8D96A6", marginTop: 8 }}>CourtIQ is a basketball development product created in Atlanta, Georgia.</div>
          </div>
          <Link href="/dashboard" style={{ color: "#fff", textDecoration: "none", background: "#FF6B35", borderRadius: 14, padding: "14px 20px", fontWeight: 900 }}>Open CourtIQ</Link>
        </div>
      </section>

      <footer style={{ padding: "28px 24px", color: "#7E8797" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <strong style={{ color: "#D7DBE2" }}>CourtIQ</strong>
            <div style={{ fontSize: 11, marginTop: 4 }}>© 2026 CourtIQ · Made in Atlanta, Georgia</div>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <Link href="/privacy" style={{ color: "inherit" }}>Privacy</Link>
            <Link href="/terms" style={{ color: "inherit" }}>Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
