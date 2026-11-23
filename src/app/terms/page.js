import Link from "next/link";
import { publicPageMetadata } from "@/lib/siteMetadata";

export const metadata = publicPageMetadata({
  title: "Terms of Service",
  description: "Read the terms and conditions for using the CourtIQ basketball development application.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="max-w-[680px] mx-auto px-6 py-10 min-h-screen bg-bg">
      <Link href="/" className="text-accent text-sm font-bold mb-4 inline-block">&larr; Back</Link>
      <h1 className="text-2xl font-black text-text mb-4">Terms of Service</h1>
      <p className="text-xs text-text-sec mb-2">Last updated: November 22, 2026</p>
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
        <h2 className="text-base font-bold text-text">7. Paid Membership, Free Trial, and Automatic Renewal</h2>
        <p>CourtIQ may offer eligible first-time subscribers a seven-day free trial of Player or Coach membership. A payment method is required to begin this offer. The first seven days cost $0 in subscription fees. Unless you cancel before your trial ends, your chosen subscription begins recurring billing automatically at the end of the trial: Player at $9 per month or $79 per year, or Coach at $29 per month or $249 per year, depending on the plan you select. Applicable taxes may be added and are shown at checkout. Prices are in US dollars.</p>
        <p>Paid subscriptions renew automatically at the same billing interval until canceled. Before starting, Stripe Checkout displays your chosen price and trial details and asks you to authorize recurring billing. You can cancel through CourtIQ Membership &rarr; Manage billing &amp; cancellation before the trial ends to avoid the first subscription charge. Cancellations are scheduled for the end of the then-current billing period; access and applicable charges for a period already started are not automatically refunded. If a subscription is canceled during its free trial, no recurring subscription charge is due for that trial. Keep your cancellation confirmation for your records.</p>
        <p>This seven-day offer applies only to eligible new subscriptions, not automatically to existing subscribers or users who already used an earlier promotion. The checkout terms and price shown at the time of purchase control any future offer changes. You retain access to your own saved game history if your paid access expires, subject to the service and account retention policies.</p>
        <h2 className="text-base font-bold text-text">8. Contact</h2>
        <p>Questions about these terms? <Link href="/support" className="text-accent font-bold">Visit CourtIQ Support</Link>.</p>
      </div>
    </div>
  );
}
