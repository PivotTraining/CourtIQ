"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function safeNextPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default function AuthCallback() {
  const [message, setMessage] = useState("Finishing sign in…");

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error_description") || params.get("error");
      if (oauthError) {
        if (active) setMessage(`Sign in was not completed: ${oauthError}`);
        return;
      }

      const code = params.get("code");
      if (!code) {
        if (active) setMessage("This sign-in link is incomplete. Return to CourtIQ and try again.");
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth/callback] exchange failed:", error.message);
        if (active) setMessage(`We could not complete sign in: ${error.message}`);
        return;
      }

      if (!data?.session) {
        if (active) setMessage("Sign in completed without a session. Return to CourtIQ and try again.");
        return;
      }

      const next = safeNextPath(params.get("next"));
      window.location.replace(next);
    }

    finishSignIn();
    return () => { active = false; };
  }, []);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p role="status">{message}</p>
        {message !== "Finishing sign in…" && (
          <a href="/dashboard" style={{ color: "#FF6B35", fontWeight: 700 }}>Return to CourtIQ</a>
        )}
      </div>
    </main>
  );
}
