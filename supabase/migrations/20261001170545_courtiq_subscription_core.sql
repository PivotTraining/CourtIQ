-- Stage inactive. Requires reviewed ownership, recovery, roster and trial migrations.
begin;
do $$ begin
  if to_regclass('public.account_trials') is null or to_regclass('public.team_games') is null then
    raise exception 'Apply ownership, recovery, roster and trial migrations first'; end if;
end $$;
create table private.courtiq_billing_policy (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  enforce_access boolean not null default false,
  grandfather_before timestamptz
);
insert into private.courtiq_billing_policy(id) values(true);
create table public.courtiq_billing_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text unique check(customer_id like 'cus\_%'),
  sync_token uuid, sync_until timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create table public.courtiq_subscriptions (
  subscription_id text primary key check(subscription_id like 'sub\_%'),
  owner_id uuid not null references public.courtiq_billing_accounts(owner_id) on delete cascade,
  customer_id text not null references public.courtiq_billing_accounts(customer_id),
  plan text not null check(plan in ('player','coach')),
  interval text not null check(interval in ('month','year')),
  price_id text not null check(price_id like 'price\_%'),
  currency text not null check(currency='usd'),
  unit_amount integer not null check(unit_amount>0),
  status text not null check(status in ('active','trialing','past_due','unpaid','incomplete','incomplete_expired','canceled','paused')),
  period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  paused boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);
create index courtiq_subscriptions_owner on public.courtiq_subscriptions(owner_id,period_end);
create unique index courtiq_one_open_subscription on public.courtiq_subscriptions(owner_id)
  where status not in ('canceled','incomplete_expired');
create table private.courtiq_checkout_requests (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  request_id uuid not null unique,
  plan text not null check(plan in ('player','coach')),
  interval text not null check(interval in ('month','year')),
  terms_version text not null,
  price_id text not null,
  unit_amount integer not null check(unit_amount>0),
  consent_at timestamptz not null default clock_timestamp(),
  state text not null default 'creating' check(state in ('creating','open')),
  lease_until timestamptz,
  expires_at timestamptz not null,
  session_id text, checkout_url text
);
create table private.courtiq_billing_events (
  event_id text primary key,
  event_type text not null,
  state text not null check(state in ('processing','processed','ignored')),
  token uuid not null,
  lease_until timestamptz not null,
  attempts integer not null default 1,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.courtiq_billing_accounts enable row level security;
alter table public.courtiq_subscriptions enable row level security;
alter table private.courtiq_checkout_requests enable row level security;
alter table private.courtiq_billing_events enable row level security;
alter table private.courtiq_billing_policy enable row level security;
revoke all on public.courtiq_billing_accounts,public.courtiq_subscriptions,
  private.courtiq_checkout_requests,private.courtiq_billing_events,private.courtiq_billing_policy from public,anon,authenticated;
-- Browser receives only its subscription row; customer mappings remain server-only.
grant select on public.courtiq_subscriptions to authenticated;
create policy courtiq_subscription_owner_read on public.courtiq_subscriptions for select to authenticated
  using(owner_id=(select auth.uid()));
grant usage on schema private to service_role;
grant all on public.courtiq_billing_accounts,public.courtiq_subscriptions,
  private.courtiq_checkout_requests,private.courtiq_billing_events,private.courtiq_billing_policy to service_role;

create function private.get_courtiq_billing() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); policy private.courtiq_billing_policy;
  sub public.courtiq_subscriptions; trial jsonb; active_paid boolean; active_trial boolean;
  current_time_value timestamptz:=clock_timestamp(); account auth.users;
begin
  select * into account from auth.users where id=uid;
  if uid is null or account.id is null then raise exception 'Authenticated account required' using errcode='42501'; end if;
  select * into policy from private.courtiq_billing_policy where id;
  trial:=private.get_courtiq_trial();
  select * into sub from public.courtiq_subscriptions where owner_id=uid
    order by (status not in ('canceled','incomplete_expired')) desc,period_end desc limit 1;
  active_paid:=sub.status='active' and sub.period_end>current_time_value and not sub.paused;
  active_trial:=trial->>'status'='active';
  return jsonb_build_object('enabled',policy.enabled,'enforced',policy.enforce_access,
    'server_now',current_time_value,'trial',trial,
    'access',case when not policy.enforce_access or (policy.grandfather_before is not null and account.created_at<policy.grandfather_before) then 'legacy'
      when active_paid then sub.plan when active_trial then 'trial' else 'read_only' end,
    'subscription',case when sub.subscription_id is null then null else jsonb_build_object(
      'plan',sub.plan,'interval',sub.interval,'status',sub.status,'period_end',sub.period_end,
      'cancel_at_period_end',sub.cancel_at_period_end,'paused',sub.paused,'synced_at',sub.synced_at) end);
