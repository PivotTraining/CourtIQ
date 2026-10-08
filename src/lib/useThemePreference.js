'use client';

import { useEffect, useState } from 'react';

// The server and first browser render must agree. Read the device preference
// only after hydration, and do not overwrite it with the initial default.
export function useThemePreference() {
  const [dark, setDark] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDark(localStorage.getItem('courtiq-theme') !== 'light');
    } catch {
      // Storage is optional; the in-memory toggle remains usable.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('courtiq-theme', dark ? 'dark' : 'light');
    } catch {
      // Private browsing or blocked storage must not break appearance controls.
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#0F1117' : '#FF6B35';
  }, [dark, ready]);

  return [dark, setDark, ready];
}
