'use client';
import { useEffect, useState } from 'react';
import { fetchManagedPlayers, fetchSessionHistory, fetchJournalEntries, fetchWorkoutResults } from '@/lib/queries';
import { COURT_ZONES } from '@/lib/constants';
import { buildSessionReport, sessionReportCsv } from '@/lib/sessionReport.mjs';
import { downloadBlob } from '@/lib/browserDownload.mjs';

export default function SavedRecords({ accountId, onBack }) {
  const [players, setPlayers] = useState([]), [selected, setSelected] = useState(''), [records, setRecords] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    fetchManagedPlayers(accountId).then(next => { if (current) { setPlayers(next); setSelected(next[0]?.id || ''); } }).catch(() => { if (current) setError('Saved profiles could not load. Please retry.'); });
    return () => { current = false; };
  }, [accountId, retry]);
  useEffect(() => {
    let current = true;
    if (!selected) return;
    setRecords(null); setError('');
    Promise.all([fetchSessionHistory(selected), fetchJournalEntries(selected), fetchWorkoutResults(selected)]).then(([sessions, journal, workouts]) => {
      if (current) setRecords({ sessions, journal, workouts });
    }).catch(() => { if (current) setError('Your saved records could not load. Nothing was deleted. Please retry.'); });
    return () => { current = false; };
  }, [selected, retry]);
  const exportGame = session => {
    try { downloadBlob(new Blob([sessionReportCsv(buildSessionReport(session.shot_logs, session.game_stats, COURT_ZONES), { type: session.type, date: session.date, playerName: players.find(p => p.id === selected)?.name })], { type: 'text/csv;charset=utf-8' }), 'courtiq-saved-report.csv'); }
    catch { setError('The download could not complete. Your records are still here.'); }
  };
  return <main className="membership-start">
    <button onClick={onBack}>Back to free starter</button><h1 style={{ fontSize: 28, fontWeight: 850 }}>Your saved records are still yours.</h1>
    <p>Read-only history. No new games, workouts or journal entries are created here.</p>
    {error && <><p role="alert">{error}</p><button onClick={() => setRetry(n => n + 1)}>Retry history</button></>}
    <label>Saved player <select value={selected} onChange={e => setSelected(e.target.value)} style={{ width: '100%', padding: 12, background: 'var(--color-card)', color: 'var(--color-text)' }}>{players.map(player => <option value={player.id} key={player.id}>{player.name}</option>)}</select></label>
    {records ? <>
      <section className="starter-panel"><h2>Sessions · {records.sessions.length}</h2>{records.sessions.map(session => <div key={session.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}><p>{session.date} · {session.type} · {session.shot_logs.length} logged shots</p><button onClick={() => exportGame(session)}>Export saved report</button></div>)}{!records.sessions.length && <p>No saved sessions.</p>}</section>
      <section className="starter-panel"><h2>Journal history · {records.journal.length}</h2>{records.journal.map(entry => <article key={entry.id} style={{ marginTop: 16 }}><p>{entry.date} · {entry.mood}</p><h3>{entry.title}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{entry.body}</p></article>)}</section>
      <section className="starter-panel"><h2>Workout history · {records.workouts.length}</h2>{records.workouts.map(workout => <p key={workout.id}>{workout.completed_at?.slice(0, 10)} · {workout.elapsed_seconds} seconds · {workout.drills?.length || 0} drills</p>)}</section>
    </> : <p role="status">{players.length ? 'Loading saved history…' : 'No saved profiles to show yet.'}</p>}
  </main>;
}
