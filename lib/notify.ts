import { createClient } from "@/lib/supabase/server";
import { sendClientChangeNotification } from "@/lib/email";

/** Emails every client login (who has not opted out) about a change. Sam is CC'd by the mailer. */
export async function notifyClientUsers(
  clientId: string,
  headline: string,
  lines: string[],
) {
  const supabase = createClient();
  const [{ data: users }, { data: client }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email")
      .eq("client_id", clientId)
      .eq("role", "client")
      .eq("notify_email", true),
    supabase.from("clients").select("name").eq("id", clientId).single(),
  ]);
  const to = (users ?? []).map((u) => u.email);
  if (to.length === 0) return { sent: false };
  return sendClientChangeNotification({
    to,
    clientId,
    clientName: client?.name ?? "",
    headline,
    lines,
  });
}
