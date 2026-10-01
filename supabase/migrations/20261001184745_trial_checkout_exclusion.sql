-- Additive guard: never overlap a no-card trial with a subscription or a checkout
-- that may still complete. Existing rows, history and trial deadlines are retained.
begin;
create or replace function private.start_courtiq_trial() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); state jsonb; started timestamptz;
begin
  state:=private.get_courtiq_trial(); -- authenticates before acquiring owner lock
  perform pg_advisory_xact_lock(hashtextextended(uid::text,10));
  if exists(select 1 from public.courtiq_subscriptions where owner_id=uid and status not in ('canceled','incomplete_expired')) then
    raise exception 'Manage the existing subscription instead; it can still bill.' using errcode='42501';
  end if;
  if exists(select 1 from private.courtiq_checkout_requests where owner_id=uid and expires_at>clock_timestamp()) then
    raise exception 'A paid checkout is still pending. Let it expire or manage the resulting subscription before starting a trial.' using errcode='42501';
  end if;
  state:=private.get_courtiq_trial(); -- reread eligibility and deadline after the lock
  if state->>'status' in ('active','expired') then return state; end if;
  if state->>'status'<>'eligible' then raise exception 'New-user trial is not available for this account.' using errcode='42501'; end if;
  started:=clock_timestamp();
  insert into public.account_trials(owner_id,started_at,ends_at)
    values(uid,started,started+interval '240 hours') on conflict(owner_id) do nothing;
  return private.get_courtiq_trial();
end $$;

create or replace function private.claim_courtiq_checkout(p_owner uuid,p_request uuid,p_plan text,p_interval text,p_terms text,p_price text,p_amount integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row private.courtiq_checkout_requests; now_value timestamptz;
begin
  if not (select enabled from private.courtiq_billing_policy where id) then raise exception 'Billing inactive'; end if;
  if not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null) then raise exception 'Verified account required'; end if;
  if p_request is null or p_plan not in ('player','coach') or p_interval not in ('month','year') or p_terms is null or char_length(p_terms) not between 1 and 100 then raise exception 'Invalid checkout'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,10));
  now_value:=clock_timestamp();
  if exists(select 1 from public.courtiq_subscriptions where owner_id=p_owner and status not in ('canceled','incomplete_expired')) then raise exception 'Manage the existing subscription instead'; end if;
  if exists(select 1 from public.account_trials where owner_id=p_owner and ends_at>now_value) then
    raise exception 'Your no-card trial is still active. Paid checkout is available after it ends.' using errcode='42501';
  end if;
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
-- CREATE OR REPLACE retains the existing, separately scoped authenticated trial
-- and service-role-only checkout execution grants from the canonical migrations.
commit;
