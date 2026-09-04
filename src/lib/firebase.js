/**
 * auth.js — formerly firebase.js
 * CourtIQ is web-first and authentication is handled by Supabase.
 */
import { supabase } from "./supabase";

function browserOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, key };
}

export async function checkAuthBackend({ timeoutMs = 5000 } = {}) {
  const { url, key } = authConfig();

  if (!url || !key) {
    return { ok: false, reason: "missing_config" };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "invalid_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${parsed.origin}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: key },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }

    return { ok: true, reason: "healthy" };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === "AbortError" ? "timeout" : "unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function requireAuthBackend() {
  const health = await checkAuthBackend();
  if (!health.ok) {
    console.error("[CourtIQ auth] backend health check failed:", health.reason);
    throw new Error(
      "CourtIQ sign in is temporarily unavailable because the authentication service cannot be reached. Please try again shortly."
    );
  }
}

// ─── Email / Password ─────────────────────────────────────────────────────────

export async function signInWithEmail(email, password) {
  await requireAuthBackend();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signUpWithEmail(email, password) {
  await requireAuthBackend();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function resetPassword(email) {
  const origin = browserOrigin();
  if (!origin) throw new Error("Password reset is only available in the browser.");

  await requireAuthBackend();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?mode=reset`,
  });
  if (error) throw new Error(error.message);
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

async function signInWithOAuth(provider) {
  const origin = browserOrigin();
  if (!origin) throw new Error("Social sign in is only available in the browser.");

  await requireAuthBackend();

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
