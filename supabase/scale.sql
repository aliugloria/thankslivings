-- Run this ONCE in the Supabase SQL editor (safe to re-run). It makes the site fast at any size.

-- 1. Per-country counts for the globe: one tiny result however many testimonies exist.
create or replace function public.country_counts()
returns table (country_code text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select t.country_code::text, count(*)
    from public.testimonies t
   where t.status = 'approved'
   group by t.country_code;
$$;

revoke execute on function public.country_counts() from public, anon, authenticated;
grant execute on function public.country_counts() to service_role;

-- 2. Indexes the site's queries use, so none of them scan the whole table.
--    feed: newest-first paging (and the "last 24 hours" count)
create index if not exists testimonies_feed_idx
  on public.testimonies (status, created_at desc, id desc);

--    counts: lets country_counts() be answered from the index alone
create index if not exists testimonies_country_idx
  on public.testimonies (country_code) where status = 'approved';



------------ 50k STRESS TEST . PASTE ON SQL EDITOR ON SUPABASE ----------------------
-- insert into testimonies (name, country_code, text, created_at)
-- select 'STRESS',
--        (array['NG','US','GB','GH','KE','ZA','IN','BR','CA','DE','AU','PH'])[1+floor(random()*12)],
--        'Stress test testimony number ' || g,
--        now() - (g || ' seconds')::interval
-- from generate_series(1,50000) g;


------------ delete 50k STRESS TEST . PASTE ON SQL EDITOR ON SUPABASE ----------------------

delete from testimonies where name = 'STRESS';