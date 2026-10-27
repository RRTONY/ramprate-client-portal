import { Resend } from "resend";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

export type QueryEmailInput = {
  clientId: string;
  clientName: string;
  queryId: string;
  subject: string;
  category: string;
  body: string;
  fromName: string;
  fromEmail: string;
  isReply: boolean;
  /** Engagement owner + admin contact(s). Deduped; never includes the CC address. */
  to: string[];
};

/**
 * Sends the query notification. Sam (SAM_EMAIL) is ALWAYS CC'd on every notification.
 * Returns { sent: false } instead of throwing so a mail problem never loses the client's query.
 */
export async function sendQueryNotification(
  input: QueryEmailInput,
): Promise<{ sent: boolean; error?: string }> {
  const cc = process.env.SAM_EMAIL;
  const fallbackAdmin = process.env.ADMIN_EMAIL;
  const to = Array.from(
    new Set([
      ...input.to,
      ...(input.to.length === 0 && fallbackAdmin ? [fallbackAdmin] : []),
    ]),
  )
    .map((e) => e.toLowerCase())
    .filter((e) => e !== cc?.toLowerCase());
  if (!process.env.RESEND_API_KEY || !cc || to.length === 0) {
    return {
      sent: false,
      error: "Email not configured (RESEND_API_KEY, SAM_EMAIL, recipients).",
    };
  }
  const link = `${SITE}/admin/clients/${input.clientId}/queries/${input.queryId}`;
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;color:#201F24;max-width:600px">
    <p style="margin:0 0 4px;color:#7E32D4;font-weight:600">${input.isReply ? "New reply on a client query" : "New client query"}</p>
    <h2 style="margin:0 0 12px">${esc(input.subject)}</h2>
    <p style="margin:0 0 12px;color:#555">Client: <b>${esc(input.clientName)}</b> &middot; Category: ${esc(input.category)}<br/>
    From: ${esc(input.fromName)} (${esc(input.fromEmail)})</p>
    <div style="border-left:3px solid #A454FF;padding:8px 14px;background:#f5effe;margin:0 0 16px">${esc(input.body)}</div>
    <p><a href="${link}" style="background:#7E32D4;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open in the portal and respond</a></p>
  </div>`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ??
        "RampRate Client Portal <portal@ramprate.com>",
      to,
      cc: [cc],
      replyTo: input.fromEmail,
      subject: `[${input.clientName}] ${input.isReply ? "Re: " : ""}${input.subject}`,
      html,
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return {
      sent: false,
      error: e instanceof Error ? e.message : "Unknown email error",
    };
  }
}

/** Notifies the client user that RampRate replied. Sam is CC'd here too, for full visibility. */
export async function sendClientReplyNotification(input: {
  to: string;
  clientId: string;
  clientName: string;
  subject: string;
  body: string;
  fromName: string;
}): Promise<{ sent: boolean; error?: string }> {
  const cc = process.env.SAM_EMAIL;
  if (!process.env.RESEND_API_KEY || !cc)
    return { sent: false, error: "Email not configured." };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ??
        "RampRate Client Portal <portal@ramprate.com>",
      to: [input.to],
      cc: [cc],
      subject: `[RampRate] Response to your query: ${input.subject}`,
      html: `<div style="font-family:Inter,Arial,sans-serif;color:#201F24;max-width:600px">
        <p><b>${esc(input.fromName)}</b> responded to your query in the portal:</p>
        <div style="border-left:3px solid #A454FF;padding:8px 14px;background:#f5effe">${esc(input.body)}</div>
        <p><a href="${SITE}/portal/${input.clientId}/queries">View in your portal</a></p></div>`,
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return {
      sent: false,
      error: e instanceof Error ? e.message : "Unknown email error",
    };
  }
}

/** Plain branded wrapper used by the client-facing notification and digest emails. */
function brandedEmail(
  title: string,
  bodyHtml: string,
  ctaHref: string,
  ctaLabel: string,
) {
  return `<div style="font-family:Inter,Arial,sans-serif;color:#201F24;max-width:600px;margin:0 auto">
    <div style="background:#201F24;padding:14px 20px;border-radius:10px 10px 0 0"><span style="color:#fff;font-weight:700">RampRate</span> <span style="color:#A454FF">Client Portal</span></div>
    <div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 10px 10px">
      <h2 style="margin:0 0 12px">${esc(title)}</h2>
      ${bodyHtml}
      <p style="margin:20px 0 0"><a href="${ctaHref}" style="background:#7E32D4;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${esc(ctaLabel)}</a></p>
      <p style="margin:20px 0 0;font-size:12px;color:#777">You can turn these emails off any time under Account in your portal.</p>
    </div></div>`;
}

/**
 * Tells a client's users that something new is in their portal. Sam is CC'd for visibility.
 * Never throws.
 */
export async function sendClientChangeNotification(input: {
  to: string[];
  clientId: string;
  clientName: string;
  headline: string;
  lines: string[];
}): Promise<{ sent: boolean; error?: string }> {
  const cc = process.env.SAM_EMAIL;
  if (!process.env.RESEND_API_KEY || input.to.length === 0)
    return { sent: false, error: "Not configured or no recipients" };
  const list = input.lines
    .map((l) => `<li style="margin:4px 0">${esc(l)}</li>`)
    .join("");
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ??
        "RampRate Client Portal <portal@ramprate.com>",
      to: input.to,
      cc: cc ? [cc] : undefined,
      subject: `[RampRate] ${input.headline}`,
      html: brandedEmail(
        input.headline,
        `<ul style="padding-left:18px;margin:0">${list}</ul>`,
        `${SITE}/portal/${input.clientId}`,
        "Open your portal",
      ),
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return {
      sent: false,
      error: e instanceof Error ? e.message : "Unknown email error",
    };
  }
}

export type DigestInput = {
  to: string[];
  clientId: string;
  clientName: string;
  newUpdates: string[];
  newDocuments: string[];
  actionNeeded: string[];
  upcomingMeetings: string[];
};

/** Weekly summary for a client. Only sent when there is something to say. */
export async function sendWeeklyDigest(
  input: DigestInput,
): Promise<{ sent: boolean; error?: string }> {
  const cc = process.env.SAM_EMAIL;
  const has =
    input.newUpdates.length +
    input.newDocuments.length +
    input.actionNeeded.length +
    input.upcomingMeetings.length;
  if (!process.env.RESEND_API_KEY || input.to.length === 0 || has === 0)
    return { sent: false, error: "Nothing to send" };
  const block = (title: string, rows: string[]) =>
    rows.length === 0
      ? ""
      : `<h3 style="margin:16px 0 4px;font-size:14px;color:#5A1E9C">${esc(title)}</h3><ul style="padding-left:18px;margin:0">${rows.map((r) => `<li style="margin:3px 0">${esc(r)}</li>`).join("")}</ul>`;
  const body =
    block("Needs your action", input.actionNeeded) +
    block("New updates this week", input.newUpdates) +
    block("New documents", input.newDocuments) +
    block("Coming up", input.upcomingMeetings);
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ??
        "RampRate Client Portal <portal@ramprate.com>",
      to: input.to,
      cc: cc ? [cc] : undefined,
      subject: `[RampRate] Your weekly summary: ${input.clientName}`,
      html: brandedEmail(
        `Your week with RampRate`,
        body,
        `${SITE}/portal/${input.clientId}`,
        "Open your portal",
      ),
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return {
      sent: false,
      error: e instanceof Error ? e.message : "Unknown email error",
    };
  }
}
