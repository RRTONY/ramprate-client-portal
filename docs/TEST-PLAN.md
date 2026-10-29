# Test plan before any real client is added

Do this against a real Supabase project (a separate "staging" project is best) with a test client and two test email addresses you control. Tick each line. Lines ticked with a note in _italics_ were verified by the automated tests against the staging project on that date; the rest still need a person (real email, the live site, a phone in hand).

## A. Setup checks

- [ ] schema.sql ran with no errors (and upgrade-from-v1.sql only if you ran an older version)
- [x] Sign-ups are disabled in Supabase Auth _(database test "nobody can create their own account", 2026-10-29)_
- [ ] Reset email template pasted from docs/email-templates (used by "Forgot your password?")
- [ ] Resend domain verified, test email arrives and is not in spam
- [ ] Environment variables set (see .env.example), including CRON_SECRET and DEFAULT_USER_PASSWORD

## B. Admin and staff

- [x] First admin created, can sign in at /admin/login _(browser test with a test admin, 2026-10-29)_
- [x] Sign-in goes straight to the dashboard (no two-step code screen) for admins, staff and clients _(browser tests, 2026-10-29)_
- [ ] Add a staff user (Staff access); they sign in with the starting password and must choose their own before anything opens
- [x] Admin edits a user's name and email; the person signs in with the new email _(browser test, 2026-10-29)_
- [x] Admin resets a user's password; the starting password works again and forces a new one _(browser test, 2026-10-29)_
- [ ] Anyone can change their own password (client Account page, admin header "Change password")
- [x] A staff user sees ONLY clients assigned to them; an admin sees all _(database and browser tests, 2026-10-29)_
- [ ] A client account trying /admin/login is signed straight out
- [ ] Team directory: add Calendly links; flag admin contact

## C. Client portal

- [ ] Create a client, the readiness checklist shows what is missing
- [x] Adding a client login is blocked while incomplete; admin override works and is logged _(unit tests; browser test uses the override, 2026-10-29)_
- [x] Complete the checklist; add the test client user; they sign in with the starting password, choose their own, and land on their portal _(browser test, 2026-10-29)_
- [ ] Client sees all six sections, last updated and next update due, and the Action needed box when an item is "Waiting on you"
- [x] Client CANNOT open another client's URLs (try pasting the other client's /portal/<id>), and cannot open /admin _(browser and database tests, 2026-10-29)_
- [x] Draft updates and hidden documents are NOT visible to the client _(database and browser tests, 2026-10-29)_
- [x] Upload a PDF; client can View and Download; Hide it and confirm the client can no longer open it _(browser and database tests, 2026-10-29)_
- [ ] On the live Netlify site, upload a file over 5 MB (for example a 10 MB PDF): it must succeed. Try a file over 25 MB: it must be refused

## D. Questions and email

- [ ] Client sends a question: engagement owner AND admin contact get an email, Sam is CC'd
- [ ] Staff reply: client gets an email, Sam is CC'd; client reply emails the team again
- [ ] Staff cannot edit or delete what the client wrote (there is no button, and the database blocks it)
- [ ] Posting an update/document with "Email the client" ticked sends a notification; unticked sends none
- [ ] Client turns notifications off under Account: change emails stop, question replies still arrive
- [ ] Weekly digest: call GET /api/cron/digest with header Authorization: Bearer <CRON_SECRET>; a digest arrives only for clients with something to report; without the header it returns 401
- [ ] In Netlify, Logs > Functions shows `weekly-digest` as a scheduled function; use "Run now" once and check its log line shows 200

## E. Audit log and safety

- [ ] Audit log (admin) shows sign-ins, document views/downloads, edits, accounts added, edited or reset, password changes; the client History tab shows that client's entries
- [x] Try to change an audit row in the Supabase SQL editor as an authenticated user: it must be refused _(database test, 2026-10-29)_
- [ ] Delete a test client (admin): documents and client logins are removed
- [ ] Phone check: open the portal on a phone and a tablet
- [ ] Turn on daily backups in Supabase and confirm a restore point exists
