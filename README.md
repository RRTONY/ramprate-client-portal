# RampRate Client Portal

One login per client, one place for everything about their engagement: overview, documents, activity, questions, team and progress. Built with Next.js 14 (App Router), Supabase (Auth, Postgres with row level security, private file storage) and Resend (email). Hosted on Netlify, like ramprate.com.

## What is in it

**Client side** (`/portal/<clientId>`)

1. Overview: what we are working on, approach, status and health, key priorities, what to expect, SPOC, next steps, next meeting, latest activity.
2. Documents: NDAs, MSAs, SOWs, onboarding and other paperwork, grouped by category, with View and Download. Files are private and served through 60 second signed links.
3. Activity: timeline of milestones, completed work, ongoing work, updates and important changes.
4. Questions: clients submit a question; it is emailed to the engagement owner and the admin contact(s), with Sam CC'd on every notification. The full thread (replies both ways) lives in the portal.
5. Your team: every RampRate person on the engagement with role, email, LinkedIn and what to contact them for. The SPOC is highlighted, with a "whom to contact for what" guide.
6. Progress and next steps: progress bar, items grouped as Next step, In progress, Upcoming, Pending, Completed; upcoming meetings with agenda and links; recent meeting notes.

**Admin side** (`/admin`, RampRate staff only)

- Client list with open question counts, create client (admins).
- Per client: edit overview, progress items, activity posts, meetings, documents (upload, hide, delete), engagement team, questions inbox with replies, and access (invite client logins, assign staff).
- Drafts: activity posts and documents can be saved hidden and published later.
- Team directory and staff access (admins): who appears on portals, who counts as an "admin contact", who can sign in to the console.
- "Preview client view" shows exactly what the client sees.

**Roles**

| Role   | Can do                                                                       |
| ------ | ---------------------------------------------------------------------------- |
| client | See their own client's portal only; ask and reply to questions               |
| staff  | Everything above for clients they are assigned to; edit those clients        |
| admin  | Everything, including creating clients, the team directory and staff invites |

Isolation is enforced in the database (Postgres row level security and storage policies), not just in the UI, so a client cannot read another client's data even by guessing URLs or ids.

## Setup

1. **Supabase project.** Create one. Under Authentication, **disable "Allow new users to sign up"** (access is invite only). Set the Site URL to your portal URL.
2. **Database.** In the SQL editor run `supabase/schema.sql` (if you ran an earlier version, run `supabase/upgrade-from-v1.sql` instead), then optionally `supabase/seed.sql` (loads the RampRate leadership roster; Kimberly is flagged as the admin contact, so `admin@ramprate.com` receives every query).
3. **Email templates.** In Authentication > Email Templates, set the link in the Invite and Reset Password templates to:
   - Invite: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password`
   - Reset: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/set-password`
4. **First admin.** Add yourself in Authentication > Users (set a password), then run the commented SQL at the bottom of `seed.sql` to give yourself the admin profile.
5. **Resend.** Verify the sending domain (for example ramprate.com), create an API key.
6. **Environment.** Copy `.env.example` to `.env.local` and fill it in. `SAM_EMAIL` is the address copied on every notification. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser; it is only used server side for inviting and removing users.
7. **Run.** `npm install`, then `npm run dev`.
8. **Netlify.** Create a new Netlify site from this repo (it is separate from the ramprate.com site). `netlify.toml` sets the build; Netlify detects Next.js on its own. Add every variable from `.env.example` under Site configuration > Environment variables. Netlify sets `URL` itself, which the weekly summary uses.

**Calendly links.** Add each person's booking link under Admin > Team directory. A "Book a meeting" button then appears on their card, and on the overview next to the client's SPOC. If you already ran the schema before this change, run: `alter table public.team_members add column calendly_url text;`

## Security, admin controls and audit

- **Separate admin sign-in:** the RampRate team signs in at `/admin/login`. A client account that tries it is signed straight back out. Staff and admins MUST set up two-step sign-in (authenticator app). Clients can opt in under Account, or set `REQUIRE_CLIENT_MFA=true` to require it for everyone.
- **What admins can do:** create and delete clients, edit everything in every portal, manage the team directory, invite or remove staff, assign staff to clients, invite or remove client logins, read the audit log. Staff can do the same inside only the clients assigned to them.
- **What nobody can change: anything the client wrote.** Questions and replies written by a client cannot be edited or deleted by staff or admins (the database enforces it). Staff can reply and mark a question resolved.
- **Audit log:** every sign-in, document view and download, edit, invite, email notification and status change is recorded with who, what and when (Pacific time in the viewer). The log is append only. Admins see everything at Audit log; each client has a History tab.
- **"Nothing blank" rule:** a portal has an 11 point readiness checklist on its Overview tab. The client cannot be invited until it is complete. Admins can override, and the override is logged.

