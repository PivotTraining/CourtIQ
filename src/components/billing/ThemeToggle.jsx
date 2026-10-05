'use client';
import { useThemePreference } from '@/lib/useThemePreference';
export default function ThemeToggle() {
  const [dark, setDark, ready] = useThemePreference();
  return <button disabled={!ready} aria-label={dark?'Switch to light mode':'Switch to dark mode'} onClick={()=>setDark(value => !value)}>{dark?'Light mode':'Dark mode'}</button>;
}
