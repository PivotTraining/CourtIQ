"use client";

import dynamic from "next/dynamic";

const AuthCallback = dynamic(() => import("@/components/auth/AuthCallback"), { ssr: false });

export default function AuthCallbackPage() {
  return <AuthCallback />;
}
