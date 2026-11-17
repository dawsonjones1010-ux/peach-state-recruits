-- Peach State Recruits: database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run. Safe to run once.

-- ============ Tables ============

create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  sport         text,
  position      text,
  grad_year     int,
  school        text,
  team          text,
  location      text,
  height        text,
  weight        text,
  measurables   jsonb not null default '[]'::jsonb,   -- [{label, value}]
  stats         jsonb,                                -- {title, columns:[], rows:[[]]}
  academics     jsonb not null default '[]'::jsonb,   -- [{label, value}]
  links         jsonb not null default '[]'::jsonb,   -- [{label, url}]
  report        text,                                 -- scouting write-up (from the caption)
  cover_url     text,
  video_url     text,
  video_poster  text,
  post_url      text,
  ig_media_id   text unique,
  ig_account    text,
  views         text,                                 -- optional, typed in by admin, e.g. "22.9K"
  views_as_of   text,
  contact_email text,
  contact_name  text,
  owner_id      uuid references auth.users(id) on delete set null,
  owner_email   text,
  published     boolean not null default true,
  show_on_home  boolean not null default true,
  posted_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists players_posted_idx on public.players (posted_at desc);
create index if not exists players_owner_idx on public.players (owner_id);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Instagram accounts that sync to the site. Tokens are only readable by the server.
create table if not exists public.ig_accounts (
  handle       text primary key,          -- e.g. peachstaterecruits
  sport        text not null,             -- e.g. Baseball
  access_token text,
  expires_at   timestamptz,
  last_synced  timestamptz,
  last_result  text
);

insert into public.ig_accounts (handle, sport) values
  ('peachstaterecruits', 'Baseball'),
  ('peachstaterecruitsfb', 'Football')
on conflict (handle) do nothing;

-- ============ Helpers ============

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Players may only change their own editable fields. Everything else is locked unless you're an admin.
create or replace function public.guard_player_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  new.id := old.id; new.slug := old.slug; new.name := old.name; new.sport := old.sport;
  new.position := old.position; new.grad_year := old.grad_year;
  new.report := old.report; new.cover_url := old.cover_url; new.post_url := old.post_url;
  new.ig_media_id := old.ig_media_id; new.ig_account := old.ig_account;
  new.views := old.views; new.views_as_of := old.views_as_of;
  new.owner_id := old.owner_id; new.owner_email := old.owner_email;
  new.published := old.published; new.show_on_home := old.show_on_home;
  new.posted_at := old.posted_at; new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists players_guard on public.players;
create trigger players_guard before update on public.players
  for each row execute function public.guard_player_update();

-- ============ Security rules ============

alter table public.players enable row level security;
alter table public.admins enable row level security;
alter table public.ig_accounts enable row level security;   -- no policies: server only

drop policy if exists "Anyone can view published profiles" on public.players;
create policy "Anyone can view published profiles" on public.players
  for select using (published);

drop policy if exists "Players can view their own profile" on public.players;
create policy "Players can view their own profile" on public.players
  for select using (owner_id = auth.uid());

drop policy if exists "Players can edit their own profile" on public.players;
create policy "Players can edit their own profile" on public.players
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Admins can do everything" on public.players;
create policy "Admins can do everything" on public.players
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can see admin list" on public.admins;
create policy "Admins can see admin list" on public.admins
  for select using (user_id = auth.uid());

-- ============ File storage (covers, highlight videos) ============

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)            -- 50 MB per file
on conflict (id) do nothing;

drop policy if exists "Players upload to their own folder" on storage.objects;
create policy "Players upload to their own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'players'
    and exists (select 1 from public.players p
                where p.id::text = (storage.foldername(name))[2] and p.owner_id = auth.uid())
  );

drop policy if exists "Players replace their own files" on storage.objects;
create policy "Players replace their own files" on storage.objects
  for update to authenticated using (
    bucket_id = 'media'
    and exists (select 1 from public.players p
                where p.id::text = (storage.foldername(name))[2] and p.owner_id = auth.uid())
  );

drop policy if exists "Admins manage all files" on storage.objects;
create policy "Admins manage all files" on storage.objects
  for all to authenticated using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

-- ============ Make yourself the admin ============
-- 1) Sign up once on /admin.html with your email.
-- 2) Then run this line with your email filled in:
-- insert into public.admins (user_id) select id from auth.users where email = 'YOUR-EMAIL-HERE';
