import { getClientOr404, getClientTeam } from "@/lib/data";
import { Empty, PageTitle, Pill } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons";

export default async function Team({
  params,
}: {
  params: { clientId: string };
}) {
  const client = await getClientOr404(params.clientId);
  const team = await getClientTeam(client.id);
  const spoc = team.find((t) => t.team_member_id === client.spoc_id);
  const owner = team.find(
    (t) => t.team_member_id === client.engagement_owner_id,
  );

  return (
    <>
      <PageTitle
        title="Your RampRate team"
        subtitle="Who is working with you, what they do, and who to contact for what."
      />

      {spoc && (
        <div className="card mb-6 border-brand-100 bg-brand-50">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-700">
            Your single point of contact
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <Avatar name={spoc.team_members.full_name} size={64} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold">
                {spoc.team_members.full_name}
              </div>
              <div className="text-sm text-slate-700">
                {spoc.team_members.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Start with {spoc.team_members.full_name.split(" ")[0]} for
                anything about your engagement. They will bring in the right
                colleague when needed.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={`mailto:${spoc.team_members.email}`}
                  className="btn-secondary !py-1.5"
                >
                  <Icon.mail size={16} /> {spoc.team_members.email}
                </a>
                {spoc.team_members.calendly_url && (
                  <a
                    href={spoc.team_members.calendly_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn !py-1.5"
                  >
                    <Icon.calendar size={16} /> Book a meeting
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {team.length === 0 ? (
        <Empty icon="team" title="Your team is being set up">
          Your RampRate team will be listed here shortly.
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {team.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-start gap-3">
                <Avatar name={t.team_members.full_name} size={44} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">
                      {t.team_members.full_name}
                    </div>
                    {t.team_member_id === client.spoc_id && (
                      <Pill>Point of contact</Pill>
                    )}
                    {t.team_member_id === client.engagement_owner_id && (
                      <Pill tone="green">Engagement lead</Pill>
                    )}
                  </div>
                  <div className="text-sm text-slate-600">
                    {t.engagement_role || t.team_members.title}
                  </div>
                </div>
              </div>
              {t.contact_for && (
                <p className="mt-3 text-sm">
                  <span className="font-semibold">Contact for: </span>
                  {t.contact_for}
                </p>
              )}
              <div className="mt-3 space-y-0.5 text-sm">
                <a
                  href={`mailto:${t.team_members.email}`}
                  className="block font-semibold text-brand-700"
                >
                  {t.team_members.email}
                </a>
                {t.team_members.calendly_url && (
                  <a
                    href={t.team_members.calendly_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn mt-2 !py-1.5"
                  >
                    Book a meeting
                  </a>
                )}
                {t.team_members.linkedin_url && (
                  <a
                    href={t.team_members.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-slate-600 hover:text-brand-700"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card mt-6">
        <h2 className="h-section">Whom to contact for what</h2>
        <ul className="space-y-2 text-sm">
          <li>
            Day to day questions and status:{" "}
            {spoc ? spoc.team_members.full_name : "your point of contact"}
          </li>
          {owner && owner.team_member_id !== spoc?.team_member_id && (
            <li>
              Scope, delivery and priorities: {owner.team_members.full_name}
            </li>
          )}
          <li>
            Anything else: raise it on the Questions tab and it will be routed
            to the right person automatically.
          </li>
        </ul>
        {team.some((t) => t.team_members.phone) && (
          <p className="mt-4 text-xs text-slate-500">
            Urgent after-hours issues that cannot wait for email only:{" "}
            {team
              .filter((t) => t.team_members.phone)
              .map((t) => `${t.team_members.full_name} ${t.team_members.phone}`)
              .join("; ")}
          </p>
        )}
      </div>
    </>
  );
}
