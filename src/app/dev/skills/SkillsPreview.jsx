'use client';
import { useState } from 'react';
import { SkillsWorkspace } from '@/components/train/SkillsScreen';
import { useThemePreference } from '@/lib/useThemePreference';
import { skillResult } from '@/lib/skillPractice.mjs';
import { DRILL_BANK } from '@/lib/drillBank';
const shooting = DRILL_BANK.find(drill => drill.id === 'form-shooting-close');
const rows = [{ ...skillResult({ drill: shooting, outcomes: Array.from({ length: 30 }, (_, i) => i < 18), elapsedSeconds: 180, id: 'sample-practice' }), completed_at: '2026-10-07T12:00:00Z', player_id: 'sample-player' }];
let sampleRows = [...rows];
const loadResults = async () => sampleRows;
const saveResult = async (playerId, result) => { const saved = { ...result, player_id: playerId, completed_at: new Date().toISOString() }; sampleRows = [saved, ...sampleRows.filter(row => row.id !== result.id)]; return saved; };
export default function SkillsPreview() {
  const [dark, setDark] = useThemePreference();
  const [owner, setOwner] = useState('sample-player');
  return <main className={dark ? 'courtiq-dark' : ''} style={{ minHeight: '100dvh', background: 'var(--color-bg)', padding: 16 }}>
    <div style={{ maxWidth: 520, margin: 'auto' }}><p>Local sample only. Saves stay in memory, disappear on reload, and never reach Supabase.</p>
      <button onClick={() => setDark(value => !value)}>Switch to {dark ? 'light' : 'dark'} theme</button>
      <button onClick={() => setOwner(value => value === 'sample-player' ? 'sample-other' : 'sample-player')}>Switch sample player</button>
      <SkillsWorkspace key={owner} playerId={owner} preview loadResults={asyncLoad} saveResult={saveResult} />
    </div>
  </main>;
}
async function asyncLoad(playerId) { return (await loadResults()).filter(row => row.player_id === playerId); }
