-- v17: Find My Level opt-in free review ("Send my numbers to Peach State for a free look").
-- Rows arrive only when a visitor taps Send. Anyone may insert; only the owner/admin can read or update.
create table if not exists public.level_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ig_handle text not null check (char_length(ig_handle) between 1 and 31 and ig_handle ~ '^[A-Za-z0-9._]+$'),
  grad_year integer check (grad_year between 2020 and 2040),
  positions text check (char_length(positions) <= 20),
  throws text check (char_length(throws) <= 2),
  bats text check (char_length(bats) <= 2),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object' and pg_column_size(metrics) < 4000),
  methods jsonb not null default '{}'::jsonb check (jsonb_typeof(methods) = 'object' and pg_column_size(methods) < 4000),
  headline text check (char_length(headline) <= 400),
  data_version text check (char_length(data_version) <= 20),
  status text not null default 'new' check (status in ('new', 'contacted', 'done')),
  owner_note text check (char_length(owner_note) <= 2000)
);
alter table public.level_reviews enable row level security;
drop policy if exists "Anyone can send a review request" on public.level_reviews;
create policy "Anyone can send a review request" on public.level_reviews
  for insert to anon, authenticated with check (status = 'new' and owner_note is null);
drop policy if exists "Owner reads review requests" on public.level_reviews;
create policy "Owner reads review requests" on public.level_reviews
  for select to authenticated using (public.is_admin());
drop policy if exists "Owner updates review requests" on public.level_reviews;
create policy "Owner updates review requests" on public.level_reviews
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Owner deletes review requests" on public.level_reviews;
create policy "Owner deletes review requests" on public.level_reviews
  for delete to authenticated using (public.is_admin());
revoke all on public.level_reviews from anon;
grant insert (ig_handle, grad_year, positions, throws, bats, metrics, methods, headline, data_version) on public.level_reviews to anon;
grant select, insert, update, delete on public.level_reviews to authenticated;
