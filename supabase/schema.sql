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
