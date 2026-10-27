import { createClient } from "@/lib/supabase/server";

export type AuditInput = {
  action: string;
  entity?: string;
  entityId?: string;
  clientId?: string | null;
  detail?: Record<string, unknown>;
};

/**
 * Appends one row to the audit log as the signed-in user. Never throws:
 * a logging problem must not block the real action.
 */
export async function logEvent(input: AuditInput): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, role")
      .eq("id", user.id)
      .maybeSingle();
    await supabase.from("audit_log").insert({
      actor_id: user.id,
      actor_email: profile?.email ?? user.email ?? null,
      actor_role: profile?.role ?? null,
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
