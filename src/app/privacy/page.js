import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="max-w-[680px] mx-auto px-6 py-10 min-h-screen bg-bg">
      <Link href="/" className="text-accent text-sm font-bold mb-4 inline-block">&larr; Back</Link>
      <h1 className="text-2xl font-black text-text mb-4">Privacy Policy</h1>
      <p className="text-xs text-text-sec mb-2">Last updated: October 1, 2026</p>
      <div className="text-sm text-text-sec leading-relaxed flex flex-col gap-4">
        <p>CourtIQ (&quot;we&quot;, &quot;us&quot;) operates the CourtIQ basketball development service. This policy explains how information is collected, used, and protected.</p>
        <h2 className="text-base font-bold text-text">1. Information We Collect</h2>
        <p><strong>Account Data:</strong> Information such as email address and name used to create and manage an account.</p>
        <p><strong>Player and Performance Data:</strong> Player profiles, shot logs, game statistics, workout results, journal entries, session history, and related basketball-development information you choose to enter.</p>
        <p><strong>Device and Service Data:</strong> Basic browser, device, security, and service diagnostics used to operate and improve CourtIQ. CourtIQ does not require precise location data for its core web experience.</p>
        <h2 className="text-base font-bold text-text">2. How We Use Data</h2>
        <p>We use data to authenticate users, provide player-development features, generate analytics and reports, preserve account history, maintain service security, and improve CourtIQ. We do not sell personal data to advertisers.</p>
        <h2 className="text-base font-bold text-text">3. Data Storage and Access</h2>
        <p>Account and performance data are stored using service providers including Supabase. Access controls are designed to restrict player data to authorized accounts and relationships.</p>
        <h2 className="text-base font-bold text-text">4. Data Retention and Deletion</h2>
        <p>Data is retained while an account remains active or as otherwise required for legitimate service, security, or legal purposes. Account-deletion tools are provided in CourtIQ; some deletion requests may require support if an automated deletion cannot complete safely.</p>
        <h2 className="text-base font-bold text-text">5. Children&apos;s Privacy</h2>
        <p>CourtIQ is intended for users age 13 and older. We do not knowingly permit children under 13 to create or operate their own CourtIQ accounts. A verified guardian-consent workflow for younger users is not currently offered.</p>
        <h2 className="text-base font-bold text-text">6. Your Choices and Rights</h2>
        <p>You can update profile information in the service and may request access, correction, export, or deletion where applicable. <a href="mailto:privacy@pivottrainingdev.com" className="text-accent font-bold">Contact CourtIQ Privacy</a> for assistance.</p>
        <h2 className="text-base font-bold text-text">7. Changes</h2>
        <p>We may update this policy as CourtIQ changes. The date above reflects the latest published revision.</p>
      </div>
    </div>
  );
}
