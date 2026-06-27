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
  repetitions integer not null default 0,
  interval integer not null default 0,
  easiness double precision not null default 2.5,
  next_review_at timestamp with time zone not null default now(),
  wrong_count integer not null default 0
);

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  word_id uuid references public.wordbase(id) on delete cascade,
  reviewed_at timestamp with time zone not null default now(),
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

alter table public.wordbase enable row level security;
alter table public.review_logs enable row level security;
alter table study.target enable row level security;

drop policy if exists "允许登录用户管理自己的单词" on public.wordbase;
create policy "允许登录用户管理自己的单词"
on public.wordbase
as permissive
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "允许登录用户管理自己的复习日志" on public.review_logs;
create policy "允许登录用户管理自己的复习日志"
on public.review_logs
as permissive
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "允许登录用户管理自己的学习目标" on study.target;
create policy "允许登录用户管理自己的学习目标"
on study.target
as permissive
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_wordbase_user_id on public.wordbase (user_id);
create index if not exists idx_wordbase_next_review_at on public.wordbase (next_review_at);
create index if not exists idx_wordbase_review on public.wordbase (user_id, next_review_at);
create index if not exists idx_wordbase_tag on public.wordbase (user_id, book_tag);
create index if not exists idx_review_logs_user_id on public.review_logs (user_id);
create index if not exists idx_review_logs_word_id on public.review_logs (word_id);
create index if not exists idx_review_logs_date on public.review_logs (user_id, reviewed_at);

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema study to anon, authenticated, service_role;

grant select, insert, update, delete on public.wordbase to authenticated;
grant select, insert, update, delete on public.review_logs to authenticated;
grant select, insert, update, delete on study.target to authenticated;

grant all on public.wordbase to service_role;
grant all on public.review_logs to service_role;
grant all on study.target to service_role;
