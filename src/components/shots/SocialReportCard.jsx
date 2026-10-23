"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { cardPng, socialCardSvg, SOCIAL_CARD_THEMES } from '@/lib/socialCard.mjs';
import { CARD_ENERGY_PHRASES, resolveCardEnergy } from '@/lib/cardEnergy.mjs';
import './report-media.css';

export default function SocialReportCard({
  report, playerName = '', date = '', opponent = '', sessionType = 'game', scope,
  defaultTitle = 'Player recap', kind = 'player', onClose,
}) {
  const [format, setFormat] = useState('square');
  const [theme, setTheme] = useState('midnight');
  // Privacy by default: never publish a minor's name or opponent automatically.
  const [includeName, setIncludeName] = useState(false);
  const [includeMatchup, setIncludeMatchup] = useState(false);
  const [energy, setEnergy] = useState('auto');
  const [png, setPng] = useState(null);
  const [pngUrl, setPngUrl] = useState(null);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const closeRef = useRef(null);
  const headline = resolveCardEnergy(report, { type: sessionType, choice: energy, kind });
  const svg = useMemo(() => socialCardSvg(report, {
    format, theme, title: includeName ? playerName : defaultTitle,
    date, opponent: includeMatchup ? opponent : '', type: sessionType, scope, energy, kind,
  }), [report, format, theme, includeName, playerName, defaultTitle, date, includeMatchup, opponent, sessionType, scope, energy, kind]);
  const readyPng = png?.svg===svg?png.blob:null;
  const downloadUrl = pngUrl?.svg===svg?pngUrl.url:'';

  useEffect(() => {
    let alive = true;
    setPng(null); setError('');
    cardPng(svg).then(blob => { if (alive) setPng({ blob, svg }); })
      .catch(() => { if (alive) setError('PNG could not generate. Try another browser. Your report is unchanged.'); });
    return () => { alive = false; };
  }, [svg]);
  useEffect(() => {
    if (!png) { setPngUrl(null); return; }
    const url = URL.createObjectURL(png.blob);
    setPngUrl({ url, svg: png.svg });
    return () => URL.revokeObjectURL(url);
  }, [png]);
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const key = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);

  async function share() {
    if (!readyPng) return;
    setSharing(true); setError('');
    try {
      const file = new File([readyPng], `courtiq-${format}-${theme}.png`, { type: 'image/png' });
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        setError('Sharing to an app is unavailable here. Download the PNG and post it yourself.');
        return;
      }
      await navigator.share({ files: [file], title: 'CourtIQ session recap' });
    } catch (err) {
      if (err.name !== 'AbortError') setError('Sharing was not completed. You can still download the card.');
    } finally { setSharing(false); }
  }

  return <div className="report-card-overlay" role="dialog" aria-modal="true" aria-label="Social stats card"
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll('button:not([disabled]),input,select,a[href]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className="report-card-panel">
      <div className="report-media-heading">
        <div><p className="report-card-eyebrow">COURTIQ · CREATE & SHARE</p><h3>Make your game look as good as it played.</h3></div>
        <button ref={closeRef} type="button" onClick={onClose}>Close</button>
      </div>
      <div className="report-card-options">
        <div className="report-media-controls">
          <label>Size
            <select value={format} onChange={event => setFormat(event.target.value)} aria-label="Card format">
              <option value="square">Feed post · 1080 × 1080</option>
              <option value="story">Story · 1080 × 1920</option>
            </select>
          </label>
          <label>Look
            <select value={theme} onChange={event => setTheme(event.target.value)} aria-label="Card theme">
              {SOCIAL_CARD_THEMES.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="report-media-controls">
          {playerName && <label className="report-checkbox"><input type="checkbox" checked={includeName} onChange={event => setIncludeName(event.target.checked)}/>Show player name</label>}
          {opponent && <label className="report-checkbox"><input type="checkbox" checked={includeMatchup} onChange={event => setIncludeMatchup(event.target.checked)}/>Show opponent</label>}
        </div>
        {kind === 'player' && <div className="report-media-controls">
          <label>Headline
            <select aria-label="Card energy" value={energy} onChange={event => setEnergy(event.target.value)}>
              <option value="auto">Choose from this game's stats</option>
              {CARD_ENERGY_PHRASES.map(phrase => <option key={phrase} value={phrase}>{phrase}</option>)}
              <option value="none">None · just the numbers</option>
            </select>
          </label>
        </div>}
        {kind === 'player' && <p className="report-media-note" aria-live="polite">
          {headline ? `${headline.automatic ? 'Auto headline' : 'Selected headline'}: ${headline.phrase} · ${headline.reason}` : 'No headline. Just the recorded numbers.'}
        </p>}
      </div>
      {/* Generated locally, with escaped strings and no external resources. */}
      <img className={`social-card-preview ${format}`} alt={`Preview of the ${theme} CourtIQ ${format} recap`}
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} width={1080} height={format === 'story' ? 1920 : 1080}/>{/* eslint-disable-line @next/next/no-img-element */}
      <div className="report-media-controls report-card-actions">
        {downloadUrl
          ? <a className="report-card-download" href={downloadUrl} download={`courtiq-${format}-${theme}.png`}>Download PNG</a>
          : <button disabled type="button">Preparing PNG…</button>}
        <button type="button" disabled={!readyPng || sharing} onClick={share}>{sharing ? 'Sharing…' : 'Share to an app'}</button>
      </div>
      <p className="report-media-note">Cards use recorded stats only. Player name and opponent are off until you choose them. Review before sharing, especially for minors. No videos, private notes or GPS details are included. CourtIQ never posts automatically.</p>
      {error && <p role="alert">{error}</p>}
    </div>
  </div>;
}
