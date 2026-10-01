-- Staged only. No billing, free-tier restrictions or analytics turn on here.
begin;
do $$ begin
  if to_regclass('private.courtiq_billing_policy') is null then
    raise exception 'Apply the CourtIQ subscription foundation first';
  end if;
end $$;
create table private.courtiq_starter_policy (
  id boolean primary key default true check(id), enabled boolean not null default false
);
insert into private.courtiq_starter_policy(id) values(true);
-- Never silently move existing accounts into the free tier on activation.
create function private.courtiq_starter_activation_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='courtiq_starter_policy' then
    if new.enabled and not exists(select 1 from private.courtiq_billing_policy where id and enforce_access and grandfather_before is not null) then
      raise exception 'Review and set billing enforcement and the existing-account grandfather cutoff before activating the free starter';
    end if;
  elsif (select enabled from private.courtiq_starter_policy where id) and (not new.enforce_access or new.grandfather_before is null) then
    raise exception 'Disable the free starter before removing its enforcement or grandfather cutoff';
  end if;
  return new;
end $$;
revoke all on function private.courtiq_starter_activation_guard() from public,anon,authenticated;
create trigger courtiq_starter_activation_guard before update on private.courtiq_starter_policy
  for each row execute function private.courtiq_starter_activation_guard();
create trigger courtiq_starter_billing_guard before update on private.courtiq_billing_policy
  for each row execute function private.courtiq_starter_activation_guard();
create table private.courtiq_starter_usage (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  request_id uuid not null unique,
  started_at timestamptz not null default clock_timestamp()
);
alter table private.courtiq_starter_policy enable row level security;
alter table private.courtiq_starter_usage enable row level security;
revoke all on private.courtiq_starter_policy,private.courtiq_starter_usage from public,anon,authenticated;
grant all on private.courtiq_starter_policy,private.courtiq_starter_usage to service_role;

create function private.get_courtiq_starter() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); state jsonb; usage private.courtiq_starter_usage;
begin
  state:=private.get_courtiq_billing();
  if not (select enabled from private.courtiq_starter_policy where id) then
    return jsonb_build_object('mode','legacy','workout','unavailable','billing',state);
  end if;
  select * into usage from private.courtiq_starter_usage where owner_id=uid;
  return jsonb_build_object('mode',case when state->>'access'='read_only' then 'free' else 'full' end,
    'workout',case when usage.owner_id is null then 'available' else 'used' end,'billing',state);
end $$;
create function public.get_courtiq_starter() returns jsonb language sql security invoker set search_path=''
  as $$select private.get_courtiq_starter()$$;

create function private.claim_courtiq_starter(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); state jsonb; usage private.courtiq_starter_usage;
begin
  if p_request is null then raise exception 'Request id required'; end if;
  state:=private.get_courtiq_starter();
  if state->>'mode'<>'free' then raise exception 'Free starter is not available' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then
    raise exception 'Verify your email first' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,31));
  select * into usage from private.courtiq_starter_usage where owner_id=uid;
  if found then
    if usage.request_id<>p_request then raise exception 'Free workout already used' using errcode='42501'; end if;
    return jsonb_build_object('granted',true,'request_id',usage.request_id);
  end if;
  insert into private.courtiq_starter_usage(owner_id,request_id) values(uid,p_request);
  return jsonb_build_object('granted',true,'request_id',p_request);
end $$;
create function public.claim_courtiq_starter(p_request uuid) returns jsonb language sql security invoker set search_path=''
  as $$select private.claim_courtiq_starter(p_request)$$;
revoke all on function private.get_courtiq_starter(),public.get_courtiq_starter(),
  private.claim_courtiq_starter(uuid),public.claim_courtiq_starter(uuid) from public,anon;
grant execute on function private.get_courtiq_starter(),public.get_courtiq_starter(),
  private.claim_courtiq_starter(uuid),public.claim_courtiq_starter(uuid) to authenticated;

-- Existing reads remain available. Restrictions only apply when billing enforcement is enabled.
create trigger courtiq_new_journal_access before insert on public.journal_entries
  for each row execute function private.courtiq_record_access('player');
create trigger courtiq_new_workout_access before insert on public.workout_results
  for each row execute function private.courtiq_record_access('player');
alter table public.sessions add column coverage_confirmed boolean not null default false;
comment on column public.sessions.coverage_confirmed is 'Owner attests entire game shot ledger and box score, including minutes, are recorded; not independently verified.';
commit;
