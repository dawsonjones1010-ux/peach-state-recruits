-- v14: Player of the Week (one row at most). Public can read it; only the owner (public.is_admin()) writes it.
-- No row, or player_id null, means nothing is set and the homepage section stays hidden.
create table if not exists public.player_of_week (
  id          smallint primary key default 1 check (id = 1),
  player_id   uuid references public.players(id) on delete set null,
  note        text check (note is null or char_length(note) <= 160),
  week_of     date,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.player_of_week enable row level security;

revoke all on public.player_of_week from anon, authenticated;
grant select on public.player_of_week to anon, authenticated;
grant insert, update, delete on public.player_of_week to authenticated;

drop policy if exists "Public reads player of the week" on public.player_of_week;
create policy "Public reads player of the week" on public.player_of_week
  for select using (
    player_id is null
    or exists (select 1 from public.players p where p.id = player_id and p.published)
    or public.is_admin()
  );

drop policy if exists "Owner writes player of the week" on public.player_of_week;
create policy "Owner writes player of the week" on public.player_of_week
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Only a published player can be picked; stamp who/when.
create or replace function public.guard_player_of_week() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.player_id is not null and not exists (select 1 from public.players p where p.id = new.player_id and p.published) then
    raise exception 'Player of the Week must be a published player';
  end if;
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists player_of_week_guard on public.player_of_week;
create trigger player_of_week_guard before insert or update on public.player_of_week
  for each row execute function public.guard_player_of_week();
