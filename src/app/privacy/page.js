export default function PrivacyPage() {
  return (
    <div className="max-w-[520px] mx-auto px-6 py-8 min-h-screen bg-bg">
      <a href="/" className="text-accent text-sm font-bold mb-4 inline-block">&larr; Back</a>
      <h1 className="text-2xl font-black text-text mb-4">Privacy Policy</h1>
      <p className="text-xs text-text-sec mb-2">Last updated: March 24, 2026</p>
      <div className="text-sm text-text-sec leading-relaxed flex flex-col gap-4">
        <p>Pivot Training and Development ("we", "us") operates Court IQ. This policy explains how we collect, use, and protect your information.</p>
        <h2 className="text-base font-bold text-text">1. Information We Collect</h2>
        <p><strong>Account Data:</strong> Email address and name when you create an account.</p>
        <p><strong>Performance Data:</strong> Shot logs, game statistics, journal entries, and session data you input.</p>
        <p><strong>Device Data:</strong> Basic device type and browser for app optimization. We do not collect location data.</p>
        <h2 className="text-base font-bold text-text">2. How We Use Your Data</h2>
        <p>Your data is used solely to provide the Court IQ service: tracking your basketball performance, generating analytics, and storing your history. We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
        <h2 className="text-base font-bold text-text">3. Data Storage</h2>
        <p>Data is stored securely using Firebase (authentication) and Supabase (database) with encryption in transit and at rest. Row-level security ensures you can only access your own data.</p>
        <h2 className="text-base font-bold text-text">4. Data Retention</h2>
        <p>Your data is retained as long as your account is active. You may request deletion of your account and all associated data by contacting us.</p>
        <h2 className="text-base font-bold text-text">5. Children's Privacy</h2>
        <p>Court IQ is designed for basketball players of all ages. Users under 13 must have parental consent. We do not knowingly collect data from children under 13 without parental consent.</p>
        <h2 className="text-base font-bold text-text">6. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data. Contact us at privacy@pivottrainingdev.com to exercise these rights.</p>
        <h2 className="text-base font-bold text-text">7. Changes</h2>
        <p>We may update this policy. Continued use after changes constitutes acceptance.</p>
      </div>
    </div>
  );
}
