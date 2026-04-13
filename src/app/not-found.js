export default function NotFound() {
  return (
    <div className="w-full min-h-screen bg-bg flex flex-col items-center justify-center px-8 text-center">
      <div style={{ fontSize: 64 }} className="mb-4">🏀</div>
      <h1 className="t-title1 text-text mb-2">Air Ball</h1>
      <p className="t-body text-text-sec mb-8" style={{ maxWidth: 280 }}>
        That page doesn't exist. Let's get you back on the court.
      </p>
      <a href="/" className="btn-primary" style={{ maxWidth: 240, textDecoration: "none", display: "inline-flex" }}>
        Back to Court IQ
      </a>
    </div>
  );
}
