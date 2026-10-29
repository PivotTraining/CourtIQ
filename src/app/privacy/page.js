import Link from "next/link";
import AnalyticsPreferences from "@/components/marketing/AnalyticsPreferences";
import { publicPageMetadata } from "@/lib/siteMetadata";

export const metadata = publicPageMetadata({
  title: "Privacy Policy",
  description: "How CourtIQ handles accounts, basketball development records, analytics and privacy choices.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="max-w-[680px] mx-auto px-6 py-10 min-h-screen bg-bg">
      <Link href="/" className="text-accent text-sm font-bold mb-4 inline-block">&larr; Back</Link>
      <h1 className="text-2xl font-black text-text mb-4">Privacy Policy</h1>
      <p className="text-xs text-text-sec mb-2">Last updated: October 29, 2026</p>
      <div className="text-sm text-text-sec leading-relaxed flex flex-col gap-4">
        <p>CourtIQ (&quot;we&quot;, &quot;us&quot;) operates the CourtIQ basketball development service. This policy explains how information is collected, used, and protected.</p>
        <h2 className="text-base font-bold text-text">1. Information We Collect</h2>
        <p><strong>Account Data:</strong> Information such as email address and name used to create and manage an account.</p>
        <p><strong>Player and Performance Data:</strong> Player profiles, shot logs, game statistics, workout results, journal entries, session history, and related basketball-development information you choose to enter.</p>
        <p><strong>Device and Service Data:</strong> Basic browser, security, service diagnostics, and privacy-minimized feature-usage events used to operate and improve CourtIQ. Product telemetry records event names and screen/feature context without sending a CourtIQ user ID, player name, game stats, journal text, film, or precise location.</p>
        <h2 className="text-base font-bold text-text">2. How We Use Data</h2>
        <p>We use data to authenticate users, provide player-development features, generate analytics and reports, preserve account history, maintain service security, and improve CourtIQ. We do not sell personal data to advertisers.</p>
        <h2 className="text-base font-bold text-text">3. Data Storage and Access</h2>
        <p>Account and performance data are stored using service providers including Supabase. Access controls are designed to restrict player data to authorized accounts and relationships.</p>
        <h2 className="text-base font-bold text-text">3a. Optional Analytics Choices</h2>
        <p>Optional, first-party usage measurements are disabled until you opt in. You can choose essential account storage only, or allow anonymous feature and marketing-button counts. You may change your choice below at any time. These events exclude names, journal entries, actual shot logs and raw video; account sign-in storage is necessary for the service.</p>
        <AnalyticsPreferences alwaysShow />
        <h2 className="text-base font-bold text-text">3b. Optional AI Coach Pilot</h2>
        <p>AI Coach is disabled by default and intended for eligible adult player profiles during its initial pilot. If enabled and you consent separately for each question, CourtIQ may send your basketball question and an aggregated, minimized summary of your recorded shooting, game, and drill performance to a third-party AI model provider through an AI gateway. CourtIQ does not attach your player name, account identifiers, journal text, or raw video as model context. Your question is sent as typed and may itself contain information you enter; do not include private details. You can continue using other CourtIQ features without AI Coach. AI output can be inaccurate and should not be considered a verified athletic assessment. Provider processing and retention may be subject to provider policies, which must be reviewed before this feature is launched.</p>
        <h2 className="text-base font-bold text-text">4. Data Retention and Deletion</h2>
        <p>Data is retained while an account remains active or as otherwise required for legitimate service, security, or legal purposes. During the public beta, account-deletion requests are submitted from Settings and queued for manual processing. Submitting a request does not delete the account immediately.</p>
        <h2 className="text-base font-bold text-text">5. Children&apos;s Privacy</h2>
        <p>CourtIQ accounts may only be operated by eligible users age 13 and older. Children under 13 may not create, operate, or sign into their own CourtIQ accounts. A signed-in adult parent or legal guardian may create a limited, parent-managed player record for a younger athlete and manually enter game and training statistics. This creates no account or credentials for the child. The parent must acknowledge responsibility for managing the profile; this acknowledgement is recorded and is not independent verification of parental identity.</p>
        <p>Parents decide which player details to provide, may review and delete the managed profile and its records, and should not give a child their account credentials. Under-13 player data should not be entered into optional AI Coach prompts or publicly shared from the service. CourtIQ does not offer an independently verified parental-consent process for under-13 child-operated features. The limited parent-managed profile feature does not authorize children to use those features.</p>
        <h2 className="text-base font-bold text-text">6. Your Choices and Rights</h2>
        <p>You can update profile information in the service and may request access, correction, export, or deletion where applicable. <Link href="/support" className="text-accent font-bold">Visit CourtIQ Support</Link> for account and privacy assistance.</p>
        <h2 className="text-base font-bold text-text">7. Changes</h2>
        <p>We may update this policy as CourtIQ changes. The date above reflects the latest published revision.</p>
      </div>
    </div>
  );
}
