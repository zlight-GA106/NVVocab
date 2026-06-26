create extension if not exists "pgcrypto";

create schema if not exists study;

create table if not exists public.wordbase (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  words text not null,
  translate text not null,
  phonetic text,
  book_tag text default U&'\672A\5206\7C7B'::text,
  introtime timestamp with time zone default now(),
  repetitions integer default 0,
  interval integer default 1,
  easiness double precision default 2.5,
  next_review_at timestamp with time zone default now(),
  wrong_count integer default 0
);

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  word_id uuid references public.wordbase(id) on delete cascade,
  reviewed_at timestamp with time zone default now(),
  quality integer not null
);

create table if not exists study.target (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  title text not null,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  status text default 'active'::text,
  time_invested_seconds integer default 0,
  created_at timestamp with time zone default now(),
  daily_word_target integer default 50
);

create index if not exists idx_wordbase_review
  on public.wordbase using btree (user_id, next_review_at);

create index if not exists idx_wordbase_tag
  on public.wordbase using btree (user_id, book_tag);

create index if not exists idx_review_logs_date
  on public.review_logs using btree (user_id, reviewed_at);

alter table public.wordbase enable row level security;
alter table public.review_logs enable row level security;
alter table study.target enable row level security;

grant usage on schema study to anon, authenticated, service_role;
grant all on table public.wordbase to anon, authenticated, service_role;
grant all on table public.review_logs to anon, authenticated, service_role;
grant all on table study.target to anon, authenticated, service_role;

drop policy if exists "allow_authenticated_manage_own_words" on public.wordbase;
create policy "allow_authenticated_manage_own_words"
on public.wordbase
as permissive
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "allow_authenticated_manage_own_review_logs" on public.review_logs;
create policy "allow_authenticated_manage_own_review_logs"
on public.review_logs
as permissive
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "allow_authenticated_manage_own_study_targets" on study.target;
create policy "allow_authenticated_manage_own_study_targets"
on study.target
as permissive
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
