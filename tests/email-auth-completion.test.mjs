import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';

const submit = { preventDefault() {} };
const button = (tree, text) => findElement(tree, node => node.type === 'button' &&
  JSON.stringify(node.props.children).includes(text));

async function loginFixture(actions = {}) {
  const h = reactHarness(), redirects = [];
  const defaults = {
    signInWithEmail: async (email) => ({session:{user:{id:'existing-email',email}}}),
    signInWithGoogle: async () => {},
    resetPassword: async () => {},
  };
  const { default: Login } = await loadComponent(
    new URL('../src/components/auth/LoginScreen.jsx', import.meta.url),
    { react: h.react, '@/lib/firebase': {}, '@/components/ui/BrandLogo': { default: () => null, __esModule: true },
    './GoogleIdentityButton': { default: () => null, __esModule: true } },
    { window: { location: { replace: path => redirects.push(path) } }, process: { env: {} } },
  );
  h.render(Login, { actions: { ...defaults, ...actions } }); h.flush();
  const input = id => findElement(h.output, node => node.type === 'input' && node.props.id === id);
  const openEmail = () => { findElement(h.output, n => n.type==='button' && n.props?.['aria-controls']==='existing-email-signin').props.onClick(); h.flush(); };
  return { h, redirects, input, openEmail };
}

test('Google is the public sign-up path, with no dead-end email registration', async () => {
  let googleCalls=0, emailCalls=0;
  const f=await loginFixture({signInWithGoogle:async()=>{googleCalls++;},signInWithEmail:async()=>{emailCalls++;}});
  assert.ok(button(f.h.output,'Continue with Google'));
  assert.equal(findElement(f.h.output,n=>n.type==='form'),null,'email signup/signin is not public by default');
  assert.doesNotMatch(JSON.stringify(f.h.output),/Create Account|Sign Up|Resend confirmation email/);
  assert.match(JSON.stringify(f.h.output),/Google never sees|CourtIQ never sees your Google password/);
  await button(f.h.output,'Continue with Google').props.onClick();
  await f.h.settle();
  assert.equal(googleCalls,1);
  assert.equal(emailCalls,0);
  f.openEmail();
  assert.ok(findElement(f.h.output,n=>n.type==='form'));
  assert.doesNotMatch(JSON.stringify(f.h.output),/Create Account|Resend confirmation email|Sign Up/);
  f.h.unmount();
});

test('existing email/password customers can still sign in and redirect to dashboard', async () => {
  const f=await loginFixture();
  f.openEmail();
  f.input('login-email').props.onChange({target:{value:'PLAYER@EXAMPLE.TEST'}});f.h.flush();
  f.input('login-password').props.onChange({target:{value:'strong-password'}});f.h.flush();
  await findElement(f.h.output,n=>n.type==='form').props.onSubmit(submit);
  await f.h.settle();
  assert.deepEqual(f.redirects,['/dashboard']);
  f.h.unmount();
});

test('invalid old email passwords show useful guidance without offering broken signup', async () => {
  const f=await loginFixture({signInWithEmail:async()=>{throw new Error('Invalid login credentials');}});
  f.openEmail();
  f.input('login-email').props.onChange({target:{value:'old@example.test'}});f.h.flush();
  f.input('login-password').props.onChange({target:{value:'wrong-password'}});f.h.flush();
  await findElement(f.h.output,n=>n.type==='form').props.onSubmit(submit);await f.h.settle();
  assert.match(JSON.stringify(f.h.output),/Existing email\/password accounts|existing email\/password accounts/);
  assert.match(JSON.stringify(f.h.output),/New users should use Google/);
  assert.doesNotMatch(JSON.stringify(f.h.output),/Create Account|Sign Up/);
  f.h.unmount();
});

test('existing user password reset makes no false email-delivery promise', async () => {
  let requested='';
  const f=await loginFixture({resetPassword:async email=>{requested=email;}});
  f.openEmail();
  f.input('login-email').props.onChange({target:{value:'existing@example.test'}});f.h.flush();
  await button(f.h.output,'Reset password').props.onClick();await f.h.settle();
  assert.equal(requested,'existing@example.test');
  assert.match(JSON.stringify(f.h.output),/Delivery is not guaranteed/);
  f.h.unmount();
});

async function callbackFixture(query) {
  const h=reactHarness(),calls=[],redirects=[];
  const fake={
    auth:{
      exchangeCodeForSession:async code=>{calls.push(['code',code]);return {data:{session:{user:{id:'test'}}},error:null};},
      verifyOtp:async args=>{calls.push(['token',args.token_hash,args.type]);return {data:{session:{user:{id:'test'}}},error:null};},
      updateUser:async()=>({error:null}),
    },
  };
  const web=await import('../src/lib/webAuth.mjs');
  const url=new URL('../src/components/auth/AuthCallback.jsx',import.meta.url);
  const { default: Callback }=await loadComponent(url, {
    react:h.react, '@/lib/supabase':{supabase:fake},'@/lib/webAuth.mjs':web,
  },{
    window:{location:{search:query,hash:'',replace:x=>redirects.push(x)}},URLSearchParams,
    setTimeout:()=>1, clearTimeout:()=>{},console:{error(){}},
  });
  h.render(Callback);await h.settle();
  return {h,calls,redirects};
}
test('custom confirmation email token_hash signs in without an OAuth code',async()=>{
  const f=await callbackFixture('?token_hash=sample-hash&type=signup&next=%2Fdashboard');
  assert.deepEqual(f.calls,[['token','sample-hash','signup']]);
  assert.deepEqual(f.redirects,['/dashboard']);
  f.h.unmount();
});
test('recovery links with token_hash open password update rather than dashboard',async()=>{
  const f=await callbackFixture('?token_hash=recovery-hash&type=recovery');
  assert.deepEqual(f.calls,[['token','recovery-hash','recovery']]);
  assert.deepEqual(f.redirects,[]);
  assert.match(JSON.stringify(f.h.output),/Reset your password/);
  f.h.unmount();
});
test('unknown OTP types never trigger provider calls',async()=>{
  const f=await callbackFixture('?token_hash=sample-hash&type=made-up');
  assert.deepEqual(f.calls,[]);
  assert.deepEqual(f.redirects,[]);
  assert.match(JSON.stringify(f.h.output),/incomplete or unsupported/);
  f.h.unmount();
});
