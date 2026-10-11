import test from 'node:test';
import assert from 'node:assert/strict';
import { reactHarness, loadComponent, findElement, deferred } from './helpers/reactHarness.mjs';
import { readFile } from 'node:fs/promises';

const click=(tree,content)=>findElement(tree,x=>x.type==='button'&&JSON.stringify(x.props.children).includes(content));
const input=(tree,id)=>findElement(tree,x=>x.type==='input'&&x.props.id===id);
async function prepare({confirmed=true,updateUser=async()=>({data:{user:{id:'demo'}},error:null})}={}){
 const calls=[], h=reactHarness();
 const auth={ updateUser:async data=>{calls.push(data);return updateUser(data);} };
 const {default:Component}=await loadComponent(new URL('../src/components/settings/PasswordAccess.jsx',import.meta.url),{
   react:h.react, '@/lib/supabase':{supabase:{auth}}
 });
 h.render(Component,{emailConfirmed:confirmed,email:'player@example.test'});h.flush();
 const open=()=>{click(h.output,'Set password').props.onClick();h.flush()};
 const type=(id,v)=>{input(h.output,id).props.onChange({target:{value:v}});h.flush()};
 const submit=()=>findElement(h.output,x=>x.type==='form').props.onSubmit({preventDefault(){}});
 return {h,calls,open,type,submit};
}
test('account settings expose password setup for existing OAuth users',async()=>{
 const src=await readFile(new URL('../src/components/settings/SettingsScreen.jsx',import.meta.url),'utf8');
 assert.match(src,/PasswordAccess/);
 assert.match(src,/emailConfirmed/);
});
test('authenticated verified user can add password without creating a new account',async()=>{
 const f=await prepare();f.open();
 f.type('account-password','secure-passphrase-123');
 f.type('account-password-confirm','secure-passphrase-123');
 await f.submit();await f.h.settle();
 assert.deepEqual(structuredClone(f.calls),[{password:'secure-passphrase-123'}]);
 assert.match(JSON.stringify(f.h.output),/Password saved/);
 assert.equal(click(f.h.output,'Set password').props['aria-expanded'],false);
 f.h.unmount();
});
test('unconfirmed email, weak and mismatched passwords never call provider',async()=>{
 const f=await prepare({confirmed:false});f.open();
 f.type('account-password','secure-passphrase-123');f.type('account-password-confirm','secure-passphrase-123');
 await f.submit();await f.h.settle();
 assert.deepEqual(f.calls,[]);
 assert.match(JSON.stringify(f.h.output),/email must be confirmed/);
 f.h.unmount();
 const g=await prepare();g.open();g.type('account-password','short');g.type('account-password-confirm','short');
 await g.submit();await g.h.settle();assert.deepEqual(g.calls,[]);
 g.type('account-password','some-longer-password');g.type('account-password-confirm','different');
 await g.submit();await g.h.settle();assert.deepEqual(g.calls,[]);g.h.unmount();
});
test('simultaneous submissions are blocked and error never claims password success',async()=>{
 const d=deferred();const f=await prepare({updateUser:()=>d.promise});
 f.open();f.type('account-password','some-longer-password');f.type('account-password-confirm','some-longer-password');
 const a=f.submit(),b=f.submit();f.h.flush();
 assert.equal(f.calls.length,1);assert.equal(click(f.h.output,'Saving securely…').props.disabled,true);
 d.resolve({data:{user:null},error:new Error('Update rejected')});
 await Promise.all([a,b]);await f.h.settle();
 assert.match(JSON.stringify(f.h.output),/Update rejected/);
 assert.doesNotMatch(JSON.stringify(f.h.output),/Password saved/);
 f.h.unmount();
});
