"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

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
    let active = true;
    const pendingProfiles = new Set();
    // Resolve any existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setUser(session.user);
        // Supabase holds an auth lock during this callback. Start database work
        // after it returns so session/token access cannot deadlock sign-in.
        const timer = setTimeout(() => {
          pendingProfiles.delete(timer);
          if (active) loadProfile(session.user).finally(() => { if (active) setLoading(false); });
        }, 0);
        pendingProfiles.add(timer);
      } else {
        setUser(null);
        setPlayerProfile(null);
        setNeedsProfile(false);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      pendingProfiles.forEach(clearTimeout);
      subscription.unsubscribe();
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
