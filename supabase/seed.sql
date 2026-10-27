-- Optional: seeds the RampRate leadership team directory.
-- Calendly links checked live 2026-10-28. Tony, Alex and Sai have none yet; Kimberly's page had no open times.
insert into public.team_members (full_name, title, email, linkedin_url, phone, is_admin_contact, calendly_url) values
  ('Tony Greenberg', 'CEO', 't@ramprate.com', 'https://www.linkedin.com/in/tonygreenberg/', null, false, null),
  ('Alex Veytsel', 'Equity Partner', 'alex.veytsel@ramprate.com', 'https://www.linkedin.com/in/aveytsel/', null, false, null),
  ('Josh Bykowski', 'Legal, Business Development', 'josh@ramprate.com', 'https://www.linkedin.com/in/josh-bykowski-b445211b5/', null, false, 'https://calendly.com/josh-ramprate'),
  ('Rob Holmes', 'Grants, Business Development', 'rob@ramprate.com', 'https://www.linkedin.com/in/rob-holmes-7a479016/', null, false, 'https://calendly.com/rob-ramprate'),
  ('Satyajeet Patnayak', 'Chief of Staff', 'sam@ramprate.com', 'https://www.linkedin.com/in/satyajeetpatnayak/', '+91 90317 16589', false, 'https://calendly.com/ramprate/15-min-intro-call-with-sam-ramprate'),
  ('Sai Narendra', 'Book Keeper', 'sai@ramprate.com', 'https://www.linkedin.com/in/sainarendrakurmapu/', null, false, null),
  ('Kimberly Dofredo', 'Admin, Executive Ops', 'admin@ramprate.com', 'https://www.linkedin.com/in/kimberly-dofredo/', '+1 (909) 235-9945', true, null)
on conflict (email) do nothing;

-- Bootstrap the first admin: create the user in Supabase Auth (Dashboard > Authentication > Add user),
-- then run (replace the email):
-- insert into public.profiles (id, full_name, email, role)
-- select id, 'Darryl Dsouza', email, 'admin' from auth.users where email = 'darryl@ramprate.com';
