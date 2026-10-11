"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/telemetry";

export default function MarketingCTA({ label = "Open CourtIQ", placement = "hero", className = "" }) {
  return (
    <Link
      href="/dashboard"
      className={className}
      onClick={() => { void trackEvent("marketing_cta_click", { source: placement }); }}
    >
      {label}
    </Link>
  );
}
