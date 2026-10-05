-- Inactive scheduled recovery. Apply only after reviewed subscription migrations.
begin;
alter table private.courtiq_billing_policy
  add column reconciliation_enabled boolean not null default false;
alter table public.courtiq_billing_accounts
  add column reconciliation_due_at timestamptz not null default clock_timestamp(),
  add column reconciliation_token uuid,
  add column reconciliation_until timestamptz,
  add column reconciliation_checked_at timestamptz,
  add column reconciliation_result text check(reconciliation_result in ('synchronized','retry','review'));
create index courtiq_reconciliation_due on public.courtiq_billing_accounts(reconciliation_due_at,owner_id)
  where customer_id is not null;

create function private.claim_courtiq_reconciliation(p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare selected public.courtiq_billing_accounts;
begin
  if p_token is null then raise exception 'Recovery token required'; end if;
  if not exists(select 1 from private.courtiq_billing_policy where id and enabled and reconciliation_enabled) then
    raise exception 'Scheduled billing recovery inactive'; end if;
  select * into selected from public.courtiq_billing_accounts
    where customer_id is not null and reconciliation_due_at<=clock_timestamp()
      and (reconciliation_until is null or reconciliation_until<=clock_timestamp())
    order by reconciliation_due_at,owner_id for update skip locked limit 1;
  if not found then return null; end if;
  update public.courtiq_billing_accounts set reconciliation_token=p_token,
    reconciliation_until=clock_timestamp()+interval '5 minutes' where owner_id=selected.owner_id;
  return jsonb_build_object('owner_id',selected.owner_id,'customer_id',selected.customer_id);
end $$;

create function private.finish_courtiq_reconciliation(p_owner uuid,p_token uuid,p_result text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_result is null or p_result not in ('synchronized','retry','review') then raise exception 'Invalid recovery result'; end if;
  update public.courtiq_billing_accounts set reconciliation_token=null,reconciliation_until=null,
    reconciliation_checked_at=clock_timestamp(),reconciliation_result=p_result,
    reconciliation_due_at=clock_timestamp()+case p_result
      when 'synchronized' then interval '6 hours' when 'review' then interval '1 day' else interval '5 minutes' end
    where owner_id=p_owner and reconciliation_token=p_token and reconciliation_until>clock_timestamp();
  if not found then raise exception 'Recovery lease changed or expired'; end if;
end $$;

create function public.claim_courtiq_reconciliation(p_token uuid) returns jsonb language sql security invoker set search_path=''
  as $$select private.claim_courtiq_reconciliation(p_token)$$;
create function public.finish_courtiq_reconciliation(p_owner uuid,p_token uuid,p_result text) returns void language sql security invoker set search_path=''
  as $$select private.finish_courtiq_reconciliation(p_owner,p_token,p_result)$$;
revoke all on function private.claim_courtiq_reconciliation(uuid),public.claim_courtiq_reconciliation(uuid),
  private.finish_courtiq_reconciliation(uuid,uuid,text),public.finish_courtiq_reconciliation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.claim_courtiq_reconciliation(uuid),public.claim_courtiq_reconciliation(uuid),
  private.finish_courtiq_reconciliation(uuid,uuid,text),public.finish_courtiq_reconciliation(uuid,uuid,text) to service_role;
commit;
