/**
 * auth.js — formerly firebase.js
 * CourtIQ is web-first and authentication is handled by Supabase.
 */
import { supabase } from "./supabase";

function browserOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
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
  const origin = browserOrigin();
  if (!origin) throw new Error("Password reset is only available in the browser.");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?mode=reset`,
  });
  if (error) throw new Error(error.message);
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

async function signInWithOAuth(provider) {
  const origin = browserOrigin();
  if (!origin) throw new Error("Social sign in is only available in the browser.");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=%2Fdashboard`,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error(`Could not start ${provider} sign in.`);

  window.location.assign(data.url);
  return data;
}

export async function signInWithGoogle() {
  return signInWithOAuth("google");
}

export async function signInWithApple() {
  return signInWithOAuth("apple");
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export async function checkRedirectResult() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data?.session ?? null;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export { supabase as auth };
