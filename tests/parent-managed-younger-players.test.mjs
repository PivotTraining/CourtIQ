import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration=await readFile(new URL("../supabase/migrations/20261029164300_parent_managed_younger_players.sql",import.meta.url),"utf8");
const schema=await readFile(new URL("../supabase/schema.sql",import.meta.url),"utf8");
const ownership=await readFile(new URL("../supabase/migrations/20260930171602_web_player_ownership_safeguards.sql",import.meta.url),"utf8");
const alice="00000000-0000-0000-0000-000000000001",bob="00000000-0000-0000-0000-000000000002";

async function fresh(){
 const db=new PGlite();
 await db.exec(`create role authenticated; create role anon;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;
 insert into auth.users values ('${alice}','a@example.com',now()),('${bob}','b@example.com',now());`);
 await db.exec(schema);await db.exec(ownership);await db.exec(migration);
 return db;
}
async function as(db,id,sql){
 await db.exec(`reset role; set request.jwt.claim.sub='${id}';set role authenticated;`);
 return db.query(sql);
}
function create(name,age,ok=true){return `select (public.courtiq_create_parent_managed_player('${name}',${age},'PG',3,'Team',${ok})).id id`;}
test("Under-13 records require signed-in parent acknowledgement and no child Auth user",async()=>{
 const db=await fresh();
 try{
  await assert.rejects(as(db,alice,`insert into players(firebase_uid,manager_uid,name,age)
   values('${alice}_attempt','${alice}','Child',10)`),/Under-13 players require/);
  await assert.rejects(as(db,alice,create("Taylor",10,false)),/acknowledgement/);
  await assert.rejects(as(db,alice,create("Taylor",13,true)),/younger than 13/);
  const id=(await as(db,alice,create("Taylor",10,true))).rows[0].id;
  const child=(await as(db,alice,`select name,age,manager_uid,firebase_uid from players where id='${id}'`)).rows[0];
  assert.equal(child.name,"Taylor");assert.equal(child.age,10);assert.equal(child.manager_uid,alice);
  assert.ok(child.firebase_uid.startsWith(alice+"_"));
  const attest=(await as(db,alice,`select parent_uid,notice_version from parent_managed_player_attestations where player_id='${id}'`)).rows[0];
  assert.equal(attest.parent_uid,alice);assert.equal(attest.notice_version,"parent-managed-v1-2026-10");
  assert.equal((await as(db,bob,`select count(*)::int n from players where id='${id}'`)).rows[0].n,0);
  assert.equal((await as(db,bob,`select count(*)::int n from parent_managed_player_attestations where player_id='${id}'`)).rows[0].n,0);
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int n from auth.users")).rows[0].n,2);
  await assert.rejects(as(db,alice,`insert into parent_managed_player_attestations(player_id,parent_uid,notice_version)
   values('${id}','${alice}','parent-managed-v1-2026-10')`));
  await as(db,alice,`delete from players where id='${id}'`);
  assert.equal((await as(db,alice,`select count(*)::int n from parent_managed_player_attestations where player_id='${id}'`)).rows[0].n,0);
 }finally{await db.close();}
});
test("Parent accounts are isolated and minor creation validates inputs",async()=>{
 const db=await fresh();
 try{
  await assert.rejects(as(db,alice,`select public.courtiq_create_parent_managed_player('Bad jersey',10,'PG',500,'Team',true)`),/Jersey/);
  const id=(await as(db,alice,create("One",9,true))).rows[0].id;
  assert.equal((await as(db,bob,`select count(*)::int n from players where id='${id}'`)).rows[0].n,0);
  const another=(await as(db,bob,create("Two",8,true))).rows[0].id;
  assert.notEqual(id,another);
  assert.equal((await as(db,alice,`select count(*)::int n from players where id='${another}'`)).rows[0].n,0);
 }finally{await db.close();}
});
