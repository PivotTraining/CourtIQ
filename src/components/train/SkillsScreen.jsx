'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { DRILL_BANK, DRILL_CATEGORIES, SKILL_LEVELS } from '@/lib/drillBank';
import { FEATURED_IDS, GUIDED_DRILLS, practiceHistory, previousPractice } from '@/lib/skillPractice.mjs';
import { fetchWorkoutResults, saveWorkoutResult } from '@/lib/queries';
import Icon from '@/components/ui/Icons';
import DrillWalkthrough from './DrillWalkthrough';
import SkillPracticeSession from './SkillPracticeSession';
import './skills.css';
const FEATURED = FEATURED_IDS.map(id => DRILL_BANK.find(drill => drill.id === id));
const EMPTY_HISTORY = { entries: [], categories: {} };

export default function SkillsScreen() {
  const { playerId } = useApp();
  return <SkillsWorkspace key={playerId || 'no-player'} playerId={playerId} />;
}

export function SkillsWorkspace({ playerId, preview = false, loadResults = fetchWorkoutResults, saveResult = saveWorkoutResult }) {
  const [tab, setTab] = useState('train'), [category, setCategory] = useState('all'), [level, setLevel] = useState('all'), [search, setSearch] = useState('');
  const [selected, setSelected] = useState(FEATURED[0]), [activeDrill, setActiveDrill] = useState(null);
  const [visibleCount, setVisibleCount] = useState(24);
  const [records, setRecords] = useState([]), [status, setStatus] = useState('loading'), [reload, setReload] = useState(0), [notice, setNotice] = useState('');
  const mounted = useRef(false), startButton = useRef(null);
  const persistenceEnabled = preview || process.env.NEXT_PUBLIC_TRACKER_RECOVERY_ENABLED === 'true';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!persistenceEnabled || !playerId) { setStatus('unavailable'); return; }
    let active = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    setStatus('loading');
    loadResults(playerId, { signal: controller.signal }).then(rows => { if (active) { setRecords(rows); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [playerId, persistenceEnabled, reload, loadResults]);
  const history = useMemo(() => status === 'ready' ? practiceHistory(records, DRILL_BANK) : EMPTY_HISTORY, [records, status]);
  const filtered = useMemo(() => DRILL_BANK.filter(drill => (category === 'all' || drill.category === category)
    && (level === 'all' || drill.level === level)
    && (!search.trim() || [drill.name, drill.description, ...drill.tags].join(' ').toLowerCase().includes(search.trim().toLowerCase()))), [category, level, search]);
  const nextCategory = status === 'ready' ? [...DRILL_CATEGORIES].sort((a, b) => (history.categories[a.id]?.reps || 0) - (history.categories[b.id]?.reps || 0))[0] : null;
  const closePractice = () => { setActiveDrill(null); startButton.current?.focus(); };
  const savePractice = async result => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    let saved;
    try { saved = await saveResult(playerId, result, { signal: controller.signal }); }
    finally { clearTimeout(timeout); }
    if (!saved?.id || saved.id !== result.id || saved.player_id !== playerId) throw new Error('Practice storage did not confirm this player and result.');
    if (mounted.current) {
      setRecords(rows => [saved, ...rows.filter(row => row.id !== saved.id)]);
      setNotice(`Saved ${result.drills[0].name}. Your practice result is in Progress.`);
    }
  };
  const selectDrill = drill => { setSelected(drill); setTab('train'); setNotice(''); };
  return <div className="skills-lab">
    <section className="skill-hero"><p className="skill-eyebrow">COURTIQ SKILL LAB</p><h2>Learn it. Rep it. Track it.</h2><p>See the movement, practice with a purpose, and build your own baseline.</p>
      <div className="skill-hero-stats"><span><strong>{FEATURED.length}</strong> guided walkthroughs</span><span><strong>{DRILL_BANK.length}</strong> playable drills</span></div>
    </section>
    <nav className="skill-tabs" aria-label="Skills views">{[['train', 'Train a skill'], ['library', 'Drill library'], ['progress', 'My progress']].map(([id, label]) => <button key={id} aria-pressed={id === tab} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {notice && <p className="skill-cue" role="status">{notice}</p>}
    {status === 'error' && <div className="skill-record-error" role="alert">Your practice history could not be loaded. It has not been cleared. <button onClick={() => setReload(value => value + 1)}>Retry history</button></div>}
    {tab === 'train' && <>
      <div className="skill-grid">{FEATURED.map(drill => {
        const cat = DRILL_CATEGORIES.find(item => item.id === drill.category);
        return <button key={drill.id} aria-pressed={selected.id === drill.id} className="skill-category" onClick={() => selectDrill(drill)}><Icon name={cat.iconName === 'forward' ? 'target' : cat.iconName} size={20} color={cat.color} /><strong>{cat.label}</strong><span>{status === 'ready' ? `${history.categories[cat.id]?.sessions || 0} saved workouts` : 'History unavailable'}</span></button>;
      })}</div>
      {nextCategory && <p className="skill-muted">Balance your practice: <button className="skill-text-link" onClick={() => selectDrill(FEATURED.find(drill => drill.category === nextCategory.id))}>{nextCategory.label}</button> has the least recorded rep volume. That is a practice suggestion, not a skill assessment.</p>}
      <article className="skill-lesson" aria-label={`Learn ${selected.name}`}>
        <div className="skill-lesson-heading"><div><p className="skill-eyebrow">{selected.level} · ~{selected.duration} min</p><h3>{selected.name}</h3></div><span>{selected.reps} {GUIDED_DRILLS[selected.id]?.unit || 'reps'}</span></div>
        <DrillWalkthrough key={selected.id} drill={selected} />
        <button ref={startButton} className="skill-primary" disabled={!playerId} onClick={() => { setNotice(''); setActiveDrill(selected); }}>Start practice</button>
        <p className="skill-muted">{persistenceEnabled ? 'Finish, then explicitly save your result. No camera or microphone is required.' : 'Practice is available, but saving is not activated in this environment.'}</p>
      </article>
    </>}
    {tab === 'library' && <>
      <label className="skill-search">Find your drill<input value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(24); }} placeholder="Search by move, skill, or coaching cue" type="search" /></label>
      <div className="skill-filters"><label>Skill<select value={category} onChange={event => { setCategory(event.target.value); setVisibleCount(24); }}><option value="all">All skills</option>{DRILL_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Level<select value={level} onChange={event => { setLevel(event.target.value); setVisibleCount(24); }}><option value="all">All levels</option>{SKILL_LEVELS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
      <p className="skill-muted" role="status">{filtered.length} drills · levels are difficulty guides, not age restrictions.</p>
      {filtered.slice(0, visibleCount).map(drill => <article className="skill-library-card" key={drill.id}><div><h3>{drill.name}</h3><p>{drill.level} · {drill.reps} reps · ~{drill.duration} min{GUIDED_DRILLS[drill.id] ? ' · visual walkthrough' : ''}</p></div><button onClick={() => selectDrill(drill)}>Learn & practice</button></article>)}
      {filtered.length > visibleCount && <button onClick={() => setVisibleCount(value => value + 24)}>Show more drills ({filtered.length - visibleCount} remaining)</button>}
      {!filtered.length && <p>No drills match those filters. Try another skill or search.</p>}
    </>}
    {tab === 'progress' && <section className="skill-progress"><h3>Your practice, backed by records</h3><p className="skill-muted">Volume is saved work. Accuracy is self-recorded. Neither proves improvement in competitive games.</p>
      {status === 'loading' ? <p role="status">Loading your practice history…</p> : status !== 'ready' ? <p>Progress is unavailable until your saved history can be loaded. No zero score or ranking is being assigned.</p> : <>
        <div className="skill-volume">{DRILL_CATEGORIES.map(cat => <div key={cat.id}><strong>{cat.label}</strong><span>{history.categories[cat.id]?.reps || 0} reps · {history.categories[cat.id]?.sessions || 0} workouts</span></div>)}</div>
        <h4>Recent measured practices</h4>
        {!history.entries.length && <p>No measured result yet. Older timer workouts contribute to volume, but do not invent accuracy scores. Start a drill, record each attempt, and save to establish a baseline.</p>}
        {history.entries.slice(0, 12).map((entry, index) => {
          const previous = history.entries.slice(index + 1).find(item => item.drill_id === entry.drill_id && item.target_reps === entry.target_reps && item.reps_completed === entry.target_reps && !item.skipped);
          const complete = entry.reps_completed === entry.target_reps && !entry.skipped;
          return <article className="skill-history-card" key={`${entry.workoutId}:${entry.drill_id}:${index}`}><div><h4>{entry.name}</h4><p>{new Date(entry.completed_at).toLocaleDateString()} · {entry.reps_completed}/{entry.target_reps} reps · {complete ? 'target completed' : 'partial practice'}</p><p>{entry.successful_reps} {entry.outcome_kind === 'makes' ? 'made' : 'clean'} · {entry.rate}% {entry.outcome_kind === 'makes' ? 'accuracy' : 'clean-rep rate'}</p></div><span>{complete && previous ? `${entry.rate - previous.rate > 0 ? '+' : ''}${entry.rate - previous.rate} pp` : complete ? 'Baseline' : 'Partial'}<small>{complete && previous ? 'vs last same target' : complete ? 'same drill + target' : 'no comparison'}</small></span></article>;
        })}
      </>}
    </section>}
    {activeDrill && <SkillPracticeSession key={`${playerId}:${activeDrill.id}`} drill={activeDrill} previous={previousPractice(history.entries, activeDrill)} canSave={persistenceEnabled && !!playerId && status === 'ready'} onSave={savePractice} onClose={closePractice} />}
  </div>;
}
