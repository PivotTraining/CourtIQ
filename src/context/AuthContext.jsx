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

  async function loadProfile(supabaseUser) {
    const { data: profile } = await supabase
      .from("players")
      .select("*")
      .eq("firebase_uid", supabaseUser.id)
      .single();

    if (profile) {
      setPlayerProfile(profile);
      setNeedsProfile(false);
    } else {
      setNeedsProfile(true);
    }
  }

  useEffect(() => {
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
        .then(({ App }) => {
          App.addListener("appUrlOpen", async ({ url }) => {
            if (url.includes("login-callback") || url.includes("access_token") || url.includes("code=")) {
              const { error } = await supabase.auth.exchangeCodeForSession(url);
              if (error) console.error("[Auth] exchangeCodeForSession error:", error.message);
              closeBrowser();
            }
          });
        })
        .catch(() => {});
    }

    return () => subscription.unsubscribe();
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
