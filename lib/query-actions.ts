"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import {
  sendClientReplyNotification,
  sendQueryNotification,
} from "@/lib/email";
import { QUERY_CATEGORIES, type ActionResult } from "@/lib/types";

const MAX_REPLY = 5000;

/** Engagement owner + active admin contacts for a client. Sam is CC'd separately by the mailer. */
async function routingRecipients(
  clientId: string,
): Promise<{ clientName: string; to: string[] }> {
  const supabase = createClient();
  const { data: client } = await supabase
    .from("clients")
    .select(
      "name, engagement_owner:team_members!clients_engagement_owner_id_fkey(email)",
    )
    .eq("id", clientId)
    .single();
  const { data: admins } = await supabase
    .from("team_members")
    .select("email")
    .eq("is_admin_contact", true)
    .eq("active", true);
  const owner = (
    client as unknown as { engagement_owner: { email: string } | null } | null
  )?.engagement_owner?.email;
  const to = [owner, ...(admins ?? []).map((a) => a.email)].filter(
    (e): e is string => !!e,
  );
  return {
    clientName: (client as { name: string } | null)?.name ?? "Client",
    to,
  };
}

export async function createQuery(clientId: string, formData: FormData) {
  const profile = await requireProfile();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const rawCat = String(formData.get("category") ?? "General");
  const category = QUERY_CATEGORIES.includes(rawCat) ? rawCat : "General";
  if (!subject || !body) redirect(`/portal/${clientId}/queries?error=missing`);

  const supabase = createClient();
  const { data: q, error } = await supabase
    .from("queries")
    .insert({ client_id: clientId, created_by: profile.id, subject, category })
    .select("id")
    .single();
  if (error || !q) redirect(`/portal/${clientId}/queries?error=failed`);

  await supabase
    .from("query_messages")
    .insert({
      query_id: q.id,
      client_id: clientId,
      author_id: profile.id,
      body,
    });

  const { clientName, to } = await routingRecipients(clientId);
  const res = await sendQueryNotification({
    clientId,
    clientName,
    queryId: q.id,
    subject,
    category,
    body,
    fromName: profile.full_name || profile.email,
    fromEmail: profile.email,
    isReply: false,
    to,
  });
  await logEvent({
    action: "query.create",
    entity: "query",
    entityId: q.id,
    clientId,
    detail: { subject, emailSent: res.sent },
  });
  revalidatePath(`/portal/${clientId}/queries`);
  redirect(`/portal/${clientId}/queries/${q.id}?sent=${res.sent ? "1" : "0"}`);
}

export async function replyToQuery(
  clientId: string,
  queryId: string,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireProfile();
  const body = String(formData.get("body") ?? "").trim();
  const isStaff = profile.role !== "client";
  const back = isStaff
    ? `/admin/clients/${clientId}/queries/${queryId}`
    : `/portal/${clientId}/queries/${queryId}`;
  if (!body) return { error: "Please write a reply first." };
  if (body.length > MAX_REPLY)
    return {
      error: `That reply is too long (${body.length.toLocaleString("en-US")} characters). Please keep it under ${MAX_REPLY.toLocaleString("en-US")}.`,
    };

  const supabase = createClient();
  const { data: q } = await supabase
    .from("queries")
    .select("subject, category, created_by")
    .eq("id", queryId)
    .eq("client_id", clientId)
    .single();
  if (!q) redirect(back);

  const { error } = await supabase
    .from("query_messages")
    .insert({
      query_id: queryId,
      client_id: clientId,
      author_id: profile.id,
      body,
    });
  if (error) return { error: "Your reply did not send. Please try again." };

  const notify = async () => {
    if (isStaff) {
      const [{ data: creator }, { data: client }] = await Promise.all([
        supabase.from("profiles").select("email").eq("id", q.created_by).single(),
        supabase.from("clients").select("name").eq("id", clientId).single(),
      ]);
      if (creator?.email) {
        await sendClientReplyNotification({
          to: creator.email,
          clientId,
          clientName: client?.name ?? "",
          subject: q.subject,
          body,
          fromName: profile.full_name || "RampRate",
        });
      }
    } else {
      const { clientName, to } = await routingRecipients(clientId);
      await sendQueryNotification({
        clientId,
        clientName,
        queryId,
        subject: q.subject,
        category: q.category,
        body,
        fromName: profile.full_name || profile.email,
        fromEmail: profile.email,
        isReply: true,
        to,
      });
    }
  };
  await Promise.all([
    supabase
      .from("queries")
      .update({ status: isStaff ? "answered" : "open" })
      .eq("id", queryId),
    notify(),
    logEvent(
      {
        action: isStaff ? "query.staff_reply" : "query.client_reply",
        entity: "query",
        entityId: queryId,
        clientId,
      },
      { id: profile.id, email: profile.email, role: profile.role },
    ),
  ]);
  revalidatePath(back);
}

export async function setQueryStatus(
  clientId: string,
  queryId: string,
  status: "open" | "answered" | "closed",
) {
  const profile = await requireProfile();
  if (profile.role === "client" && status !== "closed") return;
  const supabase = createClient();
  await supabase
    .from("queries")
    .update({ status })
    .eq("id", queryId)
    .eq("client_id", clientId);
  await logEvent({
    action: "query.status",
    entity: "query",
    entityId: queryId,
    clientId,
    detail: { status },
  });
  revalidatePath(`/portal/${clientId}/queries/${queryId}`);
  revalidatePath(`/admin/clients/${clientId}/queries/${queryId}`);
}
