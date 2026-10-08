'use client';
import { useEffect, useState } from 'react';
import { practiceGuide } from '@/lib/skillPractice.mjs';

export default function DrillWalkthrough({ drill }) {
  const guide = practiceGuide(drill);
  const [step, setStep] = useState(0), [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setStep(value => (value + 1) % guide.steps.length), 2400);
    return () => clearInterval(timer);
  }, [playing, guide.steps.length]);
  const current = guide.steps[step];
  const ball = ['handles', 'passing'].includes(guide.scene) || ['shooting', 'finishing'].includes(drill.category);
  return <div className="skill-walkthrough">
    {guide.scene && <div className={`skill-diagram ${playing ? 'is-playing' : ''}`}>
      <svg viewBox="0 0 320 200" role="img" aria-label={`${drill.name}: ${current[0]}. ${ball ? 'Orange dot is the ball' : 'Blue dot is the player'}. Diagram is not to scale.`}>
        <rect x="20" y="18" width="280" height="164" rx="12" fill="none" stroke="currentColor" opacity=".3" />
        {guide.scene === 'court' && <g fill="none" stroke="currentColor" opacity=".5">
          <path d="M120 20V110H200V20M145 35H175" /><circle cx="160" cy="50" r="10" /><path d="M55 20V65Q160 245 265 65V20" />
        </g>}
        {guide.scene === 'lines' && <g stroke="currentColor" opacity=".4">{[40, 80, 120, 160].map(y => <line key={y} x1="30" x2="290" y1={y} y2={y} />)}</g>}
        {guide.scene === 'ladder' && <g stroke="currentColor" opacity=".6"><path d="M125 30V170M195 30V170" />{[30, 58, 86, 114, 142, 170].map(y => <line key={y} x1="125" x2="195" y1={y} y2={y} />)}</g>}
        {guide.scene === 'handles' && <g fill="none" stroke="currentColor" strokeWidth="5" opacity=".45"><circle cx="160" cy="47" r="14" /><path d="M160 65V108M160 80L90 115M160 80L230 115M160 108L115 165M160 108L205 165" /></g>}
        {guide.scene === 'passing' && <g fill="var(--color-text-sec)" opacity=".5"><circle cx="75" cy="85" r="13" /><circle cx="245" cy="85" r="13" /><rect x="64" y="102" width="22" height="40" rx="9" /><rect x="234" y="102" width="22" height="40" rx="9" /></g>}
        {drill.category === 'rebounding' && <circle cx="160" cy="134" r="12" fill="none" stroke="currentColor" strokeDasharray="4 3" />}
        <path className="skill-route" d={`M${current[2][0]} ${current[2][1]}L${current[3][0]} ${current[3][1]}`} fill="none" stroke={ball ? '#f97316' : '#3b82f6'} strokeWidth="4" strokeDasharray="7 5" />
        <circle cx={current[2][0]} cy={current[2][1]} r="9" fill="none" stroke={ball ? '#f97316' : '#3b82f6'} strokeWidth="2" />
        <circle cx={current[3][0]} cy={current[3][1]} r="10" fill={ball ? '#f97316' : '#3b82f6'} />
      </svg>
      <span>{ball ? 'Orange = ball' : 'Blue = player'} · dashed line = movement · not to scale</span>
    </div>}
    <div className="skill-step-controls" aria-label="Coaching steps">{guide.steps.map(([title], index) => <button key={title} aria-pressed={index === step} onClick={() => { setPlaying(false); setStep(index); }}>Step {index + 1}</button>)}
      {guide.scene && <button aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause walkthrough' : 'Play walkthrough'}</button>}
    </div>
    <h4>{current?.[0]}</h4><p>{current?.[1]}</p>
    <p className="skill-muted">Setup: {guide.equipment}</p>
    {drill.videoTip && <p className="skill-cue"><strong>Coaching cue</strong> {drill.videoTip}</p>}
  </div>;
}
