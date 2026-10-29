// Row level security tests. These run against a REAL Supabase project, because RLS lives in Postgres.
// Use a STAGING project with supabase/schema.sql applied, never the live one. They are skipped unless:
//   TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_ROLE_KEY are set, and
//   TEST_SUPABASE_CONFIRM_STAGING=yes
// Everything they create is named "rls-test-..." and removed at the end.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { totp } from "../../e2e/support/totp.ts";

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const enabled =
  !!URL && !!ANON && !!SERVICE && process.env.TEST_SUPABASE_CONFIRM_STAGING === "yes";
const skip = enabled
  ? false
  : "set TEST_SUPABASE_* env vars and TEST_SUPABASE_CONFIRM_STAGING=yes to run";

const BUCKET = "client-documents";
const run = randomUUID().slice(0, 8);
const password = `Rls-${randomUUID()}`;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

let svc: SupabaseClient;
const ids = {
  clientA: "",
  clientB: "",
  docA: "",
  hiddenDocA: "",
  docB: "",
  queryA: "",
  queryB: "",
  msgA: "",
  auditA: 0,
};
const paths = { docA: "", hiddenDocA: "", docB: "" };
const users: Record<"clientA" | "clientB" | "staffA" | "admin", { id: string; db: SupabaseClient }> =
  {} as never;

async function makeUser(
  key: keyof typeof users,
  role: "client" | "staff" | "admin",
  clientId: string | null,
) {
  const email = `rls-test-${run}-${key.toLowerCase()}@example.test`;
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("no user");
  const { error: pErr } = await svc
    .from("profiles")
    .upsert({ id: data.user.id, email, full_name: key, role, client_id: clientId });
  if (pErr) throw pErr;
  const db = createClient(URL!, ANON!, noSession);
  const { error: sErr } = await db.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  if (role !== "client") {
    // Staff and admins also set up an authenticator, to prove it no longer changes anything.
    const factor = await must(db.auth.mfa.enroll({ factorType: "totp" }));
    const challenge = await must(db.auth.mfa.challenge({ factorId: factor.id }));
    await ok(db.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: totp(factor.totp.secret) }));
  }
  users[key] = { id: data.user.id, db };
}

/** A second session for an existing user, signed in with only the password. */
async function passwordOnly(key: keyof typeof users) {
  const { data } = await svc.auth.admin.getUserById(users[key].id);
  const db = createClient(URL!, ANON!, noSession);
  const { error } = await db.auth.signInWithPassword({ email: data.user!.email!, password });
  if (error) throw error;
  return db;
}

async function must<T>(
  p: PromiseLike<{ data: T; error: unknown }>,
): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  if (data == null) throw new Error("expected data, got none");
  return data;
}

/** For writes and calls that return no rows: only the error matters. */
async function ok(p: PromiseLike<{ error: unknown }>) {
  const { error } = await p;
  if (error) throw error;
}

