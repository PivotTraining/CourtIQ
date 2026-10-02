import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";

const App = dynamic(() => import("@/components/App"));

const APP_SECTIONS = new Set([
  "dashboard",
  "training",
  "skills",
  "sessions",
  "heatmap",
  "journal",
  "game-log",
  "iq",
  "family",
  "settings",
  "film",
]);

export default async function AppSectionPage({ params }) {
  const { section } = await params;

  // Explicit app sections all render the authenticated Court IQ application shell.
  // Static routes such as /privacy and /terms continue to take precedence in Next.js.
  if (!APP_SECTIONS.has(section)) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return (
      <main style={{ width: "100%", minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div><h1>CourtIQ is temporarily unavailable</h1><p style={{ marginTop: 12 }}>Please try again shortly.</p><Link href="/" style={{ display: "inline-block", marginTop: 20, color: "var(--color-accent)" }}>Return to CourtIQ</Link></div>
      </main>
    );
  }

  return <App />;
}
