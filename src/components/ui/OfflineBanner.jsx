"use client";

import { useState, useEffect } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    if (typeof window !== "undefined" && !navigator.onLine) setOffline(true);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[998] bg-[#FEF3C7] border-b border-[#FDE68A] px-4 py-2.5 flex items-center justify-center gap-2 animate-fade-in">
      <span className="text-base">📡</span>
      <span className="text-xs font-bold text-[#92400E]">
        You're offline — stats will save when you reconnect
      </span>
    </div>
  );
}
