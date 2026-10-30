"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertCanManage, requireAdmin } from "@/lib/auth";
import { pacificLocalToISO } from "@/lib/format";
import {
  DOC_CATEGORIES,
  PROGRESS_STATUSES,
  UPDATE_KINDS,
  type ActionResult,
  type Client,
  type Profile,
} from "@/lib/types";
import { logEvent, type AuditActor } from "@/lib/audit";
import { notifyClientUsers } from "@/lib/notify";
import { getReadiness } from "@/lib/readiness";
import { safeNext } from "@/lib/links";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);
const pick = <T extends string>(
  v: string,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(v as T) ? (v as T) : fallback);
const adminPath = (clientId: string, tab = "") =>
  `/admin/clients/${clientId}${tab}`;

/** Only accept https links so a typo or script URL never becomes a button. */
function safeHttpsUrl(v: string): string | null {
  return /^https:\/\/[^\s]+$/i.test(v) ? v : null;
}

const MAX_TITLE = 200;
const MAX_TEXT = 5000;
const SAVE_FAILED: ActionResult = { error: "That did not save. Please try again." };

/** A friendly message for the first field over its limit. */
function tooLong(fields: [label: string, value: string, max: number][]): ActionResult {
  const hit = fields.find(([, v, max]) => v.length > max);
  if (!hit) return undefined;
  return {
    error: `${hit[0]} is too long (${hit[1].length.toLocaleString("en-US")} characters). Please keep it under ${hit[2].toLocaleString("en-US")}.`,
  };
}

/** A meeting place is plain text ("Room 4") or an http(s) link. Other link types (javascript:, data:) are refused. */
function badLocation(v: string): ActionResult {
  if (/^[a-z][a-z0-9+.-]*:\S/i.test(v) && !/^https?:\/\//i.test(v))
    return { error: "The meeting link must start with https:// (or http://)." };
  return undefined;
}

/** The audit actor for a profile we already loaded, so logging skips two database trips. */
const actorOf = (p: Profile): AuditActor => ({ id: p.id, email: p.email, role: p.role });

/** Marks the portal as freshly updated. Shown to the client as "Last updated". */
async function touch(clientId: string) {
  await createClient()
    .from("clients")
    .update({ last_updated_at: new Date().toISOString() })
    .eq("id", clientId);
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40) || randomUUID().slice(0, 8)
  );
}

// ---------- Clients ----------
export async function createClientAction(formData: FormData) {
  await requireAdmin();
  const name = s(formData, "name");
  if (!name) redirect("/admin/clients/new?error=missing");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      slug: slugify(name),
      engagement_owner_id: orNull(s(formData, "engagement_owner_id")),
      spoc_id: orNull(s(formData, "spoc_id")),
    })
    .select("id")
    .single();
  if (error || !data) redirect("/admin/clients/new?error=exists");
  await syncOwnerAndSpoc(data.id);
  await logEvent({
    action: "client.create",
    entity: "client",
    entityId: data.id,
    clientId: data.id,
    detail: { name },
  });
  redirect(adminPath(data.id));
}

/** Engagement owner and SPOC always appear in the client's team list. */
async function syncOwnerAndSpoc(clientId: string) {
  const supabase = createClient();
  const { data: c } = await supabase
    .from("clients")
    .select("engagement_owner_id, spoc_id")
    .eq("id", clientId)
    .single();
  if (!c) return;
  const rows = [
    c.engagement_owner_id && {
      client_id: clientId,
      team_member_id: c.engagement_owner_id,
      engagement_role: "Engagement lead",
      contact_for: "Scope, delivery and priorities",
    },
    c.spoc_id &&
      c.spoc_id !== c.engagement_owner_id && {
        client_id: clientId,
        team_member_id: c.spoc_id,
        engagement_role: "Single point of contact",
        contact_for: "Day to day questions and status",
      },
  ].filter(Boolean) as object[];
  if (rows.length)
    await supabase
      .from("client_team")
      .upsert(rows, {
        onConflict: "client_id,team_member_id",
        ignoreDuplicates: true,
      });
}

