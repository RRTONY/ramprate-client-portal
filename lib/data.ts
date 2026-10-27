import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client, ClientTeamRow, TeamMember } from "@/lib/types";

/** Loads a client under RLS. If the user cannot see it, returns a 404. */
export async function getClientOr404(clientId: string): Promise<Client> {
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) notFound();
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  if (!data) notFound();
  return data as Client;
}

export async function getClientTeam(
  clientId: string,
): Promise<ClientTeamRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("client_team")
    .select("*, team_members(*)")
    .eq("client_id", clientId)
    .order("sort_order")
    .order("id");
  return (data ?? []) as unknown as ClientTeamRow[];
}

export async function getTeamMember(
  id: string | null,
): Promise<TeamMember | null> {
  if (!id) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("team_members")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as TeamMember) ?? null;
}
