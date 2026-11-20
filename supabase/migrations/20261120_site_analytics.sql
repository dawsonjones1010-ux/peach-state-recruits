-- Cookie-free visitor counts for the owner dashboard.
-- Stores no IP address, no user id, no device fingerprint: only the page, the referring
-- site's hostname, campaign tags and a coarse device type. Visitors can't read any of it.
create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null check (char_length(path) between 1 and 120),
  ref text check (ref is null or char_length(ref) <= 60),
  utm_source text check (utm_source is null or char_length(utm_source) <= 40),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 40),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 60),
  device text check (device in ('phone','tablet','desktop')),
  first_page boolean not null default false
);
create index if not exists site_events_created_idx on public.site_events(created_at desc);
alter table public.site_events enable row level security;

drop policy if exists site_events_insert on public.site_events;
create policy site_events_insert on public.site_events for insert to anon, authenticated
  with check (created_at > now() - interval '5 minutes' and created_at < now() + interval '5 minutes');
drop policy if exists site_events_owner_read on public.site_events;
create policy site_events_owner_read on public.site_events for select to authenticated
  using ((select public.is_admin()));

revoke all on public.site_events from public, anon, authenticated;
grant insert (path, ref, utm_source, utm_medium, utm_campaign, device, first_page) on public.site_events to anon, authenticated;
grant select on public.site_events to authenticated;

-- Owner-only summary. Returns null for everyone else.
create or replace function public.site_stats(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  with e as (
    select * from public.site_events
    where created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  )
  select case when public.is_admin() then jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 365)),
    'views', (select count(*) from e),
    'visits', (select count(*) from e where first_page),
    'views_today', (select count(*) from e where created_at >= date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'views', v, 'visits', s) order by d) from (
        select (created_at at time zone 'America/New_York')::date d, count(*) v, count(*) filter (where first_page) s from e group by 1) x), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'views', v) order by v desc) from (
        select path, count(*) v from e group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', src, 'visits', v) order by v desc) from (
        select coalesce(nullif(utm_source, ''), nullif(ref, ''), 'direct') src, count(*) v from e where first_page group by 1 order by 2 desc limit 10) x), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(jsonb_build_object('campaign', c, 'visits', v) order by v desc) from (
        select utm_campaign c, count(*) v from e where first_page and utm_campaign is not null group by 1 order by 2 desc limit 10) x), '[]'::jsonb),
    'devices', coalesce((select jsonb_object_agg(device, v) from (
        select coalesce(device, 'desktop') device, count(*) v from e where first_page group by 1) x), '{}'::jsonb)
  ) else null end;
$$;
revoke all on function public.site_stats(integer) from public, anon;
grant execute on function public.site_stats(integer) to authenticated;
