import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  stagingEnabled,
  STATE_DIR,
  STATE_FILE,
  CLIENT_SESSION,
  ADMIN_SESSION,
  type World,
} from "./env";
import { totp } from "./totp";

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/**
 * Staging only: creates two test clients, a client user and an admin user (with an authenticator),
 * then signs both in through the real login screens and saves their sessions for the specs.
 */
export default async function globalSetup(config: FullConfig) {
  if (!stagingEnabled()) return;
  const url = process.env.E2E_SUPABASE_URL!;
  const svc = createClient(url, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!, noSession);
  const run = randomUUID().slice(0, 8);
  const password = `E2e-${randomUUID()}`;
  const must = async <R extends { data: unknown; error: unknown }>(p: PromiseLike<R>) => {
    const { data, error } = await p;
    if (error) throw error;
    return data as NonNullable<R["data"]>;
  };

  const ready = {
    summary: "We are reviewing the network contracts for the whole company.",
    approach: "Benchmark current pricing, then negotiate with each vendor.",
    expectations: "Weekly updates and a final report.",
    priorities: ["Cut costs"],
    next_update_due: "2030-01-01",
  };
  const [clientA, clientB] = await must(
    svc
      .from("clients")
      .insert([
        { name: `e2e-${run} Acme`, slug: `e2e-${run}-a`, ...ready },
        { name: `e2e-${run} Other`, slug: `e2e-${run}-b`, ...ready },
      ])
      .select("id, name"),
  );

  const makeUser = async (key: string, role: string, clientId: string | null) => {
    const email = `e2e-${run}-${key}@example.test`;
    const { user } = await must(
      svc.auth.admin.createUser({ email, password, email_confirm: true }),
    );
    if (!user) throw new Error("no user");
    await must(
      svc.from("profiles").upsert({ id: user.id, email, full_name: `E2E ${key}`, role, client_id: clientId }),
    );
    return { id: user.id, email };
  };
  const clientUser = await makeUser("client", "client", clientA.id);
  const admin = await makeUser("admin", "admin", null);

  // The admin also sets up an authenticator, to prove it no longer adds a code step.
  const adminDb = createClient(url, process.env.E2E_SUPABASE_ANON_KEY!, noSession);
  await must(adminDb.auth.signInWithPassword({ email: admin.email, password }));
  const factor = await must(adminDb.auth.mfa.enroll({ factorType: "totp" }));
  const challenge = await must(adminDb.auth.mfa.challenge({ factorId: factor.id }));
  await must(
    adminDb.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: totp(factor.totp.secret) }),
  );

  const docPath = (cid: string, name: string) => `${cid}/${randomUUID()}-${name}`;
  const docA = { title: "E2E signed SOW", path: docPath(clientA.id, "sow.txt") };
  const hiddenDocA = { title: "E2E hidden draft", path: docPath(clientA.id, "draft.txt") };
  for (const d of [docA, hiddenDocA])
    await must(
      svc.storage.from("client-documents").upload(d.path, new Blob(["e2e test file"]), { contentType: "text/plain" }),
    );
  const docs = await must(
    svc
      .from("documents")
      .insert([
        { client_id: clientA.id, title: docA.title, category: "SOW", storage_path: docA.path, file_name: "sow.txt", published: true },
        { client_id: clientA.id, title: hiddenDocA.title, category: "Report", storage_path: hiddenDocA.path, file_name: "draft.txt", published: false },
      ])
      .select("id, storage_path"),
  );

  const world: World = {
    run,
    password,
    clientA,
    clientB,
    clientUser,
    adminUser: { ...admin, totpSecret: factor.totp.secret },
    docA: { ...docA, id: docs.find((d) => d.storage_path === docA.path)!.id },
    hiddenDocA: { ...hiddenDocA, id: docs.find((d) => d.storage_path === hiddenDocA.path)!.id },
    paths: [docA.path, hiddenDocA.path],
  };
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(world, null, 2));

  // Sign both users in through the real screens and keep the sessions.
  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  const tourDone = () => localStorage.setItem("rr-tour-done-v1", "1");

  const clientCtx = await browser.newContext({ baseURL });
  await clientCtx.addInitScript(tourDone);
  const cp = await clientCtx.newPage();
  await cp.goto("/login");
  await cp.getByLabel("Email").fill(clientUser.email);
  await cp.getByLabel("Password").fill(password);
  await cp.getByRole("button", { name: "Sign in" }).click();
  await cp.waitForURL(`**/portal/${clientA.id}`);
  await clientCtx.storageState({ path: CLIENT_SESSION });

  const adminCtx = await browser.newContext({ baseURL });
  const ap = await adminCtx.newPage();
  await ap.goto("/admin/login");
  await ap.getByLabel("Work email").fill(admin.email);
  await ap.getByLabel("Password").fill(password);
  await ap.getByRole("button", { name: "Sign in to admin" }).click();
  await ap.waitForURL("**/admin");
  await ap.getByText(clientA.name).waitFor();
  await adminCtx.storageState({ path: ADMIN_SESSION });

  await browser.close();
}
