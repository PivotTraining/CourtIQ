'use client';
import Icon from './ui/Icons';
import './gametime-action.css';

export default function GametimeAction({ onStart }) {
  return <button type="button" className="courtiq-gametime-action" onClick={onStart} aria-label="GAMETIME — Record stats">
    <Icon name="basketball" size={26} color="currentColor" />
    <span><strong>GAMETIME</strong><small>Record stats</small></span>
    <span className="gametime-action-arrow" aria-hidden="true">→</span>
  </button>;
}
