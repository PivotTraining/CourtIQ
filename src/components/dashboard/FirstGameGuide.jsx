"use client";

import { useEffect, useState } from 'react';
import './first-game-guide.css';

// This is instructional UI only. It never creates a player, session,
// subscription, entitlement, or recording without a deliberate user action.
const STEPS = [
  { number: '01', title: 'Choose your athlete', description: 'Use the player name at the top of the dashboard to select the child whose game you are tracking.' },
  { number: '02', title: 'Start a game', description: 'Tap Start game and enter the opponent. You can add the score or game details later.' },
  { number: '03', title: 'Tap to track', description: 'Choose a shot location and tap Made or Missed. Assist, Rebound, Steal, Block, Turnover and Foul buttons add one stat with each tap. Undo fixes your last entry.' },
  { number: '04', title: 'Save and review', description: 'End the game to save stats. Find it in Game Log or Sessions. If you record film, 30-second clips save on this browser/device; download a copy to Files or Photos for backup.' },
];
export const guideKey = accountId => accountId ? `courtiq-first-game-guide-v1:${accountId}` : '';
function hasAcknowledged(accountId) {
  if (!accountId || typeof window === 'undefined') return true;
  try { return window.localStorage.getItem(guideKey(accountId)) === 'done'; } catch { return false; }
}
export default function FirstGameGuide({ accountId, hasSessions, historyReady = false, hasPlayer = false,
  onStartGame = () => {}, onSelectPlayer = () => {}, onOpenGames = () => {} }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(false);
    setOpen(historyReady && !hasSessions && !hasAcknowledged(accountId));
  }, [accountId, historyReady, hasSessions]);
  const close = () => {
    setOpen(false); setDismissed(true);
    if (accountId && typeof window !== 'undefined') {
      try { window.localStorage.setItem(guideKey(accountId), 'done'); } catch { /* private browsing */ }
    }
  };
  const begin = () => { close(); hasPlayer ? onStartGame() : onSelectPlayer(); };
  return <section className="first-game-guide" aria-label="Getting started with CourtIQ">
    <div className="first-game-guide-heading">
      <div>
        <span className="first-game-guide-eyebrow">GETTING STARTED</span>
        <h2>{!hasSessions && historyReady ? 'Your first game, made simple' : 'Need a quick refresher?'}</h2>
      </div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {open ? 'Hide guide' : 'How to use CourtIQ'}
      </button>
    </div>
    {open && <div className="first-game-guide-body">
      <p className="first-game-guide-intro">Four steps to turn a game into useful performance history. No complicated setup.</p>
      <ol>
        {STEPS.map(item => <li key={item.number}>
          <span aria-hidden="true">{item.number}</span>
          <div><strong>{item.title}</strong><p>{item.description}</p></div>
        </li>)}
      </ol>
      <div className="first-game-guide-actions">
        <button type="button" className="first-game-guide-primary" onClick={begin}>
          {hasPlayer ? 'Start tracking a game' : 'Choose a player'}
        </button>
        <button type="button" onClick={() => { close(); onOpenGames(); }}>See saved games</button>
        <button type="button" onClick={close}>Got it</button>
      </div>
      <p className="first-game-guide-footnote">Recording video is optional, requires permission, and is not automatically backed up to the cloud or phone Photos.</p>
    </div>}
  </section>;
}