end $$;
create function public.get_courtiq_billing() returns jsonb language sql security invoker set search_path=''
  as $$select private.get_courtiq_billing()$$;
revoke all on function private.get_courtiq_billing(),public.get_courtiq_billing() from public,anon;
grant execute on function private.get_courtiq_billing(),public.get_courtiq_billing() to authenticated;

create function private.courtiq_record_access() returns trigger
language plpgsql security definer set search_path='' as $$
declare state jsonb; feature text:=tg_argv[0];
begin
  -- Enforcement deliberately starts disabled; saved records/updates/exports are never gated.
  if not (select enforce_access from private.courtiq_billing_policy where id) then return new; end if;
  state:=private.get_courtiq_billing();
  if state->>'access' in ('legacy','trial','coach') or (feature='player' and state->>'access'='player') then return new; end if;
  raise exception 'COURTIQ_PLAN_REQUIRED: Start your trial or choose a plan to create a new % record. Existing records stay available.',feature using errcode='42501';
end $$;
revoke all on function private.courtiq_record_access() from public,anon,authenticated;
create trigger courtiq_new_session_access before insert on public.sessions
  for each row execute function private.courtiq_record_access('player');
create trigger courtiq_new_roster_access before insert on public.team_games
  for each row execute function private.courtiq_record_access('coach');

-- Do not erase the customer mapping while a provider subscription could still renew.
-- Cancellation must first be confirmed through the signed provider synchronization.
create function private.courtiq_deletion_billing_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.courtiq_subscriptions where owner_id=old.id and status not in ('canceled','incomplete_expired')) then
    raise exception 'COURTIQ_BILLING_ACTIVE: Manage and end your CourtIQ subscription before deleting your account.' using errcode='42501';
  end if;
  return old;
end $$;
revoke all on function private.courtiq_deletion_billing_guard() from public,anon,authenticated;
create trigger courtiq_deletion_billing_guard before delete on auth.users
  for each row execute function private.courtiq_deletion_billing_guard();
create function private.courtiq_can_delete_account(p_owner uuid) returns boolean
language sql security definer set search_path='' as $$
  select not exists(select 1 from public.courtiq_subscriptions where owner_id=p_owner and status not in ('canceled','incomplete_expired'));
$$;
create function public.courtiq_can_delete_account(p_owner uuid) returns boolean
language sql security invoker set search_path='' as $$select private.courtiq_can_delete_account(p_owner)$$;
revoke all on function private.courtiq_can_delete_account(uuid),public.courtiq_can_delete_account(uuid) from public,anon,authenticated;
grant execute on function private.courtiq_can_delete_account(uuid),public.courtiq_can_delete_account(uuid) to service_role;

create function private.claim_courtiq_checkout(p_owner uuid,p_request uuid,p_plan text,p_interval text,p_terms text,p_price text,p_amount integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row private.courtiq_checkout_requests; now_value timestamptz:=clock_timestamp();
begin
  if not (select enabled from private.courtiq_billing_policy where id) then raise exception 'Billing inactive'; end if;
  if not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null) then raise exception 'Verified account required'; end if;
  if p_request is null or p_plan not in ('player','coach') or p_interval not in ('month','year') or p_terms is null or char_length(p_terms) not between 1 and 100 then raise exception 'Invalid checkout'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,10));
  if exists(select 1 from public.courtiq_subscriptions where owner_id=p_owner and status not in ('canceled','incomplete_expired')) then raise exception 'Manage the existing subscription instead'; end if;
  select * into row from private.courtiq_checkout_requests where owner_id=p_owner for update;
  if found and row.expires_at>now_value then
    if row.plan<>p_plan or row.interval<>p_interval or row.terms_version<>p_terms or row.price_id<>p_price or row.unit_amount<>p_amount then raise exception 'A different checkout is already pending'; end if;
    if row.state='open' then return to_jsonb(row)||jsonb_build_object('claim','open'); end if;
    if row.lease_until>now_value then return jsonb_build_object('claim','busy'); end if;
    if row.expires_at<now_value+interval '2 minutes' then raise exception 'Checkout is expiring; try again shortly'; end if;
    update private.courtiq_checkout_requests set lease_until=now_value+interval '2 minutes' where owner_id=p_owner returning * into row;
  else
    insert into private.courtiq_checkout_requests(owner_id,request_id,plan,interval,terms_version,price_id,unit_amount,lease_until,expires_at)
    values(p_owner,p_request,p_plan,p_interval,p_terms,p_price,p_amount,now_value+interval '2 minutes',date_trunc('second',now_value)+interval '1 hour')
    on conflict(owner_id) do update set request_id=excluded.request_id,plan=excluded.plan,interval=excluded.interval,
      terms_version=excluded.terms_version,price_id=excluded.price_id,unit_amount=excluded.unit_amount,consent_at=now_value,state='creating',lease_until=excluded.lease_until,
      expires_at=excluded.expires_at,session_id=null,checkout_url=null returning * into row;
  end if;
  return to_jsonb(row)||jsonb_build_object('claim','claimed');
