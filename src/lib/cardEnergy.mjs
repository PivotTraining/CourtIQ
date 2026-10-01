export const CARD_ENERGY_PHRASES = Object.freeze([
  'It Was Lit', 'Hustle Man', 'Board Man Gets Paid', 'Major Aura',
  'Work Gone Show', 'Work To Do', 'Stay Focused', 'Only One Game', 'Oh Brother',
]);

// Captions describe this recorded session, never talent, improvement or a season.
// Shooting captions require eight attempts; one made shot is not a hot night.
export function playerCardEnergy(report, { type = 'game' } = {}) {
  const n = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const box = report?.box ?? {};
  const pts = n(report?.pts), fga = n(report?.fga), fgm = n(report?.fgm);
  const reb = n(box.reb), ast = n(box.ast), stl = n(box.stl), blk = n(box.blk), turnovers = n(box.to);
  const pick = (phrase, reason) => ({ phrase, reason });
  if (type === 'game' && [pts, reb, ast, stl, blk].filter(value => value >= 10).length >= 2)
    return pick('Major Aura', 'Double figures in two recorded categories.');
  if (type === 'game' && pts >= 20 && fga >= 8 && fgm / fga >= .5)
    return pick('It Was Lit', '20+ recorded points with at least 50% shooting on 8+ attempts.');
  if (type === 'game' && reb >= 10)
    return pick('Board Man Gets Paid', '10+ recorded rebounds.');
  if (type === 'game' && (stl + blk >= 3 || n(box.oreb) >= 3))
    return pick('Hustle Man', '3+ recorded steals and blocks combined, or offensive rebounds.');
  if (type === 'game' && fga >= 8 && turnovers >= 5 && turnovers > ast && pts < 10)
    return pick('Oh Brother', 'A tough recorded session: fewer than 10 points and 5+ turnovers on 8+ attempts.');
  if (fga >= 8 && fgm / fga < .3)
    return pick('Work To Do', 'Below 30% recorded shooting on 8+ attempts. A session, not a verdict.');
  if (fga >= 8 && fgm / fga >= .45)
    return pick('Work Gone Show', 'At least 45% recorded shooting on 8+ attempts.');
  if (fga < 8 && pts < 10 && reb < 3 && ast < 3 && stl + blk < 1)
    return pick('Stay Focused', 'A small recorded sample. Keep building.');
  return type === 'game'
    ? pick('Only One Game', 'One recorded game. The next one is a fresh opportunity.')
    : pick('Stay Focused', 'Keep the practice going. No progress claim from one session.');
}

export function resolveCardEnergy(report, { type = 'game', choice = 'auto', kind = 'player' } = {}) {
  if (kind !== 'player' || choice === 'none') return null;
  if (choice === 'auto') return { ...playerCardEnergy(report, { type }), automatic: true };
  if (!CARD_ENERGY_PHRASES.includes(choice)) throw new Error('Unsupported card headline.');
  return { phrase: choice, reason: 'Your chosen caption, not an automatic stat assessment.', automatic: false };
}
