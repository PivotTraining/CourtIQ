/**
 * auth.js — formerly firebase.js
 * All authentication now goes through Supabase.
 * Firebase has been removed entirely. The same export names are kept so no
 * other file needs to change its imports.
 */
import { supabase } from "./supabase";

function isNativePlatform() {
  if (typeof window === "undefined") return false;
  return !!window.Capacitor?.isNativePlatform?.();
}

async function openBrowser(url) {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, windowName: "_self" });
  } catch {
    // Fallback for web or if plugin not available
    window.location.href = url;
  }
}

// ─── Email / Password ─────────────────────────────────────────────────────────

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function resetPassword(email) {
  const redirectTo = isNativePlatform()
    ? "com.pivottraining.courtiq://reset-password"
    : typeof window !== "undefined"
    ? `${window.location.origin}/login`
    : "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

async function signInWithOAuth(provider) {
  const redirectTo = isNativePlatform()
    ? "com.pivottraining.courtiq://login-callback"
    : typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      // On native we get back the URL and open it ourselves so the
      // Supabase client doesn't try to navigate.
      skipBrowserRedirect: isNativePlatform(),
    },
  });

  if (error) throw new Error(error.message);

  if (isNativePlatform() && data?.url) {
    await openBrowser(data.url);
  }
}

export async function signInWithGoogle() {
  return signInWithOAuth("google");
}

export async function signInWithApple() {
  return signInWithOAuth("apple");
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export async function checkRedirectResult() {
  // Called on app boot — resolves any in-flight OAuth session from a redirect.
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

// Legacy — callers that imported `auth` from firebase.js get the supabase client.
export { supabase as auth };
