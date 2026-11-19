-- Players may replace their own cover photo (any format is converted to JPEG in the browser before upload).
-- Name, report, headline, publish state and Instagram fields stay locked unless you're an admin.
create or replace function public.guard_player_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.is_admin() or auth.role() = 'service_role' or auth.uid() is null then
    return new;
  end if;
  new.id := old.id; new.slug := old.slug; new.name := old.name; new.sport := old.sport;
  new.position := old.position; new.grad_year := old.grad_year;
  new.report := old.report; new.post_url := old.post_url;
  new.headline := old.headline;
  new.ig_media_id := old.ig_media_id; new.ig_account := old.ig_account;
  new.views := old.views; new.views_as_of := old.views_as_of;
  new.owner_id := old.owner_id; new.owner_email := old.owner_email;
  new.published := old.published; new.show_on_home := old.show_on_home;
  new.posted_at := old.posted_at; new.created_at := old.created_at;
  new.sample := old.sample; new.sample_note := old.sample_note;
  return new;
end $$;
