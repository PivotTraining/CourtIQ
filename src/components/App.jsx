"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { registerServiceWorker, scheduleStreakReminder } from "@/lib/notifications";
import { AppProvider } from "@/context/AppContext";
import { ToastProvider } from "@/components/ui/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/ui/OfflineBanner";
import Onboarding from "@/components/Onboarding";
import Shell from "@/components/Shell";
import LoginScreen from "@/components/auth/LoginScreen";
import ProfileSetup from "@/components/auth/ProfileSetup";

function LoadingScreen() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center" style={{ background: "linear-gradient(160deg, #FF6B35 0%, #E85A2A 100%)" }}>
      <div className="animate-count-reveal">
        <img src="/logo.svg" alt="Court IQ" style={{ width: 80, height: 80, borderRadius: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }} className="mb-4 mx-auto block" />
        <div className="t-title3 text-white text-center" style={{ opacity: 0.95 }}>Court IQ</div>
        <div className="t-footnote text-center mt-2" style={{ color: "rgba(255,255,255,0.6)" }}>Track your game. Sharpen your mind.</div>
      </div>
      {/* Loading indicator */}
      <div className="mt-8">
        <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AuthGate() {
  const { user, loading, needsProfile } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("courtiq-onboarded")) {
      setShowOnboarding(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem("courtiq-onboarded", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding) return <Onboarding onComplete={completeOnboarding} />;
  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  if (needsProfile) return <ProfileSetup />;

  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

export default function App() {
  useEffect(() => {
    registerServiceWorker();
    // Check streak reminder after 5 seconds
    const t = setTimeout(scheduleStreakReminder, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <OfflineBanner />
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