end $$;
create function private.bind_courtiq_customer(p_owner uuid,p_customer text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_customer is null or p_customer not like 'cus\_%' then raise exception 'Invalid customer'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,10));
  if exists(select 1 from public.courtiq_billing_accounts where owner_id=p_owner and customer_id is distinct from p_customer) then raise exception 'Customer mapping conflict'; end if;
  insert into public.courtiq_billing_accounts(owner_id,customer_id) values(p_owner,p_customer)
    on conflict(owner_id) do nothing;
end $$;
create function private.finish_courtiq_checkout(p_owner uuid,p_request uuid,p_session text,p_url text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_session is null or p_session not like 'cs\_%' or p_url is null or p_url not like 'https://checkout.stripe.com/%' then raise exception 'Invalid checkout result'; end if;
  update private.courtiq_checkout_requests set state='open',session_id=p_session,checkout_url=p_url,lease_until=null
    where owner_id=p_owner and request_id=p_request and state='creating';
  if not found then raise exception 'Checkout claim changed'; end if;
end $$;
create function private.release_courtiq_checkout(p_owner uuid,p_request uuid) returns void
language sql security definer set search_path='' as $$
  update private.courtiq_checkout_requests set lease_until=null where owner_id=p_owner and request_id=p_request and state='creating';
$$;
create function private.claim_courtiq_event(p_event text,p_type text,p_token uuid) returns text
language plpgsql security definer set search_path='' as $$
declare row private.courtiq_billing_events; current_time_value timestamptz:=clock_timestamp();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event,11));
  select * into row from private.courtiq_billing_events where event_id=p_event for update;
  if found then
    if row.state in ('processed','ignored') then return 'done'; end if;
    if row.lease_until>current_time_value then return 'busy'; end if;
    update private.courtiq_billing_events set token=p_token,lease_until=current_time_value+interval '2 minutes',attempts=attempts+1,updated_at=current_time_value where event_id=p_event;
  else
    insert into private.courtiq_billing_events(event_id,event_type,state,token,lease_until) values(p_event,p_type,'processing',p_token,current_time_value+interval '2 minutes');
  end if;
  return 'claimed';
end $$;
create function private.begin_courtiq_sync(p_customer text,p_token uuid) returns text
language plpgsql security definer set search_path='' as $$
declare account public.courtiq_billing_accounts;
begin
  select * into account from public.courtiq_billing_accounts where customer_id=p_customer for update;
  if not found then return 'unknown'; end if;
  if account.sync_until>clock_timestamp() then return 'busy'; end if;
  update public.courtiq_billing_accounts set sync_token=p_token,sync_until=clock_timestamp()+interval '2 minutes' where owner_id=account.owner_id;
  return 'claimed';
