-- Applied 2026-11-18: headline + player Instagram handles, player_videos table with security rules,
-- and fixed storage folder rules (they compared the player's name instead of the file path).
alter table public.players add column if not exists headline text;
alter table public.players add column if not exists player_instagram text[] not null default '{}';
-- guard_player_update(): headline is locked for players (owner/admin only), like report and cover.

create table if not exists public.player_videos (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  kind text not null check (kind in ('youtube','vimeo','hudl','instagram','link','file')),
  url text not null check (url ~ '^https://' and char_length(url) < 600),
  title text check (title is null or char_length(title) <= 120),
  storage_path text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.player_videos enable row level security;
-- Policies: public reads videos of published profiles; a player reads/adds/edits/deletes videos only on
-- the profile they own (players.owner_id = auth.uid()); admins manage all.
-- Storage (bucket media, 50 MB/file on the free plan): players may insert/update/delete/read only under
-- players/<their player id>/..., checked with storage.foldername(objects.name).