export async function updateClientAction(clientId: string, formData: FormData) {
  await assertCanManage(clientId);
  const supabase = createClient();
  const priorities = s(formData, "priorities")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  await supabase
    .from("clients")
    .update({
      name: s(formData, "name"),
      status: s(formData, "status") || "Active",
      health: pick(
        s(formData, "health"),
        ["on_track", "needs_attention", "at_risk", "on_hold"] as const,
        "on_track",
      ),
      summary: s(formData, "summary"),
      approach: s(formData, "approach"),
      expectations: s(formData, "expectations"),
      priorities,
      slack_channel: orNull(s(formData, "slack_channel")),
      next_update_due: orNull(s(formData, "next_update_due")),
      welcome_note: s(formData, "welcome_note"),
      phases: (() => {
        const list = s(formData, "phases")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 8);
        return list.length ? list : ["Kickoff", "Build", "Launch"];
      })(),
      current_phase: Math.max(
        0,
        parseInt(s(formData, "current_phase") || "0", 10) || 0,
      ),
      last_updated_at: new Date().toISOString(),
      engagement_owner_id: orNull(s(formData, "engagement_owner_id")),
      spoc_id: orNull(s(formData, "spoc_id")),
    })
    .eq("id", clientId);
  await syncOwnerAndSpoc(clientId);
  await logEvent({
    action: "client.update",
    entity: "client",
    entityId: clientId,
    clientId,
    detail: { health: s(formData, "health"), status: s(formData, "status") },
  });
  revalidatePath(`/portal/${clientId}`, "layout");
  revalidatePath(adminPath(clientId), "layout");
}

// ---------- Progress & next steps ----------
export async function addProgress(
  clientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await assertCanManage(clientId);
  const title = s(formData, "title");
  const detail = s(formData, "detail");
  if (!title) return { error: "Please add a title." };
  const invalid = tooLong([
    ["Title", title, MAX_TITLE],
    ["Detail", detail, MAX_TEXT],
    ["Owner", s(formData, "owner_name"), MAX_TITLE],
  ]);
  if (invalid) return invalid;
  const { error } = await createClient()
    .from("progress_items")
    .insert({
      client_id: clientId,
      title,
      detail,
      status: pick(s(formData, "status"), PROGRESS_STATUSES, "upcoming"),
      due_date: orNull(s(formData, "due_date")),
      owner_name: orNull(s(formData, "owner_name")),
    });
  if (error) return SAVE_FAILED;
  await Promise.all([
    touch(clientId),
    logEvent(
      { action: "progress.create", entity: "progress_item", clientId, detail: { title } },
      actorOf(profile),
    ),
  ]);
  revalidatePath(adminPath(clientId, "/progress"));
  revalidatePath(`/portal/${clientId}`, "layout");
}

