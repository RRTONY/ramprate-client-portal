import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { db, seed, table } from "./support/fake-supabase.ts";
import {
  CLIENT_A,
  CLIENT_B,
  signIn,
  freshWorld,
  restoreWorld,
  auditActions,
  type SentEmail,
} from "./support/helpers.ts";
import { GET as download } from "../app/portal/[clientId]/documents/[docId]/download/route.ts";
import { GET as digest } from "../app/api/cron/digest/route.ts";
import { GET as confirm } from "../app/auth/confirm/route.ts";
import { POST as signout } from "../app/auth/signout/route.ts";

let sent: SentEmail[];
beforeEach(() => {
  sent = freshWorld();
});
afterEach(() => {
  restoreWorld();
  mock.timers.reset();
});

const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://portal.test${path}`, { headers });

describe("document download", () => {
  const doc = {
    id: "doc-1",
    client_id: CLIENT_A,
    storage_path: `${CLIENT_A}/1111-sow.pdf`,
    file_name: "sow.pdf",
    title: "Signed SOW",
    published: true,
  };
  const open = (clientId: string, docId: string, query = "") =>
    download(req(`/portal/${clientId}/documents/${docId}/download${query}`), {
      params: { clientId, docId },
    });

  it("redirects to a signed link that expires in 60 seconds", async () => {
    signIn("client");
    seed("documents", doc);
    const res = await open(CLIENT_A, "doc-1");
    assert.equal(res.status, 307);
    assert.match(res.headers.get("location") ?? "", /^https:\/\/storage\.test\//);
    assert.equal(db.signedUrls[0].path, doc.storage_path);
    assert.equal(db.signedUrls[0].expiresIn, 60);
    assert.deepEqual(db.signedUrls[0].options, { download: "sow.pdf" });
  });

  it("opens in the browser instead of downloading with ?mode=view", async () => {
    signIn("client");
    seed("documents", doc);
    await open(CLIENT_A, "doc-1", "?mode=view");
    assert.equal(db.signedUrls[0].options, undefined);
    assert.deepEqual(auditActions(), ["document.view"]);
  });

  it("logs every download to the audit log", async () => {
    signIn("client");
    seed("documents", doc);
    await open(CLIENT_A, "doc-1");
    const [row] = table("audit_log");
    assert.equal(row.action, "document.download");
    assert.equal(row.entity_id, "doc-1");
    assert.equal(row.client_id, CLIENT_A);
  });

  it("returns 404 when the document belongs to a different client", async () => {
    signIn("client");
    seed("documents", doc);
    const res = await open(CLIENT_B, "doc-1");
    assert.equal(res.status, 404);
    assert.equal(db.signedUrls.length, 0);
    assert.deepEqual(auditActions(), []);
  });

  it("returns 404 when the document is not visible (RLS hides it)", async () => {
    signIn("client");
    const res = await open(CLIENT_A, "missing");
    assert.equal(res.status, 404);
  });

  it("returns 500 when Storage cannot sign the link", async () => {
    signIn("client");
    seed("documents", doc);
    db.signError = { message: "boom" };
    const res = await open(CLIENT_A, "doc-1");
    assert.equal(res.status, 500);
  });
});

describe("weekly digest", () => {
  const call = (auth?: string) =>
    digest(req("/api/cron/digest", auth ? { authorization: auth } : {}));

  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
  });

  it("refuses requests without the secret", async () => {
    assert.equal((await call()).status, 401);
    assert.equal((await call("Bearer wrong")).status, 401);
    assert.equal(db.serviceClients, 0, "never opens the service client");
  });

  it("refuses everything when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    assert.equal((await call("Bearer ")).status, 401);
    assert.equal((await call("Bearer undefined")).status, 401);
  });

  it("emails each active client's users a summary of the week", async () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-26T16:00:00Z") });
    seed(
      "clients",
      { id: CLIENT_A, name: "Acme", health: "on_track" },
      { id: CLIENT_B, name: "Paused", health: "on_hold" },
    );
    seed(
      "profiles",
      { email: "jane@acme.test", role: "client", client_id: CLIENT_A, notify_email: true },
      { email: "off@acme.test", role: "client", client_id: CLIENT_A, notify_email: false },
      { email: "b@paused.test", role: "client", client_id: CLIENT_B, notify_email: true },
    );
    seed("updates", {
      client_id: CLIENT_A,
      title: "Kickoff held",
      occurred_on: "2026-10-22",
      published: true,
      created_at: "2026-10-22T18:00:00Z",
    }, {
      client_id: CLIENT_A,
      title: "Draft only",
      occurred_on: "2026-10-22",
      published: false,
      created_at: "2026-10-22T18:00:00Z",
    }, {
      client_id: CLIENT_A,
      title: "Old news",
      occurred_on: "2026-10-01",
      published: true,
      created_at: "2026-10-01T18:00:00Z",
    });
    seed("progress_items", {
      client_id: CLIENT_A,
      title: "Send invoices",
      status: "pending",
      due_date: "2026-11-02",
    });
    seed("meetings", {
      client_id: CLIENT_A,
      title: "Weekly sync",
      starts_at: "2026-10-28T17:30:00Z",
    });

    const res = await call("Bearer s3cret");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, digestsSent: 1 });
    assert.equal(sent.length, 1);
    const [mail] = sent;
    assert.deepEqual(mail.to, ["jane@acme.test"]);
    assert.deepEqual(mail.cc, ["sam@ramprate.com"]);
    assert.ok(mail.html.includes("Kickoff held (Oct 22, 2026)"));
    assert.ok(!mail.html.includes("Draft only"));
    assert.ok(!mail.html.includes("Old news"));
    assert.ok(mail.html.includes("Send invoices (by Nov 2, 2026)"));
    assert.ok(mail.html.includes("Weekly sync: Wed, Oct 28, 2026"));
  });

  it("skips clients with nothing new", async () => {
    seed("clients", { id: CLIENT_A, name: "Acme", health: "on_track" });
    seed("profiles", {
      email: "jane@acme.test",
      role: "client",
      client_id: CLIENT_A,
      notify_email: true,
    });
    const res = await call("Bearer s3cret");
    assert.deepEqual(await res.json(), { ok: true, digestsSent: 0 });
    assert.equal(sent.length, 0);
  });
});

