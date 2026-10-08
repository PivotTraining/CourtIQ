-- Deliberately inactive until billing entitlements and sandbox lifecycle QA exist.
begin;
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create table private.courtiq_trial_policy (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  new_user_since timestamptz not null default clock_timestamp()
);
insert into private.courtiq_trial_policy(id) values(true);
revoke all on private.courtiq_trial_policy from public,anon,authenticated;
create table public.account_trials (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  constraint exactly_ten_days check(ends_at=started_at+interval '240 hours')
);
alter table public.account_trials enable row level security;
revoke all on public.account_trials from public,anon,authenticated;
grant select on public.account_trials to authenticated;
create policy account_trials_owner_read on public.account_trials for select to authenticated
  using(owner_id=(select auth.uid()));

create function private.get_courtiq_trial() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); existing public.account_trials; policy private.courtiq_trial_policy;
  account auth.users; current_time_value timestamptz:=clock_timestamp();
begin
  select * into account from auth.users where id=uid;
  if uid is null or account.id is null then raise exception 'Authenticated account required.' using errcode='42501'; end if;
  select * into existing from public.account_trials where owner_id=uid;
  if found then
    return jsonb_build_object('status',case when current_time_value<existing.ends_at then 'active' else 'expired' end,
      'started_at',existing.started_at,'ends_at',existing.ends_at,'server_now',current_time_value,
      'remaining_seconds',greatest(0,ceil(extract(epoch from existing.ends_at-current_time_value))),
      'days',10,'auto_charge',false);
  end if;
  select * into policy from private.courtiq_trial_policy where id;
  return jsonb_build_object('status',case when not policy.enabled then 'unavailable'
      when account.email_confirmed_at is null then 'verify_email'
      when account.created_at<policy.new_user_since then 'ineligible' else 'eligible' end,
    'days',10,'server_now',current_time_value,'auto_charge',false);
end $$;

create function private.start_courtiq_trial() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); state jsonb; started timestamptz;
begin
  state:=private.get_courtiq_trial();
  -- Retry, refresh, plan or device changes never create a new trial window.
  if state->>'status' in ('active','expired') then return state; end if;
  if state->>'status'<>'eligible' then raise exception 'New-user trial is not available for this account.' using errcode='42501'; end if;
  started:=clock_timestamp();
  insert into public.account_trials(owner_id,started_at,ends_at)
    values(uid,started,started+interval '240 hours') on conflict(owner_id) do nothing;
  return private.get_courtiq_trial();
end $$;
create function public.get_courtiq_trial() returns jsonb language sql security invoker set search_path=''
  as $$select private.get_courtiq_trial()$$;
create function public.start_courtiq_trial() returns jsonb language sql security invoker set search_path=''
  as $$select private.start_courtiq_trial()$$;
revoke all on function private.get_courtiq_trial(),private.start_courtiq_trial(),public.get_courtiq_trial(),public.start_courtiq_trial() from public,anon;
grant execute on function private.get_courtiq_trial(),private.start_courtiq_trial(),public.get_courtiq_trial(),public.start_courtiq_trial() to authenticated;
commit;
