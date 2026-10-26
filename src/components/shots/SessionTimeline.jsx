"use client";
import {useState} from 'react';
import {COURT_ZONES} from '@/lib/constants';
import {STAT_KEYS} from '@/lib/sessionRecovery.mjs';

export default function SessionTimeline({events,busy,onCorrect,reverse}){
  const [editing,setEditing]=useState(null);
  const [draft,setDraft]=useState(null);
  const reversed=new Set(events.filter(event=>event.payload.kind==='reverse').map(event=>event.payload.target));
  const begin=event=>{setEditing(event.id);setDraft({...event.payload});};
  const update=(name,value)=>setDraft(prev=>({...prev,[name]:value}));
  const submit=event=>{
    event.preventDefault();
    const original=events.find(row=>row.id===editing);
    if(!original||!draft)return;
    const fields=original.payload.kind==='shot'?
      {zone_id:draft.zone_id,made:draft.made,period:Number(draft.period),clock:draft.clock}:
      {key:draft.key,delta:Number(draft.delta),period:Number(draft.period),clock:draft.clock};
    if(onCorrect?.(editing,fields)){setEditing(null);setDraft(null);}
  };
  return <section aria-label="Session entry timeline" className="tracker-timeline">
    <h3>Game event history &amp; corrections</h3>
    <p className="tracker-hint">Edit an event to reverse the original and write a corrected entry. Both remain in the audit trail. Pending edits also save on this device.</p>
    <ol>
      {[...events].reverse().map(event=><li key={event.id} className="tracker-event">
        <span>{event.payload.kind==='shot'? `${event.payload.made?'Made':'Missed'} · ${event.payload.zone_id}`:
          event.payload.kind==='stat'? `${event.payload.key.toUpperCase()} ${event.payload.delta>0?'+':''}${event.payload.delta}`:
          event.payload.kind==='reverse'?'Correction: earlier entry reversed':
          event.payload.kind==='end'?'Session completed':'Game details updated'} · P{event.payload.period} {event.payload.clock}</span>
        {event.payload.corrects&&<small> · Corrected event</small>}
        {reversed.has(event.id)?<span> · Reversed</span>:
          ['shot','stat'].includes(event.payload.kind)&&<div className="tracker-event-actions">
            <button type="button" disabled={busy} onClick={()=>begin(event)}
              aria-label={`Edit entry ${event.version}`}>Edit</button>
            <button type="button" disabled={busy} onClick={()=>reverse(event.id)}
              aria-label={`Reverse entry ${event.version}`}>Reverse</button>
          </div>}
        {editing===event.id&&draft&&<form className="tracker-correction-form" onSubmit={submit}>
          {draft.kind==='shot'?<>
            <label>Shot zone <select value={draft.zone_id} onChange={e=>update('zone_id',e.target.value)}>
              {COURT_ZONES.map(zone=><option key={zone.id} value={zone.id}>{zone.label}</option>)}
            </select></label>
            <label>Result <select value={draft.made?'made':'missed'}
              onChange={e=>update('made',e.target.value==='made')}>
              <option value="made">Made</option><option value="missed">Missed</option>
            </select></label>
          </>:<>
            <label>Stat <select value={draft.key} onChange={e=>update('key',e.target.value)}>
              {STAT_KEYS.map(key=><option key={key} value={key}>{key.toUpperCase()}</option>)}
            </select></label>
            <label>Change <select value={String(draft.delta)}
              onChange={e=>update('delta',Number(e.target.value))}>
              <option value="1">+1</option><option value="-1">−1</option>
            </select></label>
          </>}
          <label>Period <input type="number" min="1" max="99" required
            value={draft.period} onChange={e=>update('period',e.target.value)}/></label>
          <label>Clock <input inputMode="numeric" pattern="[0-9]{1,2}:[0-5][0-9]" required
            value={draft.clock} onChange={e=>update('clock',e.target.value)}/></label>
          <div className="tracker-event-actions">
            <button type="submit" disabled={busy}>Save correction</button>
            <button type="button" onClick={()=>{setEditing(null);setDraft(null);}}>Cancel</button>
          </div>
        </form>}
      </li>)}
    </ol>
  </section>;
}
