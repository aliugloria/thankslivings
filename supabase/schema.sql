-- Amen counter: one atomic increment, so two people pressing at once never lose a count.
-- Only the server (service role) may call it.
create or replace function public.increment_amen(t_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.testimonies
     set amens = amens + 1
   where id = t_id and status = 'approved'
  returning amens;
$$;

revoke execute on function public.increment_amen(uuid) from public, anon, authenticated;
grant execute on function public.increment_amen(uuid) to service_role;

-- Rhema Word for the Day: add one row a day in the Table Editor.
-- `date` is the Lagos calendar day it should appear on.
create table if not exists public.daily_words (
  date   date primary key,
  word   text not null,
  points text[] not null default '{}'
);

alter table public.daily_words enable row level security;

create policy "read daily words" on public.daily_words
  for select using (true);