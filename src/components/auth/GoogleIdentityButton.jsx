"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// Google Identity Services signs in on the app origin and passes the ID token
// to Supabase without routing Google's consent screen through *.supabase.co.
// Keep this disabled until the Google OAuth Client ID, authorised JS origins,
// and real iPhone/Android signup checks are verified.
export default function GoogleIdentityButton({ clientId, onError, onSuccess }) {
  const targetRef = useRef(null);
  const isMounted = useRef(false);
  const initializedRef = useRef(false);
  const busyRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; initializedRef.current = false; };
  }, []);

  const initialize = useCallback(async () => {
    if (!clientId || initializedRef.current || !targetRef.current || !window.google?.accounts?.id) return;
    try {
      if (!window.crypto?.subtle || !window.crypto?.getRandomValues) throw new Error("Secure sign-in requires HTTPS.");
      const nonceBytes = window.crypto.getRandomValues(new Uint8Array(32));
      const nonce = Array.from(nonceBytes, b => String.fromCharCode(b)).join("");
      const nonceBase64 = btoa(nonce);
      const hash = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonceBase64));
      const hashedNonce = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
      if (!isMounted.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce: hashedNonce,
        auto_select: false,
        ux_mode: "popup",
        callback: async response => {
          if (busyRef.current || !response?.credential) return;
          busyRef.current = true;
          try {
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: "google", token: response.credential, nonce: nonceBase64,
            });
            if (error) throw error;
            if (!data?.session?.user) throw new Error("Google did not establish an authenticated CourtIQ session.");
            onSuccess?.(data);
          } catch {
            onError?.("Could not complete Google sign-in. Try again or use the alternative sign-in method.");
          } finally { busyRef.current = false; }
        },
      });
      // Google owns this button. It is not an imitation or a programmatic click.
      targetRef.current.replaceChildren();
      window.google.accounts.id.renderButton(targetRef.current, {
        theme: "outline", size: "large", type: "standard", shape: "rectangular",
        text: "continue_with", width: 300, logo_alignment: "left",
      });
      initializedRef.current = true;
      setReady(true);
    } catch {
      onError?.("Google sign-in couldn't load in this browser. Use the alternative sign-in method.");
    }
  }, [clientId, onError, onSuccess]);

  return <div aria-label="Continue with Google using Google's official sign-in">
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={initialize} onError={() => onError?.("Google sign-in couldn't load.")} />
    <div ref={targetRef} style={{ minHeight: 45, display: "grid", placeItems: "center" }} />
    {!ready && <p role="status" style={{ fontSize: 12, textAlign: "center" }}>Loading secure Google sign-in…</p>}
  </div>;
}
