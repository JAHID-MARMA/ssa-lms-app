-- SSA LMS Phase 11 (2026-10-22): Super Admin income & expense management
-- (আয়-ব্যয়) — Founder order: "Will u add for any expense income
-- management" + "This will be saved in drive through google sheet with
-- high security. If mistake there will be editable."
-- Run in the Supabase SQL editor (project actykevvljlwoxjybagw), in the
-- same deploy batch as the app update. Safe to re-run.
--
-- SECURITY: this table is admin-only. RLS is enabled and the single
-- policy below lets ONLY profiles with role = 'admin' (checked by the
-- existing public.is_admin()) read or write anything. Students, staff
-- and anonymous visitors get NO access at all — not even read.
-- Approved SALES income is NOT stored here: the আয়-ব্যয় tab merges it
-- live from public.orders (approved/completed only), so a sale can
-- never be double-counted or edited from two places.

create table if not exists public.finance_entries (
  id bigint generated always as identity primary key,
  entry_date date not null,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_entries_date_idx
  on public.finance_entries (entry_date desc);

alter table public.finance_entries enable row level security;

drop policy if exists "finance admin all" on public.finance_entries;
create policy "finance admin all" on public.finance_entries
  for all
  using (public.is_admin())
  with check (public.is_admin());
