"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_CHOICE_EVENT, getAnalyticsChoice, setAnalyticsChoice,
} from "@/lib/analyticsConsent.mjs";

function availableStorage() {
  try { return window.localStorage; } catch { return null; }
}

export default function AnalyticsPreferences({ alwaysShow = false }) {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [choice, setChoice] = useState(null);

  useEffect(() => {
    const refresh = () => setChoice(getAnalyticsChoice(availableStorage()));
    refresh();
    setHydrated(true);
    window.addEventListener("storage", refresh);
    window.addEventListener(ANALYTICS_CHOICE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ANALYTICS_CHOICE_EVENT, refresh);
    };
  }, []);

  const decide = value => {
    if (setAnalyticsChoice(availableStorage(), value)) {
      setChoice(value);
      window.dispatchEvent(new Event(ANALYTICS_CHOICE_EVENT));
    } else {
      // The failure mode must never silently enable optional analytics.
      setChoice(null);
    }
  };

  if (!hydrated || (!alwaysShow && (choice !== null || pathname === "/privacy"))) return null;

  return (
    <section
      id={alwaysShow ? "analytics-preferences" : undefined}
      className={alwaysShow ? "courtiq-analytics-settings" : "courtiq-analytics-banner"}
      aria-label="CourtIQ analytics privacy choices"
    >
      <div className="courtiq-analytics-content">
        <strong>{alwaysShow ? "Optional analytics settings" : "Your privacy choices"}</strong>
        <p>
          CourtIQ uses essential sign-in storage to run your account. Optional, first-party
          usage measurements are off until you allow them. We measure feature and button
          events, not player names, journals, shot records or video.
        </p>
        {alwaysShow && <p role="status">
          Current choice: {choice === "allow" ? "Allow optional analytics" : choice === "essential" ? "Essential only" : "Not chosen"}
        </p>}
        {!alwaysShow && <Link href="/privacy#analytics-preferences">Privacy details</Link>}
      </div>
      <div className="courtiq-analytics-actions">
        <button type="button" onClick={() => decide("essential")} className="courtiq-analytics-secondary">
          Essential only
        </button>
        <button type="button" onClick={() => decide("allow")} className="courtiq-analytics-primary">
          Allow analytics
        </button>
      </div>
    </section>
  );
}
