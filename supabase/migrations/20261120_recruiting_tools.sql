-- Peach State Recruits: recruiting tools (College Finder, Saved Schools, Emails & Tracker, Plan, Camps)
-- Private player data is readable and writable only by its owner (auth.uid()).
-- Admins (recruiting_admins, plus legacy is_admin() when present) manage the public directories: programs, camps, rules.
-- Admins do NOT get read access to players' private recruiting data.

-- UUID defaults use built-in gen_random_uuid() (PostgreSQL 13+).

-- Independent admin bootstrap: grant membership only through trusted server SQL.
create table if not exists public.recruiting_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.recruiting_admins enable row level security;
drop policy if exists recruiting_admins_self on public.recruiting_admins;
create policy recruiting_admins_self on public.recruiting_admins for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.recruiting_admins from public, anon, authenticated;
grant select on public.recruiting_admins to authenticated;
create or replace function public.is_recruiting_admin() returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare legacy boolean := false;
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.recruiting_admins where user_id = auth.uid()) then return true; end if;
  if to_regprocedure('public.is_admin()') is not null then
    execute 'select public.is_admin()' into legacy;
  end if;
  return coalesce(legacy, false);
end $$;
revoke all on function public.is_recruiting_admin() from public;
grant execute on function public.is_recruiting_admin() to anon, authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- programs
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  level text not null check (level in ('NCAA D1','NCAA D2','NCAA D3','NAIA','JUCO')),
  association text not null default 'NCAA' check (association in ('NCAA','NAIA','NJCAA','CCCAA','NWAC','Other')),
  conference text,
  city text,
  state text,
  -- official links (school / athletics / NCAA / NAIA / NJCAA pages only)
  website_url text,
  athletics_url text,
  roster_url text,
  schedule_url text,
  camps_url text,
  questionnaire_url text,
  -- academics and cost (from U.S. Dept. of Education College Scorecard / IPEDS); blank when not loaded
  ipeds_unitid integer,
  undergrad_enrollment integer,
  admission_rate numeric(5,4),
  sat_25 integer, sat_75 integer,
  act_25 integer, act_75 integer,
  grad_rate numeric(5,4),
  tuition_in_state integer,
  tuition_out_state integer,
  avg_net_price integer,
  academic_year text,          -- reporting year of the academic/cost numbers, e.g. '2022-23'
  academic_source_url text,
  -- provenance and review
  listing_source text,         -- where the directory row came from
  listing_source_url text,
  record_status text not null default 'unverified' check (record_status in ('unverified','verified','needs_review','hidden')),
  last_checked date,           -- date a person confirmed the official links; null = never checked
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.programs add column if not exists staff_url text;
alter table public.programs add column if not exists majors_url text;
create index if not exists programs_level_idx on public.programs(level);
create index if not exists programs_state_idx on public.programs(state);
create index if not exists programs_name_idx on public.programs using gin (to_tsvector('simple', name));
drop trigger if exists programs_touch on public.programs;
create trigger programs_touch before update on public.programs for each row execute function public.touch_updated_at();
alter table public.programs enable row level security;
drop policy if exists programs_read on public.programs;
create policy programs_read on public.programs for select to anon, authenticated
  using (record_status <> 'hidden' or (select public.is_recruiting_admin()));
drop policy if exists programs_admin_write on public.programs;
create policy programs_admin_write on public.programs for all to authenticated
  using ((select public.is_recruiting_admin())) with check ((select public.is_recruiting_admin()));