describe("invite and reset link handler", () => {
  const land = async (q: string) =>
    (await confirm(req(`/auth/confirm${q}`))).headers
      .get("location")
      ?.replace("http://portal.test", "");

  it("verifies the token and goes to the next page", async () => {
    assert.equal(
      await land("?token_hash=abc&type=invite&next=/auth/set-password"),
      "/auth/set-password",
    );
    assert.deepEqual(db.otpChecks[0], { type: "invite", token_hash: "abc" });
  });

  it("refuses to redirect off-site", async () => {
    assert.equal(await land("?token_hash=abc&type=recovery&next=//evil.test"), "/");
    assert.equal(
      await land("?token_hash=abc&type=recovery&next=https://evil.test"),
      "/",
    );
  });

  it("sends a bad or expired link back to login with an error", async () => {
    db.otpError = { message: "expired" };
    assert.equal(await land("?token_hash=abc&type=invite"), "/login?error=link");
  });

  it("rejects links with missing parts without checking anything", async () => {
    assert.equal(await land("?type=invite"), "/login?error=link");
    assert.equal(await land("?token_hash=abc"), "/login?error=link");
    assert.equal(db.otpChecks.length, 0);
  });
});

describe("sign out", () => {
  it("signs out and returns to login with a 303", async () => {
    signIn("client");
    const res = await signout(req("/auth/signout"));
    assert.equal(db.signedOut, true);
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "http://portal.test/login");
  });
});
