#!/usr/bin/env node
/**
 * Read-only live-site smoke test. No login credentials, trial starts, player
 * mutations, account deletion, checkout creation or webhook POSTs.
 *
 * Run: node scripts/smoke-site.mjs
 * Override SMOKE_APP_URL and SMOKE_MARKETING_URL for a preview or local target.
 */
const appOrigin=new URL(process.env.SMOKE_APP_URL||'https://app.getcourtiq.com');
const marketingOrigin=new URL(process.env.SMOKE_MARKETING_URL||'https://getcourtiq.com');
if(!['https:','http:'].includes(appOrigin.protocol)||!['https:','http:'].includes(marketingOrigin.protocol))
  throw Error('Only HTTP(S) smoke targets are allowed.');

const privateRoutes=[
 'dashboard','training','skills','sessions','heatmap','journal','game-log',
 'iq','coach','billing','family','settings','film','development-profile'
];
const cases=[
  {host:'app',path:'/',name:'App root routes users to CourtIQ',expected:[307,308,302,301],location:'/dashboard'},
  ...privateRoutes.map(path=>({host:'app',path:'/'+path,name:'App section '+path,expected:[200],type:'text/html'})),
  ...['privacy','terms','support'].map(path=>({host:'app',path:'/'+path,name:'Public document '+path,expected:[200],type:'text/html'})),
  {host:'app',path:'/robots.txt',name:'Robots index rules',expected:[200],type:'text/plain'},
  {host:'app',path:'/sitemap.xml',name:'Public sitemap',expected:[200],type:'xml',verify:'sitemap'},
  {host:'app',path:'/opengraph-image',name:'Share image',expected:[200],type:'image/'},
  {host:'app',path:'/brand/courtiq-v2/icon-48.png',name:'Linked browser favicon',expected:[200],type:'image/'},
  {host:'app',path:'/brand/courtiq-v2/courtiq-app-icon.svg',name:'Linked vector app icon',expected:[200],type:'image/svg+xml'},
  {host:'app',path:'/product-desktop.jpg',name:'Desktop product image',expected:[200],type:'image/'},
  {host:'app',path:'/product-mobile.jpg',name:'Mobile product image',expected:[200],type:'image/'},
  {host:'app',path:'/dev/tracker',name:'Production dev preview denied',expected:[404]},
  {host:'app',path:'/smoke-this-route-must-not-exist',name:'Unknown page gives real 404',expected:[404]},
  {host:'app',path:'/api/auth-status',name:'Supabase authentication upstream health',expected:[200],type:'application/json',verify:'auth'},
  ...['billing/status','starter','analytics','jobs/billing-reconciliation'].map(path=>({
    host:'app',path:'/api/'+path,name:'Unauthenticated API guard '+path,
    expected:[401,403,503],type:'application/json',verify:'auth-guard'
  })),
  ...['billing/checkout','billing/portal','billing/webhook','coach','telemetry'].map(path=>({
    host:'app',path:'/api/'+path,name:'No unintended GET operation '+path,
    expected:[405]
  })),
  {host:'marketing',path:'/',name:'Public marketing homepage',expected:[200],type:'text/html',verify:'marketing'},
  ...['privacy','terms','support'].map(path=>({host:'marketing',path:'/'+path,name:'Marketing policy/support redirect '+path,expected:[301,302,307,308],verify:'marketing-redirect'})),
];
const sleep=ms=>new Promise(done=>setTimeout(done,ms));

async function check(test){
  const origin=test.host==='app'?appOrigin:marketingOrigin;
  const url=new URL(test.path,origin);
  const start=Date.now();
  let error;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(18000),
        headers:{Accept:'*/*','User-Agent':'CourtIQ-Release-Smoke/1.0 (read-only; no account data)'},
        cache:'no-store'});
      const ct=response.headers.get('content-type')||'';
      if(!test.expected.includes(response.status))
        throw Error('HTTP '+response.status+' (expected '+test.expected.join('/')+')');
      if(test.location&&!new URL(response.headers.get('location')||'/',url).pathname.startsWith(test.location))
        throw Error('Unexpected app-root redirect');
      if(test.verify==='marketing-redirect'){
        const location=response.headers.get('location');
        if(!location)throw Error('Marketing redirect missing Location');
        const target=new URL(location,url);
        if(target.protocol!=='https:'||target.hostname!=='app.getcourtiq.com'||target.pathname!==test.path)
          throw Error('Marketing redirect did not go to canonical CourtIQ legal/support page');
        const destination=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'CourtIQ-Release-Smoke/1.0 (read-only)'}});
        if(destination.status!==200||!(destination.headers.get('content-type')||'').includes('text/html'))
          throw Error('Marketing redirect destination is unavailable: HTTP '+destination.status);
      }
      if(test.type&&!ct.includes(test.type))throw Error('Unexpected content type '+ct);
      // Inspect only public, non-player data to avoid reading or logging private records.
      if(test.verify==='sitemap'){
        const xml=await response.text();
        if(!xml.includes('/privacy')||!xml.includes('/terms')||xml.includes('/dashboard')||xml.includes('/game-log'))
          throw Error('Sitemap contains private routes or lacks legal pages');
      }else if(test.verify==='auth'){
        const body=await response.json();
        if(body?.status!=='ok'||body?.auth!=='reachable')
          throw Error('Auth upstream unhealthy');
      }else if(test.verify==='auth-guard'){
        const payload=await response.text();
        if(/"access_token"|"service_role"|"secret_key"|"customer_email"|"player_id"/i.test(payload))
          throw Error('Auth guard disclosed private fields');
      }else if(test.verify==='marketing'){
        const html=await response.text();
        if(!/CourtIQ/i.test(html))throw Error('Marketing homepage missing product name');
      }
      return {name:test.name,ok:true,http:response.status,ms:Date.now()-start};
    }catch(e){
      error=e?.message||String(e);
      if(attempt===0&&(/HTTP 5\d\d|fetch failed|timeout|network/i.test(error)))await sleep(700);
      else break;
    }
  }
  return {name:test.name,ok:false,error,ms:Date.now()-start};
}
async function main(){
  const results=[];
  const pending=[...cases];
  const worker=async()=>{while(pending.length){const test=pending.shift();const result=await check(test);
    results.push(result);console.log((result.ok?'PASS':'FAIL')+'  '+result.name+'  '+
      (result.ok?'HTTP '+result.http:result.error)+'  '+result.ms+'ms');}};
  await Promise.all([worker(),worker(),worker(),worker()]);
  const failed=results.filter(r=>!r.ok);
  console.log('\nCourtIQ read-only site smoke: '+(results.length-failed.length)+'/'+results.length+' checks passed.');
  if(failed.length)console.log('Failures: '+failed.map(x=>x.name+': '+x.error).join('; '));
  if(process.env.GITHUB_STEP_SUMMARY){
    const fs=await import('node:fs/promises');
    const summary='## CourtIQ live smoke test\n\n'+(results.length-failed.length)+'/'+results.length+
      ' read-only checks passed.\n\n| Area | Result |\n|---|---|\n'+
      results.map(r=>'| '+r.name.replaceAll('|','\\|')+' | '+(r.ok?'PASS (HTTP '+r.http+')':'FAIL: '+r.error.replaceAll('|','\\|'))+' |').join('\n')+
      '\n\nThis excludes authenticated gameplay, paid checkouts, real phone camera storage, and customer account changes.\n';
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
  }
  if(failed.length)process.exitCode=1;
}
await main();
