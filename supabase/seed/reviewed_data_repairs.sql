-- Targeted, reviewable corrections for an existing installation, as checked 2026-11-20.
begin;
update public.recruiting_rules set
 topic = 'Communication versus contact and visits',
 summary = 'Division II recruiting communication is permitted at any time under Bylaw 13.1.3.1. June 15 immediately before junior year concerns first off-campus recruiting contact and official visits; it is not the start of coach email or telephone communication. Check current NCAA rules and the school compliance office for restrictions.',
 source_name = 'NCAA Division II Manual, Bylaws 13.1.1.1, 13.1.3.1 and 13.6.1.2',
 source_url = 'https://web3.ncaa.org/lsdbi/reports/getReport/90010',
 last_checked = '2026-11-20', record_status = 'verified'
where rule_key = 'd2_contact_start';
update public.programs set record_status = 'hidden',
 review_note = 'NCAA varsity athletics ended after Spring 2026; Villanova merger announced March 2025. Official source: https://rosemont.edu/college/merger-with-villanova/'
where slug = 'rosemont-college';
update public.programs set level = 'NCAA D1', conference = 'ASUN', record_status = 'needs_review',
 review_note = 'Division I / ASUN since Fall 2026; NCAA reclassification limits postseason eligibility until 2029. Official source: https://goargos.com/news/2026/4/2/uwf-athletics-announces-move-to-ncaa-division-i-athletics-joins-atlantic-sun-conference-united-athletic-conference.aspx'
where slug = 'university-of-west-florida';
commit;
