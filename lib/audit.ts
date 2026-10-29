import { createClient } from "@/lib/supabase/server";

export type AuditInput = {
  action: string;
  entity?: string;
  entityId?: string;
  clientId?: string | null;
  detail?: Record<string, unknown>;
};

export type AuditActor = { id: string; email: string | null; role: string | null };

/**
 * Appends one row to the audit log as the signed-in user. Never throws:
 * a logging problem must not block the real action. Pass `actor` when the caller already
 * knows who it is (for example right after sign-in) to save two database trips.
 */
export async function logEvent(input: AuditInput, actor?: AuditActor): Promise<void> {
  try {
    const supabase = createClient();
    let who = actor;
    if (!who) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, role")
        .eq("id", user.id)
        .maybeSingle();
      who = { id: user.id, email: profile?.email ?? user.email ?? null, role: profile?.role ?? null };
    }
    await supabase.from("audit_log").insert({
      actor_id: who.id,
      actor_email: who.email,
      actor_role: who.role,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      client_id: input.clientId ?? null,
      detail: input.detail ?? {},
    });
  } catch {
    // intentionally ignored
  }
}