end $$;
create function private.apply_courtiq_snapshot(p_event text,p_token uuid,p_snapshot jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare account public.courtiq_billing_accounts;
begin
  if not exists(select 1 from private.courtiq_billing_events where event_id=p_event and token=p_token and state='processing') then raise exception 'Event claim changed'; end if;
  select * into account from public.courtiq_billing_accounts where customer_id=p_snapshot->>'customer_id' for update;
  if not found or account.sync_token is distinct from p_token then raise exception 'Sync claim changed'; end if;
  if exists(select 1 from public.courtiq_subscriptions where subscription_id=p_snapshot->>'subscription_id' and owner_id<>account.owner_id) then raise exception 'Subscription ownership conflict'; end if;
  insert into public.courtiq_subscriptions(subscription_id,owner_id,customer_id,plan,interval,price_id,currency,unit_amount,status,period_end,cancel_at_period_end,paused)
  values(p_snapshot->>'subscription_id',account.owner_id,account.customer_id,p_snapshot->>'plan',p_snapshot->>'interval',p_snapshot->>'price_id',p_snapshot->>'currency',(p_snapshot->>'unit_amount')::integer,p_snapshot->>'status',(p_snapshot->>'period_end')::timestamptz,(p_snapshot->>'cancel_at_period_end')::boolean,(p_snapshot->>'paused')::boolean)
  on conflict(subscription_id) do update set plan=excluded.plan,interval=excluded.interval,price_id=excluded.price_id,
    currency=excluded.currency,unit_amount=excluded.unit_amount,status=excluded.status,period_end=excluded.period_end,
    cancel_at_period_end=excluded.cancel_at_period_end,paused=excluded.paused,synced_at=clock_timestamp();
  update public.courtiq_billing_accounts set sync_token=null,sync_until=null where owner_id=account.owner_id;
  update private.courtiq_billing_events set state='processed',updated_at=clock_timestamp() where event_id=p_event and token=p_token;
end $$;
create function private.finish_courtiq_event(p_event text,p_token uuid,p_ignored boolean) returns void
language sql security definer set search_path='' as $$
  update private.courtiq_billing_events set state=case when p_ignored then 'ignored' else 'processed' end,updated_at=clock_timestamp() where event_id=p_event and token=p_token and state='processing';
  update public.courtiq_billing_accounts set sync_token=null,sync_until=null where sync_token=p_token;
$$;
create function private.release_courtiq_event(p_event text,p_token uuid) returns void
language sql security definer set search_path='' as $$
  update private.courtiq_billing_events set lease_until=clock_timestamp(),updated_at=clock_timestamp() where event_id=p_event and token=p_token and state='processing';
  update public.courtiq_billing_accounts set sync_token=null,sync_until=null where sync_token=p_token;
$$;

-- All mutation RPCs are server-only; public wrappers never elevate browser privileges.
create function public.claim_courtiq_checkout(p_owner uuid,p_request uuid,p_plan text,p_interval text,p_terms text,p_price text,p_amount integer) returns jsonb language sql security invoker set search_path='' as $$select private.claim_courtiq_checkout(p_owner,p_request,p_plan,p_interval,p_terms,p_price,p_amount)$$;
create function public.bind_courtiq_customer(p_owner uuid,p_customer text) returns void language sql security invoker set search_path='' as $$select private.bind_courtiq_customer(p_owner,p_customer)$$;
create function public.finish_courtiq_checkout(p_owner uuid,p_request uuid,p_session text,p_url text) returns void language sql security invoker set search_path='' as $$select private.finish_courtiq_checkout(p_owner,p_request,p_session,p_url)$$;
create function public.release_courtiq_checkout(p_owner uuid,p_request uuid) returns void language sql security invoker set search_path='' as $$select private.release_courtiq_checkout(p_owner,p_request)$$;
create function public.claim_courtiq_event(p_event text,p_type text,p_token uuid) returns text language sql security invoker set search_path='' as $$select private.claim_courtiq_event(p_event,p_type,p_token)$$;
create function public.begin_courtiq_sync(p_customer text,p_token uuid) returns text language sql security invoker set search_path='' as $$select private.begin_courtiq_sync(p_customer,p_token)$$;
create function public.apply_courtiq_snapshot(p_event text,p_token uuid,p_snapshot jsonb) returns void language sql security invoker set search_path='' as $$select private.apply_courtiq_snapshot(p_event,p_token,p_snapshot)$$;
create function public.finish_courtiq_event(p_event text,p_token uuid,p_ignored boolean) returns void language sql security invoker set search_path='' as $$select private.finish_courtiq_event(p_event,p_token,p_ignored)$$;
create function public.release_courtiq_event(p_event text,p_token uuid) returns void language sql security invoker set search_path='' as $$select private.release_courtiq_event(p_event,p_token)$$;
do $$ declare item record; begin
  for item in select p.oid::regprocedure identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname in ('claim_courtiq_checkout','bind_courtiq_customer','finish_courtiq_checkout','release_courtiq_checkout','claim_courtiq_event','begin_courtiq_sync','apply_courtiq_snapshot','finish_courtiq_event','release_courtiq_event')
  loop
    execute format('revoke all on function %s from public,anon,authenticated',item.identity);
    execute format('grant execute on function %s to service_role',item.identity);
  end loop;
end $$;
commit;
