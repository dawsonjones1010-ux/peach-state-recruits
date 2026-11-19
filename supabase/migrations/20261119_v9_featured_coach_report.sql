-- v9: homepage featured examples, coach summary, optional feature date (owner-only fields)
alter table public.players
  add column if not exists coach_report text,
  add column if not exists featured_rank smallint,
  add column if not exists feature_date date;
-- guard_player_update() also keeps coach_report, featured_rank and feature_date owner-only
-- (players can't change them from the account page). See the applied function in the project.
