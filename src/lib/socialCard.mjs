import { percent } from './sessionReport.mjs';
import { resolveCardEnergy } from './cardEnergy.mjs';
import { COURTIQ_DARK_LOGO_PATHS } from './brandArtwork.mjs';

const escapeXml = value => String(value).replace(/[<>&"']/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]));
const short = (value, length) => { const chars=Array.from(String(value || '')); return chars.length>length?chars.slice(0,length-1).join('')+'…':chars.join(''); };
export const SOCIAL_CARD_THEMES = Object.freeze([
  { id: 'midnight', label: 'Midnight' },
  { id: 'hardwood', label: 'Court lights' },
  { id: 'light', label: 'Clean white' },
]);
const PALETTES = Object.freeze({
  midnight: { bg: '#080E1D', bg2: '#1C2A43', surface: '#18263B', outline: '#384960', text: '#F8FAFC', muted: '#C0CADD', accent: '#FF8C4C', glow: '#6CE5C1' },
  hardwood: { bg: '#131714', bg2: '#283C2E', surface: '#263227', outline: '#526A56', text: '#FFF9E8', muted: '#D7DECE', accent: '#FFC870', glow: '#A2F4B7' },
  light: { bg: '#F5F2EC', bg2: '#E3E9EA', surface: '#FFFFFF', outline: '#B9C2CD', text: '#142034', muted: '#3F5366', accent: '#CF4C18', glow: '#075D50' },
});

// Static, self-contained vector card. No external font, photo, resource, script or user-provided SVG.
// Numbers come only from the recorded session. A percentage with zero attempts stays undefined.
export function socialCardSvg(report, {
  format = 'square', title = 'Player recap', date = '', type = 'game',
  scope = 'Recorded player stats', energy = 'auto', kind = 'player', theme = 'midnight', opponent = ''
} = {}) {
  if (!['square', 'story'].includes(format)) throw new Error('Unsupported card format.');
  const palette = PALETTES[theme];
  if (!palette) throw new Error('Unsupported social card theme.');
  const story = format === 'story', height = story ? 1920 : 1080, shift = story ? 280 : 0;
  const tx = (x, y, value, size, color = palette.text, weight = 700, spacing = 0) =>
    `<text x="${x}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="${color}">${escapeXml(value)}</text>`;
  const subtitle = type === 'practice' ? 'PRACTICE RECAP' : 'GAME DAY RECAP';
  const headline = resolveCardEnergy(report, { type, choice: energy, kind });
  const mainTitle = short(title, 30);
  const when = date ? short(date, 22) : 'Date not recorded';
  const matchup = opponent ? short(`VS ${opponent}`, 22) : '';
  const metrics = [['REB', report.box.reb], ['AST', report.box.ast], ['STL', report.box.stl], ['BLK', report.box.blk]];
  const badgeY = 365 + shift, ptsLabelY = 471 + shift, ptsY = 646 + shift, secondaryY = 515 + shift;
  const statY = 750 + shift, footerY = height - 88;
  const panels = metrics.map(([label, value], i) => {
    const x = 66 + i * 240;
    return `<rect x="${x}" y="${statY}" width="222" height="151" rx="20" fill="${palette.surface}" stroke="${palette.outline}" stroke-width="1.5"/>${tx(x + 27, statY + 77, value, 62, palette.text, 900)}${tx(x + 27, statY + 122, label, 22, palette.muted, 700, 2)}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}" role="img" aria-label="CourtIQ recorded stats card">
    <defs><linearGradient id="courtiq-card-bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${palette.bg2}"/><stop offset="1" stop-color="${palette.bg}"/></linearGradient></defs>
    <rect width="1080" height="${height}" fill="url(#courtiq-card-bg)"/>
    <circle cx="1050" cy="${story ? 1100 : 610}" r="375" fill="none" stroke="${palette.outline}" opacity=".44" stroke-width="3"/>
    <circle cx="1050" cy="${story ? 1100 : 610}" r="160" fill="none" stroke="${palette.outline}" opacity=".35" stroke-width="3"/>
    <path d="M700 0L1080 0L1080 ${height}L870 ${height}Z" fill="${palette.accent}" opacity=".035"/>
    <rect x="60" y="${story ? 99 : 49}" width="958" height="100" rx="20" fill="#0C1220"/>
    <g transform="translate(82 ${story ? 120 : 70}) scale(.48)">${COURTIQ_DARK_LOGO_PATHS}</g>
    <rect x="66" y="${202 + shift}" width="70" height="6" rx="3" fill="${palette.accent}"/>
    ${tx(66, 262 + shift, subtitle, 25, palette.accent, 800, 4)}
    ${tx(66, 329 + shift, mainTitle, 54, palette.text, 900)}
    ${tx(795, 328 + shift, when, 22, palette.muted, 600)}
    ${headline ? `<rect x="66" y="${badgeY}" width="948" height="65" rx="16" fill="${palette.surface}" stroke="${palette.outline}"/><rect x="66" y="${badgeY}" width="9" height="65" rx="4" fill="${palette.glow}"/>${tx(97, badgeY + 45, short(headline.phrase, 27), 35, palette.glow, 900)}` : `<path d="M66 ${badgeY + 34}H1014" stroke="${palette.outline}" stroke-width="2"/>`}
    ${tx(66, ptsLabelY, 'POINTS', 24, palette.muted, 800, 3)}
    ${tx(66, ptsY, report.pts, 180, palette.accent, 900)}
    <rect x="552" y="${secondaryY - 67}" width="462" height="254" rx="24" fill="${palette.surface}" stroke="${palette.outline}" stroke-width="1.5"/>
    ${tx(584, secondaryY - 18, 'FIELD GOALS', 21, palette.muted, 800, 2)}
    ${tx(584, secondaryY + 52, percent(report.fgPct), 76, palette.glow, 900)}
    ${tx(584, secondaryY + 105, `FG  ${report.fgm}/${report.fga}`, 28, palette.text, 700)}
    ${tx(584, secondaryY + 155, `3PT  ${report.threeMade}/${report.threeAttempts}`, 25, palette.muted, 700)}
    ${tx(804, secondaryY + 155, `FT  ${report.ftm}/${report.fta}`, 25, palette.muted, 700)}
    ${panels}
    ${story ? `<path d="M66 1400H1014" stroke="${palette.outline}" stroke-width="2"/>${tx(66, 1485, 'THE WORK SPEAKS.', 59, palette.text, 900, 1)}${tx(66, 1547, 'ONE SESSION. REAL NUMBERS.', 30, palette.accent, 800, 2)}` : ''}
    ${matchup ? tx(670, 263 + shift, matchup, 22, palette.muted, 700, 1) : ''}
    ${tx(66, footerY - 52, short(scope, 57), 21, palette.muted, 600)}
    ${tx(66, footerY - 13, 'Recorded events only. Not an official box score.', 20, palette.muted, 500)}
    <path d="M66 ${footerY + 14}H1014" stroke="${palette.outline}" stroke-width="2"/>
    ${tx(66, height - 31, 'YOUR WORK. YOUR PROGRESS.', 20, palette.accent, 900, 2)}
    </svg>`;
}

export async function cardPng(svg, browser = globalThis) {
  const url=browser.URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try {
    const image=new browser.Image();
    await new Promise((resolve,reject)=>{ image.onload=resolve; image.onerror=()=>reject(new Error('Card image could not render.')); image.src=url; });
    const canvas=browser.document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d');if(!context)throw new Error('Image export is unavailable.');
    context.drawImage(image,0,0);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG export failed.')),'image/png'));
  } finally { browser.URL.revokeObjectURL(url); }
}
