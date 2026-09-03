"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

function isNativePlatform() {
  if (typeof window === "undefined") return false;
  return !!window.Capacitor?.isNativePlatform?.();
}

async function closeBrowser() {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);

  async function loadProfile(supabaseUser) {
    setProfileError(null);
    const { data: profile, error } = await supabase
      .from("players")
      .select("*")
      .eq("firebase_uid", supabaseUser.id)
      .maybeSingle();

    if (error) {
      setProfileError("We couldn't load your player profile. Check your connection and try again.");
      setPlayerProfile(null);
      setNeedsProfile(false);
      return;
    }

    if (profile) {
      setPlayerProfile(profile);
      setNeedsProfile(false);
    } else {
      setNeedsProfile(true);
    }
  }

  useEffect(() => {
    let appUrlListener;
    // Resolve any existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user);
        // After OAuth completes on native, close the in-app browser
        if (event === "SIGNED_IN" && isNativePlatform()) {
          closeBrowser();
        }
      } else {
        setUser(null);
        setPlayerProfile(null);
        setNeedsProfile(false);
      }
      setLoading(false);
    });

    // Native deep-link handler — fired when the app is opened via the
    // com.pivottraining.courtiq://login-callback URL after OAuth.
    if (isNativePlatform()) {
      import("@capacitor/app")
        .then(async ({ App }) => {
          appUrlListener = await App.addListener("appUrlOpen", async ({ url }) => {
            if (url.includes("login-callback") || url.includes("access_token") || url.includes("code=")) {
              const code = new URL(url).searchParams.get("code");
              if (code) {
                // PKCE flow — exchange the auth code for a session.
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) console.error("[Auth] exchangeCodeForSession error:", error.message);
              }
              closeBrowser();
            }
          });
        })
        .catch(() => {});
    }

    return () => {
      subscription.unsubscribe();
      appUrlListener?.remove();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        playerProfile,
        setPlayerProfile,
        loading,
        needsProfile,
        setNeedsProfile,
        profileError,
        retryProfile: async () => {
          if (!user) return;
          setLoading(true);
          await loadProfile(user);
          setLoading(false);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
