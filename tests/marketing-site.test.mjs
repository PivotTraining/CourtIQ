import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../marketing-site/', import.meta.url);
const html = await readFile(new URL('index.html',root),'utf8');
const body = html.slice(html.indexOf('<body>'));
test('public site is web-first and does not offer unapproved prices or unverified traction', () => {
  assert.match(body,/CourtIQ web pilot/);
  assert.match(body,/There is no checkout or automatic paid membership on this website/);
  assert.doesNotMatch(body,/apps.apple.com|\$4\.99|10,000\+|50,000\+|500\+|<blockquote|data-count/);
  assert.match(body,/DEVICE ONLY|device \(100 MB per clip/);
  assert.match(body,/not part of the current production release/);
  assert.match(body,/Illustrative sample stats and diagram/);
  assert.doesNotMatch(html,/caches.delete|\.unregister\(|fonts.googleapis.com/);
});
test('site anchors, branded images and privacy routes are complete', async () => {
  assert.equal((body.match(/<h1\b/g)||[]).length,1);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const match of body.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(match[1]),match[1]);
  for(const tag of body.match(/<img\b[^>]+>/g)||[]) {
    assert.match(tag,/alt="[^"]*"/);
    const src=tag.match(/src="([^"]+)"/)[1];
    if (src.startsWith('https://')) {
      assert.equal(src,'https://app.getcourtiq.com/product-mobile.jpg');
    } else assert.ok((await readFile(new URL('.'+src,root))).length);
  }
  const config=JSON.parse(await readFile(new URL('vercel.json',root),'utf8'));
  for(const path of ['/privacy','/privacy.html','/terms','/terms.html']) {
    const redirect=config.redirects.find(row=>row.source===path);
    assert.ok(redirect); assert.ok(redirect.destination.startsWith('https://app.getcourtiq.com/'));
  }
  assert.match(html,/og:title/);
  assert.match(html,/google-site-verification/);
  assert.match(await readFile(new URL('sitemap.xml',root),'utf8'),/https:\/\/getcourtiq.com\//);
});
