import Link from "next/link";
import { publicPageMetadata } from "@/lib/siteMetadata";

export const metadata = publicPageMetadata({
  title: "Support",
  description: "Get help with CourtIQ accounts, privacy, access, and public beta questions.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <div className="max-w-[680px] mx-auto px-6 py-10 min-h-screen bg-bg">
      <Link href="/" className="text-accent text-sm font-bold mb-4 inline-block">&larr; Back</Link>
      <h1 className="text-2xl font-black text-text mb-2">CourtIQ Support</h1>
      <p className="text-sm text-text-sec mb-6">CourtIQ is currently operating as a public beta web application.</p>

      <div className="text-sm text-text-sec leading-relaxed flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-text">Account access</h2>
          <p>For sign-in, confirmation-email, or password-recovery problems, include “CourtIQ Support” in your message and describe the step that is failing. Do not send your password.</p>
          <a
            href="mailto:Hello@PivotTraining.us?subject=CourtIQ%20Support"
            className="text-accent font-bold underline underline-offset-4"
          >
            Email CourtIQ support through Pivot Training
          </a>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-text">Account deletion</h2>
          <p>During the public beta, account deletion requests are queued for manual processing. In CourtIQ, open Settings, edit your profile, and choose <strong>Request Account Deletion</strong>. Submitting a request does not delete the account immediately.</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-text">Privacy and data requests</h2>
          <p>For access, correction, export, or privacy questions, use the support email above and put “CourtIQ Privacy” in the subject. Do not include passwords, private journal text, or raw video in the message.</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-text">Before reporting a bug</h2>
          <p>Include the device and browser you are using, the CourtIQ screen involved, and what happened immediately before the problem. Screenshots are helpful when they do not expose private player information.</p>
        </section>

        <div className="pt-2 flex gap-4 flex-wrap">
          <Link href="/privacy" className="text-accent font-bold">Privacy Policy</Link>
          <Link href="/terms" className="text-accent font-bold">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}
