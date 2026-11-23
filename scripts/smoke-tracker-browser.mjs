#!/usr/bin/env node
/**
 * Browser-level layout / interaction smoke against the development-only,
 * LOCAL SAMPLE tracker. Never connects to a real player or Stripe.
 */
import {chromium} from 'playwright';

const base=process.env.SMOKE_LOCAL_PREVIEW_URL || 'http://127.0.0.1:3334/dev/tracker';
const browser=await chromium.launch({headless:true,channel:process.env.SMOKE_CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
const page=await context.newPage();
const exceptions=[];
page.on('pageerror',error=>exceptions.push(error.message));

function verify(condition,message){if(!condition)throw Error(message);}
async function inspect(width,height){
  await page.setViewportSize({width,height});
  const result=await page.locator('.tracker-free-throw-actions').evaluate(card=>{
    const heading=card.querySelector(':scope > span');
    const row=card.querySelector(':scope > .tracker-free-throw-buttons');
    const buttons=row?[...row.querySelectorAll('button')]:[];
    if(!heading||!row||buttons.length!==2)return {error:'FT heading, row or buttons are missing'};
    const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    return {
      layout:getComputedStyle(card).display,
      rowLayout:getComputedStyle(row).display,
      label:rect(heading),row:rect(row),buttons:buttons.map(rect),
      cardWidth:card.clientWidth,cardScrollWidth:card.scrollWidth,
      rowWidth:row.clientWidth,rowScrollWidth:row.scrollWidth,
      text:buttons.map(b=>b.textContent.trim())
    };
  });
  verify(!result.error,JSON.stringify(result));
  const [made,missed]=result.buttons;
  verify(result.layout==='block','FT card title and controls are incorrectly placed in side-by-side columns at '+width+'px');
  verify(result.rowLayout==='grid','FT buttons are not rendered in their own grid at '+width+'px');
  verify(result.label.bottom<=result.row.top+1,'FT heading overlaps or sits next to controls at '+width+'px');
  verify(made.height>=44&&missed.height>=44,'FT touch targets smaller than 44px at '+width+'px');
  verify(made.width>=90&&missed.width>=90,'FT buttons too narrow at '+width+'px');
  verify(Math.abs(made.width-missed.width)<2,'FT buttons not equal width at '+width+'px');
  verify(made.right<missed.left,'FT buttons overlap at '+width+'px');
  verify(result.cardScrollWidth<=result.cardWidth+2,'FT card horizontally overflows at '+width+'px');
  verify(result.rowScrollWidth<=result.rowWidth+2,'FT row horizontally overflows at '+width+'px');
  verify(result.text.some(v=>v.includes('Made FT'))&&result.text.some(v=>v.includes('Missed FT')),'FT labels missing');
  console.log('PASS FT layout '+width+'x'+height+' | '+Math.round(made.width)+'px buttons | '+Math.round(made.height)+'px touch height');
}

try {
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.getByRole('button',{name:'Start tracking'}).waitFor({state:'visible',timeout:30000});
  await page.getByRole('button',{name:'Start tracking'}).click();
  await page.getByRole('dialog',{name:'Basketball stat tracker'}).waitFor({state:'visible',timeout:20000});

  for(const [width,height] of [[320,700],[360,740],[390,844],[430,932],[768,1024],[812,375]])
    await inspect(width,height);

  await page.setViewportSize({width:390,height:844});
  const made=page.getByRole('button',{name:'Record a made free throw'});
  const missed=page.getByRole('button',{name:'Record a missed free throw'});
  await made.click(); await missed.click(); await made.click();
  await page.waitForFunction(()=>{
    const rows=JSON.parse(localStorage.getItem('courtiq-local-sample-backend-v1')||'{}');
    return Object.values(rows).some(s=>s.events.filter(e=>e.payload?.kind==='shot'&&e.payload?.zone_id==='free-throw').length===3);
  },null,{timeout:10000});

  const results=await page.evaluate(()=>{
    const rows=JSON.parse(localStorage.getItem('courtiq-local-sample-backend-v1')||'{}');
    return Object.values(rows).flatMap(s=>s.events)
      .filter(e=>e.payload?.kind==='shot'&&e.payload?.zone_id==='free-throw')
      .map(e=>e.payload.made);
  });
  verify(JSON.stringify(results)==='[true,false,true]','FT shots not saved in correct made/missed order');
  console.log('PASS FT interactions: made, missed, made persisted in LOCAL SAMPLE');

  await page.getByRole('button',{name:/Add block/}).click();
  console.log('PASS Block live stat tap');
  verify(exceptions.length===0,'Browser JavaScript errors: '+exceptions.join('; '));
  console.log('PASS browser JavaScript: no uncaught page exceptions');
}finally{
  await context.close();
  await browser.close();
}