export async function updateProgress(
  clientId: string,
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await assertCanManage(clientId);
  const title = s(formData, "title");
  const detail = s(formData, "detail");
  if (!title) return { error: "Please add a title." };
  const invalid = tooLong([
    ["Title", title, MAX_TITLE],
    ["Detail", detail, MAX_TEXT],
    ["Owner", s(formData, "owner_name"), MAX_TITLE],
  ]);
  if (invalid) return invalid;
  const { error } = await createClient()
    .from("progress_items")
    .update({
      title,
      detail,
      status: pick(s(formData, "status"), PROGRESS_STATUSES, "upcoming"),
      due_date: orNull(s(formData, "due_date")),
      owner_name: orNull(s(formData, "owner_name")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return SAVE_FAILED;
  await Promise.all([
    touch(clientId),
    logEvent(
      {
        action: "progress.update",
        entity: "progress_item",
        entityId: id,
        clientId,
        detail: { title, status: s(formData, "status") },
      },
      actorOf(profile),
    ),
  ]);
  revalidatePath(adminPath(clientId, "/progress"));
  revalidatePath(`/portal/${clientId}`, "layout");
}

export async function deleteProgress(clientId: string, id: string) {
  await assertCanManage(clientId);
  await createClient()
    .from("progress_items")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  await logEvent({
    action: "progress.delete",
    entity: "progress_item",
    entityId: id,
    clientId,
  });
  revalidatePath(adminPath(clientId, "/progress"));
  revalidatePath(`/portal/${clientId}`, "layout");
}

// ---------- Activity timeline ----------
export async function addUpdate(
  clientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await assertCanManage(clientId);
  const title = s(formData, "title");
  const body = s(formData, "body");
  if (!title) return { error: "Please add a title." };
  const invalid = tooLong([
    ["Title", title, MAX_TITLE],
    ["Details", body, MAX_TEXT],
  ]);
  if (invalid) return invalid;
  const published = formData.get("published") === "on";
  const { error } = await createClient()
    .from("updates")
    .insert({
      client_id: clientId,
      title,
      body,
      kind: pick(s(formData, "kind"), UPDATE_KINDS, "update"),
      occurred_on:
        s(formData, "occurred_on") || new Date().toISOString().slice(0, 10),
      published,
      created_by: profile.id,
    });
  if (error) return SAVE_FAILED;
  const actor = actorOf(profile);
  const emailClient = async () => {
    const res = await notifyClientUsers(clientId, `New update: ${title}`, [
      title,
      ...(body ? [body.slice(0, 300)] : []),
    ]);
    await logEvent(
      {
        action: "email.client_notification",
        entity: "update",
        clientId,
        detail: { sent: res.sent },
      },
      actor,
    );
  };
  await Promise.all([
    touch(clientId),
    logEvent(
      { action: "update.create", entity: "update", clientId, detail: { title, published } },
      actor,
    ),
    published && formData.get("notify") === "on" ? emailClient() : null,
  ]);
  revalidatePath(adminPath(clientId, "/updates"));
  revalidatePath(`/portal/${clientId}`, "layout");
}

export async function toggleUpdate(
  clientId: string,
  id: string,
  published: boolean,
) {
  await assertCanManage(clientId);
  await createClient()
    .from("updates")
    .update({ published })
    .eq("id", id)
    .eq("client_id", clientId);
  await touch(clientId);
  await logEvent({
    action: published ? "update.publish" : "update.unpublish",
    entity: "update",
    entityId: id,
    clientId,
  });
  revalidatePath(adminPath(clientId, "/updates"));
  revalidatePath(`/portal/${clientId}`, "layout");
}

export async function deleteUpdate(clientId: string, id: string) {
  await assertCanManage(clientId);
  await createClient()
    .from("updates")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  await logEvent({
    action: "update.delete",
    entity: "update",
    entityId: id,
    clientId,
  });
  revalidatePath(adminPath(clientId, "/updates"));
  revalidatePath(`/portal/${clientId}`, "layout");
}

// ---------- Meetings (times entered in Pacific Time) ----------
export async function addMeeting(
  clientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await assertCanManage(clientId);
  const title = s(formData, "title");
  const when = s(formData, "starts_at");
  const location = s(formData, "location");
  const agenda = s(formData, "agenda");
  const notes = s(formData, "notes");
  if (!title || !when) return { error: "Please add a title and a date and time." };
  const invalid =
    tooLong([
      ["Title", title, MAX_TITLE],
      ["Meeting link or location", location, 1000],
      ["Agenda", agenda, MAX_TEXT],
      ["Notes", notes, MAX_TEXT],
    ]) ?? badLocation(location);
  if (invalid) return invalid;
  const { error } = await createClient()
    .from("meetings")
    .insert({
      client_id: clientId,
      title,
      starts_at: pacificLocalToISO(when),
      location: orNull(location),
      agenda,
      notes,
    });
  if (error) return SAVE_FAILED;
  await Promise.all([
    touch(clientId),
    logEvent(
      { action: "meeting.create", entity: "meeting", clientId, detail: { title, when } },
      actorOf(profile),
    ),
  ]);
  revalidatePath(adminPath(clientId, "/meetings"));
  revalidatePath(`/portal/${clientId}`, "layout");
}

export async function updateMeetingNotes(
  clientId: string,
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await assertCanManage(clientId);
  const location = s(formData, "location");
  const agenda = s(formData, "agenda");
  const notes = s(formData, "notes");
  const invalid =
    tooLong([
      ["Link or location", location, 1000],
      ["Agenda", agenda, MAX_TEXT],
      ["Notes", notes, MAX_TEXT],
    ]) ?? badLocation(location);
  if (invalid) return invalid;
  const { error } = await createClient()
    .from("meetings")
    .update({ agenda, notes, location: orNull(location) })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return SAVE_FAILED;
  await Promise.all([
    touch(clientId),
    logEvent(
      { action: "meeting.update", entity: "meeting", entityId: id, clientId },
      actorOf(profile),
    ),
  ]);
  revalidatePath(adminPath(clientId, "/meetings"));
  revalidatePath(`/portal/${clientId}`, "layout");
}

export async function deleteMeeting(clientId: string, id: string) {
  await assertCanManage(clientId);
  await createClient()
    .from("meetings")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  await logEvent({
    action: "meeting.delete",
    entity: "meeting",
    entityId: id,
    clientId,
  });
  revalidatePath(adminPath(clientId, "/meetings"));
  revalidatePath(`/portal/${clientId}`, "layout");
}

// ---------- Documents ----------
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * The browser uploads the file straight to Supabase Storage (DocumentUploadForm), because Netlify
 * functions reject request bodies over ~4 MB. This only records it, after checking the object
 * really exists in this client's folder and reading its true size from Storage.
 */
export async function uploadDocument(clientId: string, formData: FormData) {
  const profile = await assertCanManage(clientId);
  const path = s(formData, "storage_path");
  const fileName = s(formData, "file_name");
  const prefix = `${clientId}/`;
  const objectName = path.slice(prefix.length);
  if (
    !path.startsWith(prefix) ||
    !/^[0-9a-f-]{36}-[\w.\- ]+$/.test(objectName) ||
    !fileName
  ) {
    redirect(adminPath(clientId, "/documents?error=nofile"));
  }

  const supabase = createClient();
  const { data: found } = await supabase.storage
    .from("client-documents")
    .list(clientId, { search: objectName, limit: 1 });
  const object = found?.find((o) => o.name === objectName);
  if (!object) redirect(adminPath(clientId, "/documents?error=upload"));
  const size = Number(object.metadata?.size ?? 0);
  if (size > MAX_BYTES) {
    await supabase.storage.from("client-documents").remove([path]);
    redirect(adminPath(clientId, "/documents?error=toolarge"));
  }

  const { error: saveError } = await supabase.from("documents").insert({
    client_id: clientId,
    title: s(formData, "title") || fileName,
    category: pick(s(formData, "category"), DOC_CATEGORIES, "Other"),
    storage_path: path,
    file_name: fileName,
    file_size: size,
    published: formData.get("published") === "on",
    is_signed: formData.get("is_signed") === "on",
    uploaded_by: profile.id,
  });
  if (saveError) {
    await supabase.storage.from("client-documents").remove([path]);
    redirect(adminPath(clientId, "/documents?error=save"));
  }
  await touch(clientId);
  const docTitle = s(formData, "title") || fileName;
  await logEvent({
    action: "document.upload",
    entity: "document",
    clientId,
    detail: { title: docTitle, file: fileName, size },
  });
  if (formData.get("published") === "on" && formData.get("notify") === "on") {
    const res = await notifyClientUsers(clientId, `New document: ${docTitle}`, [
      `${docTitle} (${pick(s(formData, "category"), DOC_CATEGORIES, "Other")}) is now available in your portal.`,
    ]);
    await logEvent({
      action: "email.client_notification",
      entity: "document",
      clientId,
      detail: { sent: res.sent },
    });
  }
  revalidatePath(adminPath(clientId, "/documents"));
  revalidatePath(`/portal/${clientId}/documents`);
  redirect(adminPath(clientId, "/documents?ok=1"));
}

export async function toggleDocument(
  clientId: string,
  id: string,
  published: boolean,
) {
  await assertCanManage(clientId);
  await createClient()
    .from("documents")
    .update({ published })
    .eq("id", id)
    .eq("client_id", clientId);
  await touch(clientId);
  await logEvent({
    action: published ? "document.publish" : "document.hide",
    entity: "document",
    entityId: id,
    clientId,
  });
  revalidatePath(adminPath(clientId, "/documents"));
  revalidatePath(`/portal/${clientId}/documents`);
}

export async function deleteDocument(clientId: string, id: string) {
  await assertCanManage(clientId);
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();
  if (doc) {
    await supabase.storage.from("client-documents").remove([doc.storage_path]);
    await supabase.from("documents").delete().eq("id", id);
    await logEvent({
      action: "document.delete",
      entity: "document",
      entityId: id,
      clientId,
      detail: { path: doc.storage_path },
    });
  }
  revalidatePath(adminPath(clientId, "/documents"));
  revalidatePath(`/portal/${clientId}/documents`);
}

// ---------- Client team ----------
export async function addClientTeamMember(
  clientId: string,
  formData: FormData,
) {
  await assertCanManage(clientId);
  const memberId = s(formData, "team_member_id");
  if (!memberId) return;
  await createClient()
    .from("client_team")
    .upsert(
      {
        client_id: clientId,
        team_member_id: memberId,
        engagement_role: s(formData, "engagement_role"),
        contact_for: s(formData, "contact_for"),
      },
      { onConflict: "client_id,team_member_id" },
    );
  await touch(clientId);
  await logEvent({
    action: "client_team.save",
    entity: "client_team",
    clientId,
    detail: { team_member_id: memberId },
  });
  revalidatePath(adminPath(clientId, "/team"));
  revalidatePath(`/portal/${clientId}/team`);
}

export async function removeClientTeamMember(clientId: string, rowId: string) {
  await assertCanManage(clientId);
  await createClient()
    .from("client_team")
    .delete()
    .eq("id", rowId)
    .eq("client_id", clientId);
  await logEvent({
    action: "client_team.remove",
    entity: "client_team",
    entityId: rowId,
    clientId,
  });
  revalidatePath(adminPath(clientId, "/team"));
  revalidatePath(`/portal/${clientId}/team`);
}

// ---------- Access: client logins and staff assignment ----------

/**
 * Creates a sign-in with the shared starting password (DEFAULT_USER_PASSWORD). Nothing is
 * emailed: the admin tells the person. They must choose their own password at first sign-in.
 */
async function createAccount(email: string, fullName: string): Promise<string | null> {
  const password = process.env.DEFAULT_USER_PASSWORD;
  if (!password) return null;
  const { data, error } = await createServiceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  return error || !data.user ? null : data.user.id;
}
export async function inviteClientUser(clientId: string, formData: FormData) {
  const profile = await assertCanManage(clientId);
  const email = s(formData, "email").toLowerCase();
  const fullName = s(formData, "full_name");
  if (!email) redirect(adminPath(clientId, "/access?error=missing"));

  // "Nothing blank" rule: the portal must be complete before a client is invited.
  // Admins may override; the override is recorded in the audit log.
  const { data: clientRow } = await createClient()
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();
  const readiness = clientRow
    ? await getReadiness(clientRow as Client)
    : { ready: false, done: 0, items: [] };
  const override =
    !readiness.ready &&
    formData.get("override") === "on" &&
    profile.role === "admin";
  if (!readiness.ready && !override)
    redirect(adminPath(clientId, "/access?error=notready"));

  const id = await createAccount(email, fullName);
  if (!id) redirect(adminPath(clientId, "/access?error=invite"));

  await createServiceClient().from("profiles").upsert({
    id,
    email,
    full_name: fullName,
    role: "client",
    client_id: clientId,
    must_change_password: true,
  });
  await logEvent({
    action: "client_user.add",
    entity: "profile",
    entityId: id,
    clientId,
    detail: { email, readinessOverride: override },
  });
  revalidatePath(adminPath(clientId, "/access"));
  redirect(adminPath(clientId, "/access?ok=added"));
}

export async function revokeClientUser(clientId: string, userId: string) {
  await assertCanManage(clientId);
  const svc = createServiceClient();
  // Only ever act on a client-role user belonging to this client.
  const { data: p } = await svc
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .eq("role", "client")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!p) return;
  await svc.auth.admin.deleteUser(userId);
  await logEvent({
    action: "client_user.revoke",
    entity: "profile",
    entityId: userId,
    clientId,
  });
  revalidatePath(adminPath(clientId, "/access"));
}

export async function assignStaff(clientId: string, formData: FormData) {
  await requireAdmin();
  const userId = s(formData, "user_id");
  if (userId)
    await createClient()
      .from("staff_clients")
      .upsert({ user_id: userId, client_id: clientId });
  await logEvent({
    action: "staff.assign",
    entity: "staff_clients",
    entityId: userId,
    clientId,
  });
  revalidatePath(adminPath(clientId, "/access"));
}

export async function unassignStaff(clientId: string, userId: string) {
  await requireAdmin();
  await createClient()
    .from("staff_clients")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId);
  await logEvent({
    action: "staff.unassign",
    entity: "staff_clients",
    entityId: userId,
    clientId,
  });
  revalidatePath(adminPath(clientId, "/access"));
}

// ---------- Global admin: team directory and staff users ----------
export async function saveTeamMember(formData: FormData) {
  await requireAdmin();
  const id = s(formData, "id");
  const row = {
    full_name: s(formData, "full_name"),
    title: s(formData, "title"),
    email: s(formData, "email").toLowerCase(),
    phone: orNull(s(formData, "phone")),
    linkedin_url: orNull(s(formData, "linkedin_url")),
    calendly_url: safeHttpsUrl(s(formData, "calendly_url")),
    is_admin_contact: formData.get("is_admin_contact") === "on",
    // The Active checkbox only exists when editing; new members start active.
    active: id ? formData.get("active") === "on" : true,
  };
  if (!row.full_name || !row.email) redirect("/admin/team?error=missing");
  const supabase = createClient();
  if (id) await supabase.from("team_members").update(row).eq("id", id);
  else await supabase.from("team_members").insert(row);
  await logEvent({
    action: id ? "team_member.update" : "team_member.create",
    entity: "team_member",
    entityId: id || undefined,
    detail: { email: row.email },
  });
  revalidatePath("/admin/team");
  redirect("/admin/team?ok=1");
}

export async function inviteStaffUser(formData: FormData) {
  await requireAdmin();
  const email = s(formData, "email").toLowerCase();
  const fullName = s(formData, "full_name");
  const role = s(formData, "role") === "admin" ? "admin" : "staff";
  if (!email) redirect("/admin/users?error=missing");
  const id = await createAccount(email, fullName);
  if (!id) redirect("/admin/users?error=invite");
  await createServiceClient().from("profiles").upsert({
    id,
    email,
    full_name: fullName,
    role,
    client_id: null,
    must_change_password: true,
  });
  await logEvent({
    action: "staff_user.add",
    entity: "profile",
    entityId: id,
    detail: { email, role },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?ok=added");
}

/** Admin only: change anyone's name and sign-in email. */
export async function updateUserAccount(userId: string, back: string, formData: FormData) {
  await requireAdmin();
  const to = safeNext(back, "/admin/users");
  const email = s(formData, "email").toLowerCase();
  const fullName = s(formData, "full_name");
  if (!email) redirect(`${to}?error=missing`);
  const svc = createServiceClient();
  const { data: p } = await svc.from("profiles").select("id, email, client_id").eq("id", userId).maybeSingle();
  if (!p) redirect(`${to}?error=notfound`);
  const oldEmail = p.email;
  const { error } = await svc.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) redirect(`${to}?error=update`);
  await svc.from("profiles").update({ email, full_name: fullName }).eq("id", userId);
  await logEvent({
    action: "user.update",
    entity: "profile",
    entityId: userId,
    clientId: p.client_id ?? undefined,
    detail: { from: oldEmail, email, full_name: fullName },
  });
  revalidatePath(to);
  redirect(`${to}?ok=updated`);
}

/** Admin only: put anyone back on the starting password; they must choose a new one at sign-in. */
export async function resetUserPassword(userId: string, back: string) {
  await requireAdmin();
  const to = safeNext(back, "/admin/users");
  const password = process.env.DEFAULT_USER_PASSWORD;
  if (!password) redirect(`${to}?error=reset`);
  const svc = createServiceClient();
  const { data: p } = await svc.from("profiles").select("id, email, client_id").eq("id", userId).maybeSingle();
  if (!p) redirect(`${to}?error=notfound`);
  const { error } = await svc.auth.admin.updateUserById(userId, { password });
  if (error) redirect(`${to}?error=reset`);
  await svc.from("profiles").update({ must_change_password: true }).eq("id", userId);
  await logEvent({
    action: "user.password_reset",
    entity: "profile",
    entityId: userId,
    clientId: p.client_id ?? undefined,
    detail: { email: p.email },
  });
  revalidatePath(to);
  redirect(`${to}?ok=reset`);
}

export async function removeStaffUser(userId: string) {
  const me = await requireAdmin();
  if (userId === me.id) return; // never lock yourself out
  const svc = createServiceClient();
  const { data: p } = await svc
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .in("role", ["staff", "admin"])
    .maybeSingle();
  if (!p) return;
  await svc.auth.admin.deleteUser(userId);
  await logEvent({
    action: "staff_user.remove",
    entity: "profile",
    entityId: userId,
    detail: { email: p.email },
  });
  revalidatePath("/admin/users");
}

/** Admin only. Requires typing the client's exact name. Removes the client, its content and its stored files. */
export async function deleteClientAction(clientId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createClient();
  const { data: c } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();
  if (!c || s(formData, "confirm") !== c.name)
    redirect(adminPath(clientId, "?error=confirm"));
  const { data: docs } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("client_id", clientId);
  if (docs?.length)
    await supabase.storage
      .from("client-documents")
      .remove(docs.map((d) => d.storage_path));
  // Client logins for this portal are removed too.
  const svc = createServiceClient();
  const { data: users } = await svc
    .from("profiles")
    .select("id")
    .eq("client_id", clientId)
    .eq("role", "client");
  for (const u of users ?? []) await svc.auth.admin.deleteUser(u.id);
  await logEvent({
    action: "client.delete",
    entity: "client",
    entityId: clientId,
    detail: { name: c.name },
  });
  await supabase.from("clients").delete().eq("id", clientId);
  redirect("/admin");
}

/** Each person controls their own email preference. */
export async function setNotifyPreference(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc("set_my_notify", {
    v: formData.get("notify_email") === "on",
  });
  revalidatePath("/", "layout");
}
