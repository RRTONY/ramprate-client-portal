-- Team directory data fixes from the pre-launch review (2026-11-05). Safe to run more than once.
-- Kimberly is the admin contact, so after this new client questions go to kimberly@ramprate.com.
update public.team_members set title = 'Bookkeeper' where email = 'sai@ramprate.com' and title = 'Book Keeper';
update public.team_members set email = 'kimberly@ramprate.com' where email = 'admin@ramprate.com' and full_name = 'Kimberly Dofredo';