-- ---------------------------------------------------------------- recruiting rules (official sources)
create table if not exists public.recruiting_rules (
  id uuid primary key default gen_random_uuid(),
  level text not null,                 -- 'NCAA D1','NCAA D2','NCAA D3','NAIA','JUCO','All'
  topic text not null,                 -- 'contact', 'visits', 'eligibility', ...
  summary text not null,
  applies_when text,                   -- e.g. 'Aug 1 before junior year'
  rule_key text unique,                -- used by the plan engine, e.g. 'd1_contact_start'
  source_name text not null,
  source_url text not null,
  last_checked date,
  record_status text not null default 'verified' check (record_status in ('verified','needs_review','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists rules_touch on public.recruiting_rules;
create trigger rules_touch before update on public.recruiting_rules for each row execute function public.touch_updated_at();
alter table public.recruiting_rules enable row level security;
drop policy if exists rules_read on public.recruiting_rules;
create policy rules_read on public.recruiting_rules for select to anon, authenticated
  using (record_status <> 'hidden' or (select public.is_recruiting_admin()));
drop policy if exists rules_admin_write on public.recruiting_rules;
create policy rules_admin_write on public.recruiting_rules for all to authenticated
  using ((select public.is_recruiting_admin())) with check ((select public.is_recruiting_admin()));

-- ---------------------------------------------------------------- player recruiting profile (private)
create table if not exists public.recruit_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text, last_name text,
  grad_year integer check (grad_year between 2024 and 2040),
  primary_position text, secondary_position text,
  bats text, throws text,
  height_in integer, weight_lb integer,
  high_school text, hs_city text, hs_state text,
  club_team text, club_coach text,
  gpa numeric(3,2), sat integer, act integer,
  intended_major text,
  contact_email text, phone text,
  video_url text,
  profile_url text,
  metrics jsonb not null default '{}'::jsonb,       -- {exit_velo, sixty, if_velo, of_velo, c_velo, pop, fb_velo, ...}
  levels_of_interest text[] not null default '{}',  -- e.g. {'NCAA D2','NCAA D3'}
  regions text[] not null default '{}',             -- states of interest
  find_my_level jsonb,                              -- last Find My Level summary the player chose to save
  prep jsonb not null default '{}'::jsonb,          -- checklist: {video:true, ncaa_eligibility:false, transcript:true, ...}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists recruit_profiles_touch on public.recruit_profiles;
create trigger recruit_profiles_touch before update on public.recruit_profiles for each row execute function public.touch_updated_at();
alter table public.recruit_profiles enable row level security;
drop policy if exists recruit_profiles_own on public.recruit_profiles;
create policy recruit_profiles_own on public.recruit_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- saved schools (private)
create table if not exists public.saved_schools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  interest text not null default 'medium' check (interest in ('high','medium','low')),
  stage text not null default 'researching' check (stage in ('researching','contacted','talking','visited','offered','committed','not_a_fit')),
  coach_name text, coach_email text,   -- entered by the player from the school's official staff page
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, program_id)
);
create index if not exists saved_schools_user_idx on public.saved_schools(user_id);
drop trigger if exists saved_schools_touch on public.saved_schools;
create trigger saved_schools_touch before update on public.saved_schools for each row execute function public.touch_updated_at();
alter table public.saved_schools enable row level security;
drop policy if exists saved_schools_own on public.saved_schools;
create policy saved_schools_own on public.saved_schools for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- email drafts + communication log (private)
create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  camp_id uuid,
  kind text not null check (kind in ('introduction','update','event_invite','follow_up')),
  to_email text, subject text, body text,
  status text not null default 'draft' check (status in ('draft','sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_drafts_user_idx on public.email_drafts(user_id);
drop trigger if exists email_drafts_touch on public.email_drafts;
create trigger email_drafts_touch before update on public.email_drafts for each row execute function public.touch_updated_at();
alter table public.email_drafts enable row level security;
drop policy if exists email_drafts_own on public.email_drafts;
create policy email_drafts_own on public.email_drafts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  draft_id uuid references public.email_drafts(id) on delete set null,
  direction text not null check (direction in ('sent','received')),
  kind text not null default 'other' check (kind in ('introduction','update','event_invite','follow_up','reply','call','visit','other')),
  channel text not null default 'email' check (channel in ('email','phone','text','dm','in_person','other')),
  coach_name text, subject text, summary text,
  occurred_on date not null default current_date,
  follow_up_on date,
  follow_up_done boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists communications_user_idx on public.communications(user_id, occurred_on desc);
drop trigger if exists communications_touch on public.communications;
create trigger communications_touch before update on public.communications for each row execute function public.touch_updated_at();
alter table public.communications enable row level security;
drop policy if exists communications_own on public.communications;
create policy communications_own on public.communications for all to authenticated
  using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid()) and (draft_id is null or exists (
      select 1 from public.email_drafts d where d.id = communications.draft_id and d.user_id = (select auth.uid())
    ))
  );

-- ---------------------------------------------------------------- plan task state (private)
create table if not exists public.plan_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rule_key text,                 -- set for tasks produced by a plan rule; null for custom tasks
  rule_subkey text,              -- what the rule was about when the player acted (re-opens when it changes)
  edited boolean not null default false,
  title text not null,
  detail text,
  status text not null default 'open' check (status in ('open','done','postponed','dismissed')),
  due_on date,
  postponed_until date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists plan_tasks_rule_uniq on public.plan_tasks(user_id, rule_key) where rule_key is not null;
drop trigger if exists plan_tasks_touch on public.plan_tasks;
create trigger plan_tasks_touch before update on public.plan_tasks for each row execute function public.touch_updated_at();
alter table public.plan_tasks enable row level security;
drop policy if exists plan_tasks_own on public.plan_tasks;
create policy plan_tasks_own on public.plan_tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- camps
create table if not exists public.camps (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete set null,
  title text not null,
  host_name text,
  camp_type text not null default 'camp' check (camp_type in ('camp','prospect_camp','showcase','clinic','id_camp')),
  start_date date not null,
  end_date date,
  time_note text,
  venue text, city text, state text,
  price_cents integer,
  price_note text,
  grad_years integer[] not null default '{}',
  eligibility_note text,
  positions text,
  registration_url text,
  source_url text not null,          -- official event page the details came from
  confirmed_coaches text,            -- only coaches named on the official page
  record_status text not null default 'verified' check (record_status in ('verified','needs_review','hidden')),
  last_checked date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists camps_start_idx on public.camps(start_date);
drop trigger if exists camps_touch on public.camps;
create trigger camps_touch before update on public.camps for each row execute function public.touch_updated_at();
alter table public.camps enable row level security;
drop policy if exists camps_read on public.camps;
create policy camps_read on public.camps for select to anon, authenticated
  using ((record_status <> 'hidden' and coalesce(end_date, start_date) >= current_date) or (select public.is_recruiting_admin()));
drop policy if exists camps_admin_write on public.camps;
create policy camps_admin_write on public.camps for all to authenticated
  using ((select public.is_recruiting_admin())) with check ((select public.is_recruiting_admin()));

create table if not exists public.saved_camps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  camp_id uuid not null references public.camps(id) on delete cascade,
  status text not null default 'interested' check (status in ('interested','registered','attended','skipped')),
  travel jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, camp_id)
);
drop trigger if exists saved_camps_touch on public.saved_camps;
create trigger saved_camps_touch before update on public.saved_camps for each row execute function public.touch_updated_at();
alter table public.saved_camps enable row level security;
drop policy if exists saved_camps_own on public.saved_camps;
create policy saved_camps_own on public.saved_camps for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- email_drafts.camp_id FK (camps created after drafts)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'email_drafts_camp_fk') then
    alter table public.email_drafts add constraint email_drafts_camp_fk foreign key (camp_id) references public.camps(id) on delete set null;
  end if;
