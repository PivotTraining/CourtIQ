-- Prepared migration, NOT applied automatically. Requires verified owner RLS.
-- Atomic per-authenticated-account quota for expensive external AI requests.
begin;
create table if not exists public.courtiq_ai_request_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count between 0 and 10),
  last_requested_at timestamptz,
  primary key (user_id, usage_date)
);
alter table public.courtiq_ai_request_quota enable row level security;
revoke all on public.courtiq_ai_request_quota from public, anon, authenticated;
-- There are no direct client policies. Access is exclusively through this RPC.

create or replace function public.claim_courtiq_ai_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed boolean := false;
begin
  if (select auth.uid()) is null then return false; end if;
  insert into public.courtiq_ai_request_quota
    (user_id, usage_date, request_count, last_requested_at)
  values ((select auth.uid()), (clock_timestamp() at time zone 'UTC')::date, 1, clock_timestamp())
  on conflict (user_id, usage_date) do update
    set request_count = public.courtiq_ai_request_quota.request_count + 1,
        last_requested_at = clock_timestamp()
    where public.courtiq_ai_request_quota.request_count < 10
      and public.courtiq_ai_request_quota.last_requested_at < clock_timestamp() - interval '12 seconds'
  returning true into claimed;
  return coalesce(claimed, false);
end $$;
revoke all on function public.claim_courtiq_ai_request() from public, anon;
grant execute on function public.claim_courtiq_ai_request() to authenticated;
commit;
