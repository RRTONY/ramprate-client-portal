import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { saveTeamMember } from "@/lib/admin-actions";
import { Notice, PageTitle, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import type { TeamMember } from "@/lib/types";

function MemberForm({ m }: { m?: TeamMember }) {
  return (
    <form action={saveTeamMember} className="grid gap-3 sm:grid-cols-6">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="sm:col-span-2">
        <label className="label">Name</label>
        <input
          name="full_name"
          defaultValue={m?.full_name}
          required
          className="input"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Title</label>
        <input name="title" defaultValue={m?.title} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Email</label>
        <input
          name="email"
          type="email"
          defaultValue={m?.email}
          required
          className="input"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Phone (optional)</label>
        <input name="phone" defaultValue={m?.phone ?? ""} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">LinkedIn URL</label>
        <input
          name="linkedin_url"
          defaultValue={m?.linkedin_url ?? ""}
          className="input"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Calendly link (https)</label>
        <input
          name="calendly_url"
          defaultValue={m?.calendly_url ?? ""}
          placeholder="https://calendly.com/..."
          className="input"
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-3">
        <input
          type="checkbox"
          name="is_admin_contact"
          defaultChecked={m?.is_admin_contact}
        />{" "}
        Admin contact (receives every query email)
      </label>
      {m && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={m.active} />{" "}
          Active
        </label>
      )}
      <div className="sm:col-span-6">
        <SubmitButton>{m ? "Save" : "Add team member"}</SubmitButton>
      </div>
    </form>
  );
}

export default async function TeamDirectory({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  await requireAdmin();
  const { data } = await createClient()
    .from("team_members")
    .select("*")
    .order("full_name");
  const team = (data ?? []) as TeamMember[];
  return (
    <>
      <PageTitle
        title="Team directory"
        subtitle="People who can be listed on client portals. Admin contacts are emailed on every client query, with Sam always CC'd."
      />
      {searchParams.ok && <Notice kind="success">Saved.</Notice>}
      {searchParams.error && (
        <Notice kind="error">Name and email are required.</Notice>
      )}
      <div className="card mb-6">
        <h2 className="h-section">Add a team member</h2>
        <MemberForm />
      </div>
      <div className="space-y-3">
        {team.map((m) => (
          <details key={m.id} className="card !p-0">
            <summary className="flex cursor-pointer items-center justify-between p-4">
              <span className="font-semibold">
                {m.full_name}{" "}
                <span className="font-normal text-slate-500">· {m.title}</span>
              </span>
              <span className="flex gap-2">
                {m.is_admin_contact && <Pill>Admin contact</Pill>}
                {!m.active && <Pill tone="gray">Inactive</Pill>}
              </span>
            </summary>
            <div className="border-t border-slate-100 p-4">
              <MemberForm m={m} />
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
