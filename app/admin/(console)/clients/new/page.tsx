import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createClientAction } from "@/lib/admin-actions";
import { Notice, PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import type { TeamMember } from "@/lib/types";

export default async function NewClient({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireAdmin();
  const { data } = await createClient()
    .from("team_members")
    .select("*")
    .eq("active", true)
    .order("full_name");
  const team = (data ?? []) as TeamMember[];
  return (
    <>
      <PageTitle
        title="New client portal"
        subtitle="Create the engagement, then fill in the overview, upload documents and invite the client."
      />
      {searchParams.error && (
        <Notice kind="error">
          {searchParams.error === "exists"
            ? "A client with that name already exists."
            : "Please enter a client name."}
        </Notice>
      )}
      <form action={createClientAction} className="card max-w-xl space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Client name
          </label>
          <input id="name" name="name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="engagement_owner_id">
            Engagement owner
          </label>
          <select
            id="engagement_owner_id"
            name="engagement_owner_id"
            className="input"
          >
            <option value="">Unassigned</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.title})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="spoc_id">
            Client single point of contact (SPOC)
          </label>
          <select id="spoc_id" name="spoc_id" className="input">
            <option value="">Unassigned</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.title})
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pendingText="Creating...">Create client</SubmitButton>
      </form>
    </>
  );
}
