import { randomUUID } from "node:crypto";
import { db, resetDb, seed, table, type Row } from "./fake-supabase.ts";
import { resetNav } from "./fake-next.ts";

export const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const CLIENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Role = "client" | "staff" | "admin";

export function makeProfile(role: Role, over: Row = {}): Row {
  const id = randomUUID();
  return {
    id,
    email: `${role}-${id.slice(0, 6)}@example.test`,
    full_name: `Test ${role}`,
    role,
    client_id: role === "client" ? CLIENT_A : null,
    notify_email: true,
    ...over,
  };
}

/**
 * Signs a test user in. Staff can be given the clients they manage.
 * Returns the profile row.
 */
export function signIn(role: Role, opts: { manages?: string[]; profile?: Row } = {}) {
  const profile = makeProfile(role, opts.profile);
  seed("profiles", profile);
  for (const client_id of opts.manages ?? [])
    seed("staff_clients", { user_id: profile.id, client_id });
  db.user = { id: profile.id as string, email: profile.email as string };
  return profile;
}

export function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

export function auditActions(): string[] {
  return table("audit_log").map((r) => r.action as string);
}

export type SentEmail = {
  to: string[];
  cc?: string[];
  reply_to?: string | string[];
  subject: string;
  html: string;
};

const ENV_KEYS = [
  "RESEND_API_KEY",
  "SAM_EMAIL",
  "ADMIN_EMAIL",
  "EMAIL_FROM",
  "CRON_SECRET",
  "REQUIRE_CLIENT_MFA",
  "NEXT_PUBLIC_SITE_URL",
];

const realFetch = globalThis.fetch;
let savedEnv: Record<string, string | undefined> = {};

/**
 * Resets the fake database, redirects, env and email capture. Call in beforeEach.
 * Email is "sent" into the returned array instead of reaching Resend.
 */
export function freshWorld(): SentEmail[] {
  resetDb();
  resetNav();
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.SAM_EMAIL = "sam@ramprate.com";
  const sent: SentEmail[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: "email_1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return sent;
}

/** Undo freshWorld. Call in afterEach. */
export function restoreWorld() {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

/** A client row that passes every readiness check. */
export function readyClient(id = CLIENT_A, over: Row = {}): Row {
  const owner = randomUUID();
  const spoc = randomUUID();
  seed(
    "client_team",
    { id: randomUUID(), client_id: id, team_member_id: owner },
    { id: randomUUID(), client_id: id, team_member_id: spoc },
  );
  seed("documents", {
    id: randomUUID(),
    client_id: id,
    category: "SOW",
    published: true,
    storage_path: `${id}/x.pdf`,
  });
  seed("progress_items", { id: randomUUID(), client_id: id, status: "next_step" });
  seed("meetings", {
    id: randomUUID(),
    client_id: id,
    starts_at: new Date(Date.now() + 86400_000).toISOString(),
  });
  const row = {
    id,
    name: "Acme",
    slug: "acme",
    summary: "We are reviewing the network contracts for the whole company.",
    approach: "Benchmark the current pricing then negotiate with vendors.",
    priorities: ["Cut costs"],
    expectations: "Weekly updates and a final report.",
    engagement_owner_id: owner,
    spoc_id: spoc,
    next_update_due: "2026-11-15",
    health: "on_track",
    ...over,
  };
  seed("clients", row);
  return row;
}
