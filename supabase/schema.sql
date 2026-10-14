-- Schema for when you swap the in-memory store (lib/server/store.ts) for Supabase.
-- Only the country is stored: dot positions are derived client-side, so no precise location ever exists.

create table if not exists public.testimonies (
  id          uuid primary key default gen_random_uuid(),
  name        text check (name is null or char_length(name) <= 40),
  country_code char(2) not null,
  text        text not null check (char_length(text) between 10 and 280),
  status      text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  amens       integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists testimonies_status_created_idx
  on public.testimonies (status, created_at desc);

alter table public.testimonies enable row level security;

-- Anyone can read approved testimonies. Writes go through the route handlers
-- using the service role key, which bypasses RLS, so no public insert policy is needed.
create policy "read approved" on public.testimonies
  for select using (status = 'approved');
