-- Preserve the player-provided facts used to create each private draft.
alter table public.email_drafts add column if not exists template_context jsonb not null default '{}'::jsonb;
-- Existing owner-only RLS on email_drafts continues to protect this column.

-- Correct communication versus visit dates in existing public rule content.
update public.recruiting_rules set summary = 'Division I baseball recruiting calls and electronic correspondence generally begin August 1 before junior year. Off-campus recruiting contact and official/unofficial visits with athletics involvement have a separate September 1 junior-year start, subject to recruiting periods and school compliance review.', source_name = 'NCAA Division I Manual: baseball recruiting communication, contact and visits', source_url = 'https://web3.ncaa.org/lsdbi/reports/getReport/90008', last_checked = '2026-11-20' where rule_key = 'd1_contact_start';
