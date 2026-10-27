# Test plan before any real client is invited

Do this against a real Supabase project (a separate "staging" project is best) with a test client and two test email addresses you control. Tick each line.

## A. Setup checks

- [ ] schema.sql ran with no errors (and upgrade-from-v1.sql only if you ran an older version)
- [ ] Sign-ups are disabled in Supabase Auth
- [ ] Invite and Reset email templates pasted from docs/email-templates
- [ ] Resend domain verified, test email arrives and is not in spam
- [ ] Environment variables set (see .env.example), including CRON_SECRET

## B. Admin and staff

- [ ] First admin created, can sign in at /admin/login
- [ ] Two-step setup is forced on first admin sign-in, next sign-in asks for the code
- [ ] Invite a staff user; they must also set up two-step sign-in
- [ ] A staff user sees ONLY clients assigned to them; an admin sees all
- [ ] A client account trying /admin/login is signed straight out
- [ ] Team directory: add Calendly links; flag admin contact

## C. Client portal

- [ ] Create a client, the readiness checklist shows what is missing
- [ ] Invite is blocked while incomplete; admin override works and is logged
- [ ] Complete the checklist; invite the test client user; the email arrives; password set; lands on their portal
- [ ] Client sees all six sections, last updated and next update due, and the Action needed box when an item is "Waiting on you"
- [ ] Client CANNOT open another client's URLs (try pasting the other client's /portal/<id>), and cannot open /admin
- [ ] Draft updates and hidden documents are NOT visible to the client
- [ ] Upload a PDF; client can View and Download; Hide it and confirm the client can no longer open it
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

- [ ] Audit log (admin) shows sign-ins, document views/downloads, edits, invites; the client History tab shows that client's entries
- [ ] Try to change an audit row in the Supabase SQL editor as an authenticated user: it must be refused
- [ ] Delete a test client (admin): documents and client logins are removed
- [ ] Phone check: open the portal on a phone and a tablet
- [ ] Turn on daily backups in Supabase and confirm a restore point exists
