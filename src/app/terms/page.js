import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-[680px] mx-auto px-6 py-10 min-h-screen bg-bg">
      <Link href="/" className="text-accent text-sm font-bold mb-4 inline-block">&larr; Back</Link>
      <h1 className="text-2xl font-black text-text mb-4">Terms of Service</h1>
      <p className="text-xs text-text-sec mb-2">Last updated: October 1, 2026</p>
      <div className="text-sm text-text-sec leading-relaxed flex flex-col gap-4">
        <p>Welcome to CourtIQ, a basketball development platform created in Atlanta, Georgia. By using CourtIQ, you agree to these terms.</p>
        <h2 className="text-base font-bold text-text">1. Use of Service</h2>
        <p>CourtIQ is a basketball performance tracking and player-development tool intended for users age 13 and older. You are responsible for maintaining the security of your account and for the accuracy of information you enter.</p>
        <h2 className="text-base font-bold text-text">2. User Data</h2>
        <p>You retain ownership of the information you enter into CourtIQ, including shot logs, game statistics, journal entries, workouts, and player profile data. We process and store this information to provide the service.</p>
        <h2 className="text-base font-bold text-text">3. Acceptable Use</h2>
        <p>You may not misuse the service, attempt to access another user&apos;s data, interfere with CourtIQ systems, or use the service for unlawful purposes.</p>
        <h2 className="text-base font-bold text-text">4. Performance Insights</h2>
        <p>CourtIQ ratings, recommendations, trends, and other insights are development tools based on the data recorded in the service. They are not guarantees of athletic performance, recruiting outcomes, medical advice, or professional scouting evaluations.</p>
        <h2 className="text-base font-bold text-text">5. Service Availability</h2>
        <p>We work to keep CourtIQ available and reliable, but uninterrupted service is not guaranteed. Features may be updated, changed, or retired as the product evolves.</p>
        <h2 className="text-base font-bold text-text">6. Limitation of Liability</h2>
        <p>CourtIQ is provided &quot;as is&quot; to the extent permitted by law. Maintain your own records for information that is important to you and do not rely on CourtIQ as the sole record of official game statistics.</p>
        <h2 className="text-base font-bold text-text">7. Contact</h2>
        <p>Questions about these terms? <a href="mailto:support@pivottrainingdev.com" className="text-accent font-bold">Contact CourtIQ Support</a>.</p>
      </div>
    </div>
  );
}
