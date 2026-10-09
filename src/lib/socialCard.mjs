import { percent } from './sessionReport.mjs';
import { resolveCardEnergy } from './cardEnergy.mjs';
import { COURTIQ_DARK_LOGO_PATHS } from './brandArtwork.mjs';

const escapeXml = value => String(value).replace(/[<>&"']/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]));
const short = (value, length) => { const chars=Array.from(String(value || '')); return chars.length>length?chars.slice(0,length-1).join('')+'…':chars.join(''); };

// Export only report-derived stats; never invent percentages for zero attempts.
export function socialCardSvg(report, { format='square', title='Player recap', date='', type='game', scope='Recorded player stats', energy='auto', kind='player' }={}) {
  if(!['square','story'].includes(format))throw new Error('Unsupported card format.');
  const height=format==='story'?1920:1080, offset=format==='story'?290:0;
  const text=(x,y,value,size,color='#F0F1F5',weight=700)=>`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(value)}</text>`;
  const metrics=[['REB',report.box.reb],['AST',report.box.ast],['STL',report.box.stl],['BLK',report.box.blk]];
  const headline=resolveCardEnergy(report,{type,choice:energy,kind});
  const body=offset+(headline?60:0);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}" role="img" aria-label="CourtIQ recorded stats card">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#151A2B"/><stop offset="1" stop-color="#080D16"/></linearGradient></defs>
    <rect width="1080" height="${height}" fill="url(#bg)"/><path d="M790 0L1080 0L1080 ${height}L650 ${height}" fill="#FF6B35" opacity=".05"/>
    <g transform="translate(64 56) scale(.62)">${COURTIQ_DARK_LOGO_PATHS}</g>
    ${text(64,180+offset,type==='practice'?'PRACTICE RECAP':'GAME RECAP',24,'#98A4BE')}${text(64,250+offset,short(title,28),48)}${text(64,295+offset,short(date || 'Date not recorded',40),24,'#98A4BE')}
    ${headline?`<rect x="64" y="${318+offset}" width="952" height="60" rx="12" fill="#68E5C1" fill-opacity=".10"/><path d="M84 ${333+offset}L92 ${333+offset}L88 ${345+offset}L97 ${345+offset}L82 ${365+offset}L87 ${350+offset}L79 ${350+offset}Z" fill="#68E5C1"/>${text(112,360+offset,headline.phrase,40,'#68E5C1',900)}`:''}
    ${text(64,490+body,report.pts,170,'#FF895D',900)}${text(64,540+body,'RECORDED POINTS',26,'#CBD5E1')}
    ${text(550,395+body,`FG  ${report.fgm}/${report.fga}`,36)}${text(550,448+body,percent(report.fgPct),48,'#68E5C1')}${text(550,505+body,`3PT  ${report.threeMade}/${report.threeAttempts}`,28,'#CBD5E1')}${text(550,551+body,`FT  ${report.ftm}/${report.fta}`,28,'#CBD5E1')}
    ${metrics.map(([label,value],i)=>`<rect x="${64+i*242}" y="${615+body}" width="218" height="154" rx="20" fill="#FFFFFF" fill-opacity=".05"/>${text(90+i*242,680+body,value,46)}${text(90+i*242,725+body,label,23,'#98A4BE')}`).join('')}
    ${text(64,836+body,short(scope,57),25,'#CBD5E1')}${text(64,880+body,'Based only on recorded events. Not an official box score.',23,'#98A4BE')}${text(64,height-70,'YOUR WORK. YOUR PROGRESS.',23,'#98A4BE')}</svg>`;
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
