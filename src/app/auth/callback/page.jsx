"use client";

import dynamic from "next/dynamic";

const AuthCallback = dynamic(() => import("@/components/auth/AuthCallback"), { ssr: false });

export default function AuthCallbackPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return <main style={{ minHeight: "100dvh", width: "100%", display: "grid", placeItems: "center", padding: 24 }}><div><h1>Sign in is temporarily unavailable</h1><a href="/" style={{ color: "var(--color-accent)" }}>Return to CourtIQ</a></div></main>;
  }
  return <AuthCallback />;
}
