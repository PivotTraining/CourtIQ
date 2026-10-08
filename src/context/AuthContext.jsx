"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { fetchManagedPlayers } from "@/lib/queries";
import { selectPlayer, preferredPlayer, rememberPlayer } from "@/lib/playerSelection.mjs";
import { clearAccountRecovery, hasPendingRecovery } from '@/lib/sessionRecovery.mjs';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [playerProfile, updatePlayerProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const identity = useRef(null);
  const profileRef = useRef(null);
  const requestVersion = useRef(0);
  const inFlight = useRef(null);

  const setPlayerProfile = (profile) => {
    profileRef.current = profile;
    updatePlayerProfile(profile);
    if (profile && identity.current) rememberPlayer(identity.current, profile.id);
  };

  async function loadProfile(supabaseUser) {
    const version = ++requestVersion.current;
    setProfileError(null);
    try {
      const players = await fetchManagedPlayers(supabaseUser.id);
      if (version !== requestVersion.current || identity.current !== supabaseUser.id) return false;
      const profile = selectPlayer(players, supabaseUser.id, profileRef.current?.id || preferredPlayer(supabaseUser.id));
      setPlayerProfile(profile);
      setNeedsProfile(!profile);
      return true;
    } catch {
      if (version !== requestVersion.current || identity.current !== supabaseUser.id) return false;
      setProfileError("We couldn't load your player profiles. Your records have not been cleared. Check your connection and try again.");
      setPlayerProfile(null);
      setNeedsProfile(false);
      return true;
    }
  }

  useEffect(() => {
    let active = true;
    let authRevision = 0;
    const pendingProfiles = new Set();
    const acceptSession = (session) => {
      if (!active) return;
      if (!session?.user) {
        identity.current = null;
        requestVersion.current += 1;
        inFlight.current = null;
        setUser(null);
        setPlayerProfile(null);
        setNeedsProfile(false);
        setProfileError(null);
        setLoading(false);
        return;
      }
      const nextUser = session.user;
      if (identity.current === nextUser.id && (profileRef.current || inFlight.current === nextUser.id)) return;
      if (identity.current !== nextUser.id) {
        requestVersion.current += 1;
        profileRef.current = null;
        updatePlayerProfile(null);
      }
      identity.current = nextUser.id;
      inFlight.current = nextUser.id;
      setUser(nextUser);
      setLoading(true);
      // Start database work after the auth callback releases its SDK lock.
      const timer = setTimeout(() => {
        pendingProfiles.delete(timer);
        if (!active || identity.current !== nextUser.id) return;
        loadProfile(nextUser).then(applied => {
          if (active && applied && identity.current === nextUser.id) {
            inFlight.current = null;
            setLoading(false);
          }
        });
      }, 0);
      pendingProfiles.add(timer);
    };
    // Resolve any existing session on mount
    const bootstrapRevision = authRevision;
    supabase.auth.getSession().then(({ data: { session } }) => {
      // A login/logout event is newer than the initial cached-session request.
      // Never let that delayed request restore a departed or different account.
      if (active && bootstrapRevision === authRevision) acceptSession(session);
    }).catch(() => {
      if (active && bootstrapRevision === authRevision) setLoading(false);
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      authRevision += 1;
      if (_event === 'SIGNED_OUT') {
        // Auth expiry is not permission to discard unsynced work. Its account-scoped
        // key can only be resumed by this same identity after signing in again.
        try {
          if (!hasPendingRecovery(window.localStorage, identity.current)) clearAccountRecovery(window.localStorage, identity.current);
        } catch { /* storage unavailable: retain recovery data */ }
      }
      acceptSession(session);
    });

    return () => {
      active = false;
      requestVersion.current += 1;
      inFlight.current = null;
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
          const applied = await loadProfile(user);
          if (applied && identity.current === user.id) setLoading(false);
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