describe("row level security (staging Supabase)", { skip }, () => {
  before(async () => {
    svc = createClient(URL!, SERVICE!, noSession);
    const clients = await must(
      svc
        .from("clients")
        .insert([
          { name: `rls-test-${run}-A`, slug: `rls-test-${run}-a` },
          { name: `rls-test-${run}-B`, slug: `rls-test-${run}-b` },
        ])
        .select("id, slug"),
    );
    ids.clientA = clients.find((c) => c.slug.endsWith("-a"))!.id;
    ids.clientB = clients.find((c) => c.slug.endsWith("-b"))!.id;

    await makeUser("clientA", "client", ids.clientA);
    await makeUser("clientB", "client", ids.clientB);
    await makeUser("staffA", "staff", null);
    await makeUser("admin", "admin", null);
    await ok(svc.from("staff_clients").insert({ user_id: users.staffA.id, client_id: ids.clientA }));

    paths.docA = `${ids.clientA}/${randomUUID()}-a.txt`;
    paths.hiddenDocA = `${ids.clientA}/${randomUUID()}-hidden.txt`;
    paths.docB = `${ids.clientB}/${randomUUID()}-b.txt`;
    for (const p of Object.values(paths))
      await must(svc.storage.from(BUCKET).upload(p, new Blob(["rls test"]), { contentType: "text/plain" }));

    const docs = await must(
      svc
        .from("documents")
        .insert([
          { client_id: ids.clientA, title: "A doc", storage_path: paths.docA, file_name: "a.txt", published: true },
          { client_id: ids.clientA, title: "A hidden", storage_path: paths.hiddenDocA, file_name: "h.txt", published: false },
          { client_id: ids.clientB, title: "B doc", storage_path: paths.docB, file_name: "b.txt", published: true },
        ])
        .select("id, storage_path"),
    );
    ids.docA = docs.find((d) => d.storage_path === paths.docA)!.id;
    ids.hiddenDocA = docs.find((d) => d.storage_path === paths.hiddenDocA)!.id;
    ids.docB = docs.find((d) => d.storage_path === paths.docB)!.id;

    for (const cid of [ids.clientA, ids.clientB]) {
      await ok(
        svc.from("updates").insert([
          { client_id: cid, title: "Published", published: true },
          { client_id: cid, title: "Draft", published: false },
        ]),
      );
      await ok(svc.from("progress_items").insert({ client_id: cid, title: "Step" }));
      await ok(
        svc.from("meetings").insert({ client_id: cid, title: "Sync", starts_at: new Date().toISOString() }),
      );
    }

    const qa = await must(
      svc
        .from("queries")
        .insert({ client_id: ids.clientA, created_by: users.clientA.id, subject: "A question" })
        .select("id")
        .single(),
    );
    ids.queryA = qa.id;
    const qb = await must(
      svc
        .from("queries")
        .insert({ client_id: ids.clientB, created_by: users.clientB.id, subject: "B question" })
        .select("id")
        .single(),
    );
    ids.queryB = qb.id;
    const m = await must(
      svc
        .from("query_messages")
        .insert({ query_id: ids.queryA, client_id: ids.clientA, author_id: users.clientA.id, body: "Original words" })
        .select("id")
        .single(),
    );
    ids.msgA = m.id;
    const a = await must(
      svc
        .from("audit_log")
        .insert({ actor_id: users.admin.id, action: "rls.test", client_id: ids.clientA })
        .select("id")
        .single(),
    );
    ids.auditA = a.id;
  });

  after(async () => {
    if (!svc) return;
    await svc.storage.from(BUCKET).remove(Object.values(paths).filter(Boolean));
    // Audit rows stay (append only); deleting the clients sets their client_id to null.
    await svc.from("clients").delete().in("id", [ids.clientA, ids.clientB].filter(Boolean));
    for (const u of Object.values(users)) await svc.auth.admin.deleteUser(u.id);
  });

  // ---------- Client isolation ----------

  const clientTables = [
    "clients",
    "documents",
    "updates",
    "progress_items",
    "meetings",
    "queries",
    "query_messages",
    "client_team",
  ];

  for (const t of clientTables) {
    it(`a client user cannot read another client's ${t}`, async () => {
      const col = t === "clients" ? "id" : "client_id";
      const rows = await must(users.clientA.db.from(t).select("*").eq(col, ids.clientB));
      assert.deepEqual(rows, []);
    });
  }

  it("a client user sees their own client and its published content", async () => {
    const db = users.clientA.db;
    assert.equal((await must(db.from("clients").select("id"))).length, 1);
    const docs = await must(db.from("documents").select("id"));
    assert.deepEqual(docs.map((d) => d.id), [ids.docA]);
    const updates = await must(db.from("updates").select("title"));
    assert.deepEqual(updates.map((u) => u.title), ["Published"]);
  });

  it("a client user cannot see hidden documents or draft updates", async () => {
    const db = users.clientA.db;
    assert.deepEqual(await must(db.from("documents").select("id").eq("id", ids.hiddenDocA)), []);
    assert.deepEqual(await must(db.from("updates").select("id").eq("published", false)), []);
  });

  it("a client user cannot read the audit log", async () => {
    assert.deepEqual(await must(users.clientA.db.from("audit_log").select("id")), []);
  });

  it("a client user cannot see staff assignments of others", async () => {
    assert.deepEqual(await must(users.clientA.db.from("staff_clients").select("*")), []);
  });

  // ---------- Client write limits ----------

  it("a client user cannot add, change or delete portal content", async () => {
    const db = users.clientA.db;
    const ins = await db.from("progress_items").insert({ client_id: ids.clientA, title: "sneaky" });
    assert.ok(ins.error, "insert refused");
    await db.from("documents").update({ title: "changed" }).eq("id", ids.docA);
    await db.from("documents").delete().eq("id", ids.docA);
    await db.from("clients").update({ health: "at_risk" }).eq("id", ids.clientA);
    const doc = await must(svc.from("documents").select("title").eq("id", ids.docA).single());
    assert.equal(doc.title, "A doc");
    const c = await must(svc.from("clients").select("health").eq("id", ids.clientA).single());
    assert.equal(c.health, "on_track");
  });

  it("a client user cannot make themselves staff or move to another client", async () => {
    const db = users.clientA.db;
    await db.from("profiles").update({ role: "admin", client_id: ids.clientB }).eq("id", users.clientA.id);
    const p = await must(svc.from("profiles").select("role, client_id").eq("id", users.clientA.id).single());
    assert.equal(p.role, "client");
    assert.equal(p.client_id, ids.clientA);
  });

  it("set_my_notify changes only the caller's own preference", async () => {
    await ok(users.clientA.db.rpc("set_my_notify", { v: false }));
    const mine = await must(svc.from("profiles").select("notify_email").eq("id", users.clientA.id).single());
    const theirs = await must(svc.from("profiles").select("notify_email").eq("id", users.clientB.id).single());
    assert.equal(mine.notify_email, false);
    assert.equal(theirs.notify_email, true);
    await ok(users.clientA.db.rpc("set_my_notify", { v: true }));
  });

  it("a client user cannot open a query on another client or as someone else", async () => {
    const db = users.clientA.db;
    const other = await db
      .from("queries")
      .insert({ client_id: ids.clientB, created_by: users.clientA.id, subject: "x" });
    assert.ok(other.error, "other client refused");
    const imposter = await db
      .from("queries")
      .insert({ client_id: ids.clientA, created_by: users.clientB.id, subject: "x" });
    assert.ok(imposter.error, "impersonation refused");
    const msg = await db
      .from("query_messages")
      .insert({ query_id: ids.queryB, client_id: ids.clientB, author_id: users.clientA.id, body: "x" });
    assert.ok(msg.error, "message on other client refused");
  });

  // ---------- Client-written content is protected ----------

  it("nobody, not even an admin, can edit or delete a client's message", async () => {
    for (const who of [users.admin, users.staffA, users.clientA]) {
      await who.db.from("query_messages").update({ body: "edited" }).eq("id", ids.msgA);
      await who.db.from("query_messages").delete().eq("id", ids.msgA);
    }
    const m = await must(svc.from("query_messages").select("body").eq("id", ids.msgA).single());
    assert.equal(m.body, "Original words");
  });

  it("staff can change a query's status but never its subject", async () => {
    const db = users.staffA.db;
    const changed = await db.from("queries").update({ subject: "rewritten" }).eq("id", ids.queryA);
    assert.ok(changed.error, "subject change refused by trigger");
    await ok(db.from("queries").update({ status: "answered" }).eq("id", ids.queryA));
    const q = await must(svc.from("queries").select("subject, status").eq("id", ids.queryA).single());
    assert.equal(q.subject, "A question");
    assert.equal(q.status, "answered");
  });

  // ---------- Audit log is append only ----------

  it("nobody can edit or delete audit history, not even an admin", async () => {
    await users.admin.db.from("audit_log").update({ action: "tampered" }).eq("id", ids.auditA);
    await users.admin.db.from("audit_log").delete().eq("id", ids.auditA);
    const row = await must(svc.from("audit_log").select("action").eq("id", ids.auditA).single());
    assert.equal(row.action, "rls.test");
  });

  it("users can only write audit entries as themselves", async () => {
    const forged = await users.staffA.db
      .from("audit_log")
      .insert({ actor_id: users.admin.id, action: "forged" });
    assert.ok(forged.error);
    const own = await users.staffA.db.from("audit_log").insert({ actor_id: users.staffA.id, action: "rls.own" });
    assert.equal(own.error, null);
  });

  // ---------- Staff are limited to assigned clients ----------

  it("staff can manage an assigned client", async () => {
    const res = await users.staffA.db.from("progress_items").insert({ client_id: ids.clientA, title: "ok" });
    assert.equal(res.error, null);
    const docs = await must(users.staffA.db.from("documents").select("id").eq("client_id", ids.clientA));
    assert.equal(docs.length, 2, "staff also see hidden documents");
  });

  it("staff cannot change or read content of an unassigned client", async () => {
    const db = users.staffA.db;
    const ins = await db.from("progress_items").insert({ client_id: ids.clientB, title: "nope" });
    assert.ok(ins.error);
    assert.deepEqual(await must(db.from("documents").select("id").eq("client_id", ids.clientB)), []);
    assert.deepEqual(await must(db.from("audit_log").select("id").eq("client_id", ids.clientB)), []);
  });

  it("staff cannot assign themselves to more clients", async () => {
    const res = await users.staffA.db
      .from("staff_clients")
      .insert({ user_id: users.staffA.id, client_id: ids.clientB });
    assert.ok(res.error);
  });

  it("only admins can create clients", async () => {
    const res = await users.staffA.db.from("clients").insert({ name: "x", slug: `rls-test-${run}-x` });
    assert.ok(res.error);
  });

  // ---------- Files in Storage ----------

  it("a client user can download their own published file", async () => {
    const { data, error } = await users.clientA.db.storage.from(BUCKET).createSignedUrl(paths.docA, 60);
    assert.equal(error, null);
    assert.ok(data?.signedUrl);
  });

  it("a client user cannot download another client's file", async () => {
    const res = await users.clientA.db.storage.from(BUCKET).download(paths.docB);
    assert.ok(res.error);
  });

  it("a client user cannot download their own hidden file", async () => {
    const res = await users.clientA.db.storage.from(BUCKET).download(paths.hiddenDocA);
    assert.ok(res.error);
  });

  it("a client user cannot upload files", async () => {
    const res = await users.clientA.db.storage
      .from(BUCKET)
      .upload(`${ids.clientA}/${randomUUID()}-x.txt`, new Blob(["x"]));
    assert.ok(res.error);
  });

  it("staff cannot upload into an unassigned client's folder", async () => {
    const res = await users.staffA.db.storage
      .from(BUCKET)
      .upload(`${ids.clientB}/${randomUUID()}-x.txt`, new Blob(["x"]));
    assert.ok(res.error);
  });

  it("the bucket is private (no public link works)", async () => {
    const { data } = svc.storage.from(BUCKET).getPublicUrl(paths.docA);
    const res = await fetch(data.publicUrl);
    assert.notEqual(res.status, 200);
  });

  it("signed-out visitors can read nothing", async () => {
    const anon = createClient(URL!, ANON!, noSession);
    for (const t of [...clientTables, "profiles", "audit_log", "team_members"])
      assert.deepEqual(await must(anon.from(t).select("*").limit(1)), [], t);
  });

  // ---------- Sign-in rules ----------

  it("staff and admins get their rights with a password alone, even with an authenticator set up", async () => {
    const staff = await passwordOnly("staffA");
    const seen = await must(staff.from("clients").select("id"));
    assert.deepEqual(seen.map((c) => c.id), [ids.clientA]);
    const admin = await passwordOnly("admin");
    const all = (await must(admin.from("clients").select("id"))).map((c) => c.id);
    assert.ok(all.includes(ids.clientA) && all.includes(ids.clientB));
  });

  it("staff without an authenticator get their rights with a password alone", async () => {
    const email = `rls-test-${run}-nocode@example.test`;
    const { data } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    const id = data.user!.id;
    try {
      await ok(svc.from("profiles").upsert({ id, email, full_name: "No code", role: "staff" }));
      await ok(svc.from("staff_clients").insert({ user_id: id, client_id: ids.clientA }));
      const db = createClient(URL!, ANON!, noSession);
      await ok(db.auth.signInWithPassword({ email, password }));
      const seen = await must(db.from("clients").select("id"));
      assert.deepEqual(seen.map((c) => c.id), [ids.clientA]);
    } finally {
      await svc.auth.admin.deleteUser(id);
    }
  });

  it("an account still on the starting password sees nothing until the person changes it", async () => {
    const email = `rls-test-${run}-starting@example.test`;
    const { data } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    const id = data.user!.id;
    try {
      await ok(
        svc.from("profiles").upsert({
          id, email, full_name: "Starting", role: "client", client_id: ids.clientA, must_change_password: true,
        }),
      );
      const db = createClient(URL!, ANON!, noSession);
      await ok(db.auth.signInWithPassword({ email, password }));
      assert.deepEqual(await must(db.from("clients").select("id")), []);
      assert.deepEqual(await must(db.from("documents").select("id")), []);
      const mine = await must(db.from("profiles").select("must_change_password").eq("id", id));
      assert.equal(mine[0]?.must_change_password, true, "can still read own profile to be sent to the change screen");
      await ok(svc.from("profiles").update({ must_change_password: false }).eq("id", id));
      assert.deepEqual((await must(db.from("clients").select("id"))).map((c) => c.id), [ids.clientA]);
    } finally {
      await svc.auth.admin.deleteUser(id);
    }
  });

  it("invite only: nobody can create their own account", async () => {
    const email = `rls-test-${run}-stranger@example.test`;
    const { data, error } = await createClient(URL!, ANON!, noSession).auth.signUp({ email, password });
    if (data.user) await svc.auth.admin.deleteUser(data.user.id);
    assert.ok(error, "sign-ups must be disabled in Supabase (Authentication > Sign In / Providers)");
  });

  it("a signed-in account that no admin set up sees nothing", async () => {
    const email = `rls-test-${run}-noprofile@example.test`;
    const { data } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    const id = data.user!.id;
    try {
      const db = createClient(URL!, ANON!, noSession);
      await ok(db.auth.signInWithPassword({ email, password }));
      for (const t of [...clientTables, "audit_log"])
        assert.deepEqual(await must(db.from(t).select("*").limit(1)), [], t);
      // Only RampRate staff names are visible to everyone signed in (they label query threads).
      const people = await must(db.from("profiles").select("role"));
      assert.ok(people.every((p) => p.role === "staff" || p.role === "admin"));
    } finally {
      await svc.auth.admin.deleteUser(id);
    }
  });
});
