-- SSA LMS Phase 12 (2026-10-22): student course reviews + Nowshin
-- 👍/👎 feedback store — Founder orders: "Can we read their feedback
-- and analyse them, through their Review?" and "What people ask to
-- Nowshin — are they happy with the answer of Nowshin or not?"
-- Run in the Supabase SQL editor (project actykevvljlwoxjybagw), in
-- the same deploy batch as the app update. Safe to re-run.
--
-- reviews: one review per student per course. PRIVACY: a student can
-- read / write ONLY their own review; the Super Admin (role = 'admin',
-- via the existing public.is_admin()) reads them all. Nobody else —
-- not other students, not staff, not anonymous visitors — can read
-- any review.
--
-- nowshin_feedback: one row per 👍/👎 tap in the Nowshin chat widget.
-- Visitors are mostly anonymous, so INSERT is open to anon and
-- authenticated roles (a vote carries no private account data), but
-- SELECT is admin-only — the raw questions/answers and the happy-%
-- are visible ONLY inside the Super Admin (and to the AI Analyst,
-- which runs with the admin's own session). No update/delete at all.

create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_slug text not null,
  rating int not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_slug)
);

create index if not exists reviews_course_idx
  on public.reviews (course_slug, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "reviews read own or admin" on public.reviews;
create policy "reviews read own or admin" on public.reviews
  for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own" on public.reviews
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "reviews update own" on public.reviews;
create policy "reviews update own" on public.reviews
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reviews delete admin" on public.reviews;
create policy "reviews delete admin" on public.reviews
  for delete
  using (public.is_admin());

create table if not exists public.nowshin_feedback (
  id bigint generated always as identity primary key,
  question text,
  answer text,
  vote text not null check (vote in ('up', 'down')),
  page text,
  created_at timestamptz not null default now()
);

create index if not exists nowshin_feedback_created_idx
  on public.nowshin_feedback (created_at desc);

alter table public.nowshin_feedback enable row level security;

drop policy if exists "nowshin feedback insert anyone" on public.nowshin_feedback;
create policy "nowshin feedback insert anyone" on public.nowshin_feedback
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "nowshin feedback read admin" on public.nowshin_feedback;
create policy "nowshin feedback read admin" on public.nowshin_feedback
  for select
  using (public.is_admin());
