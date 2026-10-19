-- Public beta account deletion request queue.
-- Users can create and view only their own request. Processing is manual during beta.
create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','completed','cancelled'))
);

alter table public.account_deletion_requests enable row level security;

revoke all on table public.account_deletion_requests from anon;
revoke all on table public.account_deletion_requests from authenticated;
grant select, insert on table public.account_deletion_requests to authenticated;

drop policy if exists account_deletion_requests_select_own on public.account_deletion_requests;
create policy account_deletion_requests_select_own
  on public.account_deletion_requests
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists account_deletion_requests_insert_own on public.account_deletion_requests;
create policy account_deletion_requests_insert_own
  on public.account_deletion_requests
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
  );
