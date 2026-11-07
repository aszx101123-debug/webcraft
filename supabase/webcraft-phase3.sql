-- WebCraft Phase 3: run in your own Supabase SQL Editor.
-- No real money or purchased-credit flows are implemented.
create extension if not exists pgcrypto;

create table if not exists public.wc_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_credits integer not null default 0 check (free_credits between 0 and 1000000),
  updated_at timestamptz not null default now()
);
create table if not exists public.wc_credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0 and amount between -1000000 and 1000000),
  reason text not null check (reason in ('daily_checkin')),
  created_at timestamptz not null default now(),
  unique(user_id,reason,created_at)
);
create table if not exists public.wc_daily_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  created_at timestamptz not null default now(),
  primary key(user_id,checkin_date)
);
create table if not exists public.wc_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.wc_suggestions (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('feature','bug','ui','other')),
  title text not null check (char_length(trim(title)) between 3 and 100),
  description text not null check (char_length(trim(description)) between 10 and 1400),
  status text not null default 'received' check (status in ('received','reviewing','accepted','on_hold','rejected')),
  review_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wc_suggestions_created_idx on public.wc_suggestions(created_at desc);
create index if not exists wc_suggestions_author_idx on public.wc_suggestions(author_id,created_at desc);

alter table public.wc_wallets enable row level security;
alter table public.wc_credit_ledger enable row level security;
alter table public.wc_daily_checkins enable row level security;
alter table public.wc_admins enable row level security;
alter table public.wc_suggestions enable row level security;
revoke all on public.wc_wallets,public.wc_credit_ledger,public.wc_daily_checkins,public.wc_admins,public.wc_suggestions from anon,authenticated;
grant select on public.wc_wallets,public.wc_credit_ledger,public.wc_suggestions,public.wc_admins to authenticated;
-- Users may insert their own suggestions. Status and review fields are protected by an INSERT policy.
grant insert(author_id,category,title,description) on public.wc_suggestions to authenticated;
grant usage,select on sequence public.wc_suggestions_id_seq to authenticated;
drop policy if exists wc_wallet_read on public.wc_wallets;
create policy wc_wallet_read on public.wc_wallets for select to authenticated using (user_id=auth.uid());
drop policy if exists wc_ledger_read on public.wc_credit_ledger;
create policy wc_ledger_read on public.wc_credit_ledger for select to authenticated using (user_id=auth.uid());
drop policy if exists wc_admin_read on public.wc_admins;
create policy wc_admin_read on public.wc_admins for select to authenticated using (user_id=auth.uid());
drop policy if exists wc_suggestions_read on public.wc_suggestions;
create policy wc_suggestions_read on public.wc_suggestions for select to authenticated using (true);
drop policy if exists wc_suggestions_insert on public.wc_suggestions;
create policy wc_suggestions_insert on public.wc_suggestions for insert to authenticated with check (
 author_id=auth.uid() and status='received' and review_reason=''
);

-- Date is based on Korean local calendar day. Atomic and idempotent per user and date.
create or replace function public.wc_claim_daily()
returns integer
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := auth.uid();
  today_kr date := (now() at time zone 'Asia/Seoul')::date;
  inserted integer;
  credits integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  insert into public.wc_daily_checkins(user_id,checkin_date)
  values(uid,today_kr) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    insert into public.wc_wallets(user_id,free_credits)
    values(uid,10)
    on conflict(user_id) do update
      set free_credits=public.wc_wallets.free_credits+10,updated_at=now();
    insert into public.wc_credit_ledger(user_id,amount,reason) values(uid,10,'daily_checkin');
  end if;
  select free_credits into credits from public.wc_wallets where user_id=uid;
  return coalesce(credits,0);
end;
$$;
revoke all on function public.wc_claim_daily() from public;
grant execute on function public.wc_claim_daily() to authenticated;

create or replace function public.wc_review_suggestion(p_id bigint,p_status text,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not exists(
    select 1 from public.wc_admins where user_id=auth.uid()
  ) then
    raise exception 'Admin only';
  end if;
  if p_status not in ('reviewing','accepted','on_hold','rejected') then raise exception 'Invalid status'; end if;
  if p_reason is null or char_length(trim(p_reason))<5 or char_length(p_reason)>500 then
    raise exception 'Review reason must be between 5 and 500 characters';
  end if;
  update public.wc_suggestions
    set status=p_status,review_reason=trim(p_reason),updated_at=now()
    where id=p_id;
  if not found then raise exception 'Suggestion not found'; end if;
end;
$$;
revoke all on function public.wc_review_suggestion(bigint,text,text) from public;
grant execute on function public.wc_review_suggestion(bigint,text,text) to authenticated;

-- IMPORTANT: an admin must be added from the Supabase SQL Editor AFTER signing in:
-- insert into public.wc_admins(user_id) values ('YOUR_AUTH_USER_UUID');
-- Do not expose service_role keys in GitHub Pages. Never import browser demo PC to real credit balances.
