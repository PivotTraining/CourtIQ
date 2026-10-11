import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';

const submit = { preventDefault() {} };
const button = (tree, text) => findElement(tree, node => node.type === 'button' &&
  JSON.stringify(node.props.children).includes(text));

test('email signup can request another confirmation without exposing credentials', async () => {
  const h = reactHarness();
  const sent = [];
  const actions = {
    signUpWithEmail: async (...args) => { sent.push(['signup', ...args]); return { user: { id: 'sample' }, session: null }; },
    signInWithEmail: async () => {},
    resetPassword: async () => {},
    signInWithGoogle: async () => {},
    resendConfirmation: async email => { sent.push(['resend', email]); },
  };
  const { default: Login } = await loadComponent(new URL('../src/components/auth/LoginScreen.jsx',import.meta.url),
    { react:h.react, '@/lib/firebase':{}, '@/components/ui/BrandLogo': {default:()=>null, __esModule:true} });
  h.render(Login,{actions});h.flush();
  const input=id=>findElement(h.output,n=>n.type==='input'&&n.props.id===id);
  input('login-email').props.onChange({target:{value:'player@example.test'}});h.flush();
  input('login-password').props.onChange({target:{value:'123456789'}});h.flush();
  button(h.output,'Sign Up').props.onClick();h.flush();
  await findElement(h.output,n=>n.type==='form').props.onSubmit(submit);await h.settle();
  assert.ok(button(h.output,'Resend confirmation email'));
  await button(h.output,'Resend confirmation email').props.onClick();await h.settle();
  assert.deepEqual(sent,[['signup','player@example.test','123456789'],['resend','player@example.test']]);
  assert.match(JSON.stringify(h.output),/Another confirmation message/);
  h.unmount();
});

test('email not-confirmed login offers recovery instead of a false logged-in state', async () => {
  const h=reactHarness();const sent=[];
  const actions={
    signInWithEmail: async()=>{throw new Error('Email not confirmed');},
    signUpWithEmail: async()=>({session:null}),
    resetPassword:async()=>{},signInWithGoogle:async()=>{},
    resendConfirmation:async mail=>sent.push(mail),
  };
  const { default: Login }=await loadComponent(new URL('../src/components/auth/LoginScreen.jsx',import.meta.url),{
    react:h.react, '@/lib/firebase':{}, '@/components/ui/BrandLogo':{default:()=>null,__esModule:true}
  });
  h.render(Login,{actions});h.flush();
  const input=id=>findElement(h.output,n=>n.type==='input'&&n.props.id===id);
  input('login-email').props.onChange({target:{value:'player@example.test'}});h.flush();
  input('login-password').props.onChange({target:{value:'123456789'}});h.flush();
  await findElement(h.output,n=>n.type==='form').props.onSubmit(submit);await h.settle();
  assert.match(JSON.stringify(h.output),/Your email is not confirmed/);
  await button(h.output,'Resend confirmation email').props.onClick();await h.settle();
  assert.deepEqual(sent,['player@example.test']);
  h.unmount();
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
