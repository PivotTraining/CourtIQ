import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = name => readFile(new URL('../src/components/auth/'+name,import.meta.url),'utf8');

test('branded Google Identity Services signs in with an ID token without redirecting through Supabase OAuth', async () => {
  const s=await source('GoogleIdentityButton.jsx');
  assert.match(s,/https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(s,/google\.accounts\.id\.initialize/);
  assert.match(s,/google\.accounts\.id\.renderButton/);
  assert.match(s,/signInWithIdToken\(\{/);
  assert.match(s,/provider: "google", token: response\.credential, nonce: nonceBase64/);
  assert.match(s,/subtle\.digest\("SHA-256"/);
  assert.doesNotMatch(s,/signInWithOAuth|supabase\.co\/auth\/v1|skipBrowserRedirect/);
});

test('new Google button is feature-gated and old working OAuth remains a fallback', async () => {
  const s=await source('LoginScreen.jsx');
  assert.match(s,/NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
  assert.match(s,/googleClientId \? <>/);
  assert.match(s,/<GoogleIdentityButton clientId=\{googleClientId\}/);
  assert.match(s,/Trouble with the Google button\? Use the alternative login/);
  assert.match(s,/onClick=\{handleGoogle\}/);
  assert.match(s,/window\.location\.replace\("\/dashboard"\)/);
});
