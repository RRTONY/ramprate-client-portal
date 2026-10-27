import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendWeeklyDigest } from "@/lib/email";
import { fmtDate, fmtDateTime } from "@/lib/format";

// Weekly client summary. Called by the Netlify scheduled function (netlify/functions/weekly-digest.mts) with
// "Authorization: Bearer <CRON_SECRET>". Uses the service role because there is no signed-in user.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const svc = createServiceClient();
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const now = new Date().toISOString();
  const weekAhead = new Date(Date.now() + 7 * 86400_000).toISOString();

  const { data: clients } = await svc
    .from("clients")
    .select("id, name")
    .neq("health", "on_hold");
  let sent = 0;
  for (const c of clients ?? []) {
    const { data: users } = await svc
      .from("profiles")
      .select("email")
      .eq("client_id", c.id)
      .eq("role", "client")
      .eq("notify_email", true);
    const to = (users ?? []).map((u) => u.email);
    if (to.length === 0) continue;
    const [u, d, p, m] = await Promise.all([
      svc
        .from("updates")
        .select("title, occurred_on")
        .eq("client_id", c.id)
        .eq("published", true)
        .gte("created_at", since),
      svc
        .from("documents")
        .select("title")
        .eq("client_id", c.id)
        .eq("published", true)
        .gte("created_at", since),
      svc
        .from("progress_items")
        .select("title, due_date")
        .eq("client_id", c.id)
        .eq("status", "pending"),
      svc
        .from("meetings")
        .select("title, starts_at")
        .eq("client_id", c.id)
        .gte("starts_at", now)
        .lte("starts_at", weekAhead),
    ]);
    const res = await sendWeeklyDigest({
      to,
      clientId: c.id,
      clientName: c.name,
      newUpdates: (u.data ?? []).map(
        (x) => `${x.title} (${fmtDate(x.occurred_on)})`,
      ),
      newDocuments: (d.data ?? []).map((x) => x.title),
      actionNeeded: (p.data ?? []).map(
        (x) => `${x.title}${x.due_date ? ` (by ${fmtDate(x.due_date)})` : ""}`,
      ),
      upcomingMeetings: (m.data ?? []).map(
        (x) => `${x.title}: ${fmtDateTime(x.starts_at)}`,
      ),
    });
    if (res.sent) sent++;
  }
  return NextResponse.json({ ok: true, digestsSent: sent });
}
