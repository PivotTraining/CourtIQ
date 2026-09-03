import App from "@/components/App";

const APP_SECTIONS = new Set([
  "dashboard",
  "training",
  "skills",
  "sessions",
  "heatmap",
  "journal",
  "game-log",
  "iq",
]);

export default async function AppSectionPage({ params }) {
  const { section } = await params;

  // Explicit app sections all render the authenticated Court IQ application shell.
  // Static routes such as /privacy and /terms continue to take precedence in Next.js.
  if (!APP_SECTIONS.has(section)) return <App />;

  return <App />;
}
