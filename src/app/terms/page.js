export default function TermsPage() {
  return (
    <div className="max-w-[520px] mx-auto px-6 py-8 min-h-screen bg-bg">
      <a href="/" className="text-accent text-sm font-bold mb-4 inline-block">&larr; Back</a>
      <h1 className="text-2xl font-black text-text mb-4">Terms of Service</h1>
      <p className="text-xs text-text-sec mb-2">Last updated: March 24, 2026</p>
      <div className="text-sm text-text-sec leading-relaxed flex flex-col gap-4">
        <p>Welcome to Court IQ, a product of Pivot Training and Development. By using our app, you agree to these terms.</p>
        <h2 className="text-base font-bold text-text">1. Use of Service</h2>
        <p>Court IQ is a basketball performance tracking tool. You must be at least 13 years old (or have parental consent) to use the service. You are responsible for maintaining the security of your account.</p>
        <h2 className="text-base font-bold text-text">2. User Data</h2>
        <p>You retain ownership of all data you input into Court IQ including shot logs, journal entries, and performance statistics. We store this data to provide the service and will not sell your personal data to third parties.</p>
        <h2 className="text-base font-bold text-text">3. Acceptable Use</h2>
        <p>You agree not to misuse the service, attempt to access other users' data, or use the app for any purpose other than its intended basketball tracking functionality.</p>
        <h2 className="text-base font-bold text-text">4. Service Availability</h2>
        <p>We strive to keep Court IQ available at all times but do not guarantee uninterrupted service. We may update, modify, or discontinue features with reasonable notice.</p>
        <h2 className="text-base font-bold text-text">5. Limitation of Liability</h2>
        <p>Court IQ is provided "as is." We are not liable for any data loss, inaccurate statistics, or decisions made based on app data. Always maintain your own records for important statistics.</p>
        <h2 className="text-base font-bold text-text">6. Contact</h2>
        <p>Questions about these terms? Contact us at support@pivottrainingdev.com.</p>
      </div>
    </div>
  );
}