end $$;
create index if not exists saved_camps_user_idx on public.saved_camps(user_id);
create index if not exists saved_camps_camp_idx on public.saved_camps(camp_id);
create index if not exists saved_schools_program_idx on public.saved_schools(program_id);
create index if not exists email_drafts_program_idx on public.email_drafts(program_id);
create index if not exists email_drafts_camp_idx on public.email_drafts(camp_id);
create index if not exists communications_program_idx on public.communications(program_id);
create index if not exists communications_draft_idx on public.communications(draft_id);
create index if not exists camps_program_idx on public.camps(program_id);

-- ---------------------------------------------------------------- admin-only aggregate stats (no private rows exposed)
create or replace function public.recruiting_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_recruiting_admin() then jsonb_build_object(
    'accounts', (select count(*) from public.recruit_profiles),
    'saved_schools', (select count(*) from public.saved_schools),
    'messages_logged', (select count(*) from public.communications),
    'saved_camps', (select count(*) from public.saved_camps),
    'programs', (select count(*) from public.programs),
    'programs_verified', (select count(*) from public.programs where record_status = 'verified'),
    'camps_upcoming', (select count(*) from public.camps where coalesce(end_date,start_date) >= current_date and record_status <> 'hidden')
  ) else null end;
$$;
revoke all on function public.recruiting_stats() from public, anon;
grant execute on function public.recruiting_stats() to authenticated;

