-- Inactive by default: this changes only the interpretation of a provider-verified
-- trialing subscription when the separately reviewed billing policy is enforced.
-- Must be applied AFTER all existing CourtIQ subscription migrations.
begin;
do $$ begin
  if to_regclass('private.courtiq_billing_policy') is null or to_regclass('public.courtiq_subscriptions') is null
  then raise exception 'Apply the CourtIQ subscription foundation before enabling trialing access'; end if;
end $$;
create or replace function private.get_courtiq_billing() returns jsonb
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
  active_paid:=sub.status in ('active','trialing') and sub.period_end>current_time_value and not sub.paused;
  active_trial:=trial->>'status'='active';
  return jsonb_build_object('enabled',policy.enabled,'enforced',policy.enforce_access,
    'server_now',current_time_value,'trial',trial,
    'access',case when not policy.enforce_access or (policy.grandfather_before is not null and account.created_at<policy.grandfather_before) then 'legacy'
      when active_paid then sub.plan when active_trial then 'trial' else 'read_only' end,
    'subscription',case when sub.subscription_id is null then null else jsonb_build_object(
      'plan',sub.plan,'interval',sub.interval,'status',sub.status,'period_end',sub.period_end,
      'cancel_at_period_end',sub.cancel_at_period_end,'paused',sub.paused,'synced_at',sub.synced_at) end);
end $$;
commit;
