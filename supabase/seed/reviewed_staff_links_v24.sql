-- Optional targeted enrichment. Run after earlier recruiting migrations.
-- Fills missing staff links only. Does not promote record_status or change last_checked.
BEGIN;
UPDATE public.programs SET staff_url = 'https://georgiadogs.com/sports/baseball/coaches/1000' WHERE slug = 'university-of-georgia' AND COALESCE(staff_url, '') = ''; 
UPDATE public.programs SET staff_url = 'https://ksuowls.com/sports/baseball/coaches' WHERE slug = 'kennesaw-state-university' AND COALESCE(staff_url, '') = ''; 
UPDATE public.programs SET staff_url = 'https://athletics.scranton.edu/sports/baseball/coaches' WHERE slug = 'university-of-scranton' AND COALESCE(staff_url, '') = ''; 
UPDATE public.programs SET staff_url = 'https://tampaspartans.com/information/directory/index' WHERE slug = 'tampa' AND COALESCE(staff_url, '') = ''; 
UPDATE public.programs SET staff_url = 'https://clusports.com/sports/baseball/coaches' WHERE slug = 'california-lutheran-university' AND COALESCE(staff_url, '') = ''; 
UPDATE public.programs SET staff_url = 'https://ggcathletics.com/staff-directory' WHERE slug = 'georgia-gwinnett-college' AND COALESCE(staff_url, '') = ''; 
UPDATE public.programs SET staff_url = 'https://reinhardteagles.com/information/directory/index' WHERE slug = 'reinhardt-university' AND COALESCE(staff_url, '') = ''; 
UPDATE public.programs SET staff_url = 'https://wsccathletics.com/information/directory/index' WHERE slug = 'walters-state-community-college' AND COALESCE(staff_url, '') = ''; 
UPDATE public.programs SET staff_url = 'https://ghcchargers.com/information/directory/index' WHERE slug = 'georgia-highlands-college' AND COALESCE(staff_url, '') = ''; 
COMMIT;