-- A saved past camp stays readable in its owner's history. Public search still hides past events.
drop policy if exists camps_read on public.camps;
create policy camps_read on public.camps for select to anon, authenticated
using ((record_status <> 'hidden' and (
  coalesce(end_date, start_date) >= current_date or exists (
    select 1 from public.saved_camps s where s.camp_id = camps.id and s.user_id = (select auth.uid())
  )
)) or (select public.is_recruiting_admin()));

-- Explicit privileges: RLS alone does not grant access or protect TRUNCATE.
revoke all on public.programs, public.camps, public.recruiting_rules,
  public.recruit_profiles, public.saved_schools, public.email_drafts,
  public.communications, public.plan_tasks, public.saved_camps from public, anon, authenticated;
grant select on public.programs, public.camps, public.recruiting_rules to anon, authenticated;
grant insert, update, delete on public.programs, public.camps, public.recruiting_rules to authenticated;
grant select, insert, update, delete on public.recruit_profiles, public.saved_schools,
  public.email_drafts, public.communications, public.plan_tasks, public.saved_camps to authenticated;
-- Camp read policy's saved-camp subquery requires SELECT; RLS returns no anonymous rows.
grant select on public.saved_camps to anon;

-- Atomically log an already-sent email. It never sends mail. Retry returns the existing log.
create or replace function public.log_recruiting_email_sent(
  p_draft_id uuid, p_occurred_on date, p_follow_up_on date default null, p_coach_name text default null
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare d public.email_drafts; c public.communications;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_occurred_on is null or p_occurred_on > current_date then raise exception 'Invalid sent date'; end if;
  if p_follow_up_on is not null and p_follow_up_on < p_occurred_on then raise exception 'Follow-up precedes sent date'; end if;
  select * into d from public.email_drafts where id = p_draft_id and user_id = auth.uid() for update;
  if not found or d.program_id is null then raise exception 'Draft not found or no school selected'; end if;
  select * into c from public.communications where draft_id = d.id and direction = 'sent' and user_id = auth.uid() order by created_at limit 1;
  if not found then
    insert into public.communications(user_id, program_id, draft_id, direction, kind, channel, coach_name, subject, occurred_on, follow_up_on)
      values(auth.uid(), d.program_id, d.id, 'sent', d.kind, 'email', p_coach_name, d.subject, p_occurred_on, p_follow_up_on) returning * into c;
  end if;
  update public.email_drafts set status = 'sent' where id = d.id returning * into d;
  update public.saved_schools set stage = case when stage = 'researching' then 'contacted' else stage end,
    coach_name = coalesce(nullif(coach_name, ''), nullif(p_coach_name, ''))
    where user_id = auth.uid() and program_id = d.program_id;
  return jsonb_build_object('draft', to_jsonb(d), 'communication', to_jsonb(c));
end $$;
revoke all on function public.log_recruiting_email_sent(uuid, date, date, text) from public, anon;
grant execute on function public.log_recruiting_email_sent(uuid, date, date, text) to authenticated;
