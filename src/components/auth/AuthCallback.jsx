"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [message, setMessage] = useState("Finishing sign in…");

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) {
        if (active) setMessage("This sign-in link is incomplete. Please return to Court IQ and try again.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth/callback] exchange failed:", error.message);
        if (active) setMessage("We could not complete sign in. Please return to Court IQ and try again.");
        return;
      }

      window.location.replace("/");
    }

    finishSignIn();
    return () => { active = false; };
  }, []);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <p role="status" style={{ textAlign: "center" }}>{message}</p>
    </main>
  );
}