## Emails to clients

- Posting an update or uploading a document has an "Email the client" box (on by default). Sam is CC'd.
- A weekly summary goes out Monday morning to clients who have something new, something waiting on them, or a meeting that week. It is triggered by the Netlify scheduled function `netlify/functions/weekly-digest.mts`, which calls `/api/cron/digest` with `CRON_SECRET`. Netlify schedules run in UTC; `0 16 * * 1` is 9am Pacific in summer and 8am in winter. Its runs show under Logs > Functions in Netlify.
- Each client user can turn change emails and the summary off under Account. Replies to their questions are always sent.

## Branding

- Put the real logo at `public/brand/ramprate-logo.svg` (or `.png`). Until then a simple placeholder mark is shown.
- LinkedIn and X icons appear in the client footer and on the sign-in page. URLs come from `NEXT_PUBLIC_LINKEDIN_URL` and `NEXT_PUBLIC_X_URL`.
- Branded invite and reset emails are in `docs/email-templates`. Paste them into Supabase Auth > Email Templates.
- Custom domain: in Netlify (Domain management) add `portal.ramprate.com`, add the DNS record it shows, then set `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL and redirect URL to it.
- The privacy page (`/privacy`) is plain-language DRAFT wording. Please have Legal review it before go-live.

## Backups

Turn on backups in Supabase (Project Settings > Database > Backups). Paid plans include daily backups, and point-in-time recovery is available as an add-on. Uploaded documents live in Supabase Storage, so also schedule a periodic export of the `client-documents` bucket. Confirm a restore works before relying on it.

Before the first client, work through `docs/TEST-PLAN.md`.

## Onboarding a new client

1. Admin: Clients, New client. Pick the engagement owner and SPOC.
2. Fill in the Overview tab (summary, approach, priorities, expectations) and set health.
3. Team tab: add the other people on the engagement with their role and "contact them for".
4. Documents tab: upload the NDA, MSA, SOW and onboarding pack.
5. Progress and Meetings tabs: add the first next steps and the kickoff meeting.
6. Access tab: invite the client's people. They get an email, set a password and land on their portal.
7. Use "Preview client view" to check it before the first login.

## How query routing works

When a client submits a question or replies:

- **To:** the client's engagement owner plus every active team member flagged as an admin contact (falls back to `ADMIN_EMAIL` if none).
- **CC:** `SAM_EMAIL`, always, on every notification (including replies in both directions).
- **Reply-To:** the client user, so a quick email reply reaches them.
- The email links to the thread in the admin console. Replies sent from the portal email the client and CC Sam.
- If email sending fails, the question is still saved and visible in the console, and the client sees a notice. Nothing is lost.

## Project layout

```
app/login, app/auth/*         sign in, invite and reset links, set password, sign out
app/portal/[clientId]/*       the six client sections
app/admin/*                   admin console
lib/admin-actions.ts          all content editing, uploads, invites (permission checked)
lib/query-actions.ts          question creation, replies, email routing
lib/email.ts                  notification emails (Sam CC enforced here)
supabase/schema.sql           tables, row level security, storage policies
```

## Notes and sensible next steps

- All times display in Pacific Time; meeting times are entered in Pacific Time.
- Document uploads are capped at 25 MB. Files go from the browser straight to Supabase Storage (`components/DocumentUploadForm.tsx`), because Netlify functions refuse request bodies over about 4 MB. The cap is enforced by the bucket's `file_size_limit` (set in `schema.sql`) and re-checked in `uploadDocument`. If you ran an older schema, run: `update storage.buckets set file_size_limit = 26214400 where id = 'client-documents';`
- Not built yet, easy to add: ClickUp sync of progress items, Slack alert on new queries, e-signature links for documents, audit log, multi-factor sign-in (Supabase supports it natively), custom domain such as `portal.ramprate.com`.
- Before go-live: run through the flows with a test client user and a test staff user, confirm the Resend domain is verified, and confirm sign-ups are disabled.
