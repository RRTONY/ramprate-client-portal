import path from "node:path";

/** Signed-in browser tests run only against an explicitly confirmed staging project. */
export function stagingEnabled() {
  return (
    !!process.env.E2E_SUPABASE_URL &&
    !!process.env.E2E_SUPABASE_ANON_KEY &&
    !!process.env.E2E_SUPABASE_SERVICE_ROLE_KEY &&
    process.env.E2E_CONFIRM_STAGING === "yes"
  );
}

export const STATE_DIR = path.join(__dirname, "..", ".state");
export const STATE_FILE = path.join(STATE_DIR, "world.json");
export const CLIENT_SESSION = path.join(STATE_DIR, "client.json");
export const ADMIN_SESSION = path.join(STATE_DIR, "admin.json");

/** What global setup created on staging, shared with the specs. */
export type World = {
  run: string;
  password: string;
  clientA: { id: string; name: string };
  clientB: { id: string; name: string };
  clientUser: { id: string; email: string };
  adminUser: { id: string; email: string; totpSecret: string };
  docA: { id: string; title: string; path: string };
  hiddenDocA: { id: string; title: string; path: string };
  paths: string[];
};
