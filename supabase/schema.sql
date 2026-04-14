-- Run in Supabase SQL Editor (Dashboard → SQL).
-- Enables tables + realtime for the GigShield dashboard.

create extension if not exists "pgcrypto";

create table if not exists public.workers (
  id uuid primary key,
  name text,
  avg_hourly_earnings numeric,
  tier text,
  tenure_weeks int default 0,
  updated_at timestamptz default now()
);

create table if not exists public.risk_scores (
  id bigserial primary key,
  worker_id uuid not null references public.workers (id) on delete cascade,
  risk_score int not null,
  updated_at timestamptz default now(),
  constraint risk_scores_worker_id_key unique (worker_id)
);

create table if not exists public.payouts (
  id bigserial primary key,
  worker_id uuid not null references public.workers (id) on delete cascade,
  amount numeric not null,
  disrupted_hours numeric,
  severity_multiplier numeric,
  created_at timestamptz default now()
);

create index if not exists payouts_worker_id_idx on public.payouts (worker_id);

alter publication supabase_realtime add table public.risk_scores;

alter table public.workers enable row level security;
alter table public.risk_scores enable row level security;
alter table public.payouts enable row level security;

-- Demo policies: tighten for production (use Supabase Auth + user-scoped policies).
create policy "workers demo all" on public.workers for all using (true) with check (true);
create policy "risk_scores demo all" on public.risk_scores for all using (true) with check (true);
create policy "payouts demo all" on public.payouts for all using (true) with check (true);

-- Fraud pipeline tables required by the claim processor.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  zone text,
  pincode text,
  created_at timestamptz default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  zone text not null,
  claimed_weather text,
  lost_hours numeric not null,
  status text default 'SUBMITTED',
  trust_score int,
  decision text,
  payout_amount numeric default 0,
  pipeline jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create table if not exists public.fraud_logs (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  fraud_score int not null,
  reasons jsonb default '[]'::jsonb,
  trust_score int,
  created_at timestamptz default now()
);

create table if not exists public.payout_logs (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  transaction_id text not null,
  provider text,
  amount numeric not null,
  status text not null,
  created_at timestamptz default now()
);
