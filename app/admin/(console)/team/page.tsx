import { FiEdit2, FiUserPlus } from "react-icons/fi";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { saveTeamMember } from "@/lib/admin-actions";
import { Notice, PageTitle, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Modal, iconButton } from "@/components/Modal";
import { Switch } from "@/components/Switch";
import type { TeamMember } from "@/lib/types";

function MemberForm({ m }: { m?: TeamMember }) {
  const key = m?.id ?? "new";
  const field = (name: string) => `${name}-${key}`;
  return (
    <form action={saveTeamMember} className="space-y-4">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={field("name")}>Name</label>
          <input id={field("name")} name="full_name" defaultValue={m?.full_name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor={field("title")}>Title</label>
          <input id={field("title")} name="title" defaultValue={m?.title} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={field("email")}>Email</label>
          <input id={field("email")} name="email" type="email" defaultValue={m?.email} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor={field("phone")}>Phone (optional)</label>
          <input id={field("phone")} name="phone" defaultValue={m?.phone ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={field("linkedin")}>LinkedIn URL</label>
          <input id={field("linkedin")} name="linkedin_url" defaultValue={m?.linkedin_url ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={field("calendly")}>Calendly link (https)</label>
          <input
            id={field("calendly")}
            name="calendly_url"
            defaultValue={m?.calendly_url ?? ""}
            placeholder="https://calendly.com/..."
            className="input"
          />
        </div>
      </div>
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <Switch
          id={field("admin-contact")}
          name="is_admin_contact"
          label="Admin contact"
          hint="Receives every client question email"
          defaultChecked={m?.is_admin_contact}
        />
        {m && (
          <Switch
            id={field("active")}
            name="active"
            label="Active"
            hint="Inactive people are hidden from client portals"
            defaultChecked={m.active}
          />
        )}
      </div>
      <SubmitButton className="btn w-full">{m ? "Save changes" : "Add team member"}</SubmitButton>
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
      <div className="mb-4 flex justify-end">
        <Modal
          title="Add a team member"
          trigger={
            <>
              <FiUserPlus aria-hidden className="h-4 w-4" />
              Add team member
            </>
          }
        >
          <MemberForm />
        </Modal>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {team.length === 0 && (
          <div className="p-5 text-sm text-slate-500">No team members yet.</div>
        )}
        {team.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-semibold">{m.full_name}</div>
              <div className="text-xs text-slate-500">
                {[m.title, m.email].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {m.is_admin_contact && <Pill>Admin contact</Pill>}
              {!m.active && <Pill tone="gray">Inactive</Pill>}
              <Modal
                title={`Edit ${m.full_name}`}
                trigger={<FiEdit2 aria-hidden className="h-4 w-4" />}
                triggerLabel={`Edit ${m.full_name}`}
                triggerClassName={iconButton}
              >
                <MemberForm m={m} />
              </Modal>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
