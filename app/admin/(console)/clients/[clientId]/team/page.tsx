import { createClient } from "@/lib/supabase/server";
import { getClientTeam } from "@/lib/data";
import {
  addClientTeamMember,
  removeClientTeamMember,
} from "@/lib/admin-actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { TeamMember } from "@/lib/types";

export default async function AdminTeam({
  params,
}: {
  params: { clientId: string };
}) {
  const [team, { data: all }] = await Promise.all([
    getClientTeam(params.clientId),
    createClient()
      .from("team_members")
      .select("*")
      .eq("active", true)
      .order("full_name"),
  ]);
  const members = (all ?? []) as TeamMember[];
  const add = addClientTeamMember.bind(null, params.clientId);

  return (
    <div className="space-y-6">
      <form action={add} className="card grid gap-3 sm:grid-cols-6">
        <h2 className="h-section sm:col-span-6 !mb-0">
          Add or update a team member on this engagement
        </h2>
        <div className="sm:col-span-2">
          <label className="label">Person</label>
          <select name="team_member_id" required className="input">
            <option value="">Choose...</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Role on this engagement</label>
          <input
            name="engagement_role"
            className="input"
            placeholder="e.g. Legal and contracts"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Contact them for</label>
          <input
            name="contact_for"
            className="input"
            placeholder="e.g. NDA and MSA questions"
          />
        </div>
        <div className="sm:col-span-6">
          <SubmitButton pendingText="Saving...">Save</SubmitButton>
        </div>
        <p className="text-xs text-slate-500 sm:col-span-6">
          Set the engagement owner and SPOC on the Overview tab. They are added
          here automatically.
        </p>
      </form>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {team.map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div>
              <div className="font-semibold">{t.team_members.full_name}</div>
              <div className="text-sm text-slate-600">
                {t.engagement_role || t.team_members.title}
              </div>
              {t.contact_for && (
                <div className="text-xs text-slate-500">
                  Contact for: {t.contact_for}
                </div>
              )}
            </div>
            <form
              action={removeClientTeamMember.bind(null, params.clientId, t.id)}
            >
              <button className="btn-danger">Remove</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
