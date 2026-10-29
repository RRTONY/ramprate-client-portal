import { existsSync, readFileSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { stagingEnabled, STATE_DIR, STATE_FILE, type World } from "./env";

/** Removes everything global setup created on staging. Audit rows stay (append only). */
export default async function globalTeardown() {
  if (!stagingEnabled() || !existsSync(STATE_FILE)) return;
  const world: World = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const svc = createClient(
    process.env.E2E_SUPABASE_URL!,
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const ids = [world.clientA.id, world.clientB.id];
  // Files uploaded during the tests live under the clients' folders too.
  for (const cid of ids) {
    const { data } = await svc.storage.from("client-documents").list(cid);
    const paths = (data ?? []).map((o) => `${cid}/${o.name}`);
    if (paths.length) await svc.storage.from("client-documents").remove(paths);
  }
  await svc.from("clients").delete().in("id", ids);
  // Team members added by tests (their emails are @example.test), even if a test timed out.
  await svc.from("team_members").delete().like("email", "%@example.test");
  for (const u of [world.clientUser, world.adminUser]) await svc.auth.admin.deleteUser(u.id);
  rmSync(STATE_DIR, { recursive: true, force: true });
}
