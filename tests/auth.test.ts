import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  seed,
  table,
  on,
} from "./support/fake-supabase.ts";
import { redirectOf, NotFoundSignal } from "./support/fake-next.ts";
import {
  CLIENT_A,
  CLIENT_B,
  signIn,
  freshWorld,
  restoreWorld,
  readyClient,
  type SentEmail,
} from "./support/helpers.ts";
import {
  requireProfile,
  requireStaff,
  requireAdmin,
  assertCanManage,
} from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getClientOr404, getTeamMember } from "@/lib/data";
import { getReadiness } from "@/lib/readiness";
import { notifyClientUsers } from "@/lib/notify";
import type { Client } from "@/lib/types";

let sent: SentEmail[];
beforeEach(() => {
  sent = freshWorld();
});
afterEach(restoreWorld);

describe("requireProfile", () => {
  it("sends signed-out visitors to the login page", async () => {
    assert.equal(await redirectOf(requireProfile()), "/login");
  });

  it("sends a signed-in user without a profile to login with an error", async () => {
    db.user = { id: "no-profile", email: "x@example.test" };
    assert.equal(await redirectOf(requireProfile()), "/login?error=no-profile");
  });

  it("returns the profile of the signed-in user", async () => {
    const me = signIn("client");
    const profile = await requireProfile();
    assert.equal(profile.id, me.id);
  });

  it("sends people still on the starting password to choose their own", async () => {
    signIn("admin", { profile: { must_change_password: true } });
    assert.equal(await redirectOf(requireProfile()), "/auth/set-password?first=1");
  });

  it("never sends anyone to a two-step code screen", async () => {
    for (const role of ["client", "staff", "admin"] as const) {
      signIn(role);
      db.aal = { currentLevel: "aal1", nextLevel: "aal2" };
      assert.equal((await requireProfile()).role, role);
    }
  });
});

describe("requireStaff", () => {
  it("sends client users back to their portal", async () => {
    signIn("client");
    assert.equal(await redirectOf(requireStaff()), "/");
  });

  it("allows staff and admins", async () => {
    signIn("staff");
    assert.equal((await requireStaff()).role, "staff");
    signIn("admin");
    assert.equal((await requireStaff()).role, "admin");
  });
});

describe("requireAdmin", () => {
  it("sends staff to the admin home", async () => {
    signIn("staff");
    assert.equal(await redirectOf(requireAdmin()), "/admin");
  });

  it("sends clients to the admin home, which then sends them to their portal", async () => {
    signIn("client");
    assert.equal(await redirectOf(requireAdmin()), "/admin");
  });

  it("allows admins", async () => {
    signIn("admin");
    assert.equal((await requireAdmin()).role, "admin");
  });
});

describe("assertCanManage", () => {
  it("lets admins manage any client", async () => {
    signIn("admin");
    await assertCanManage(CLIENT_A);
    await assertCanManage(CLIENT_B);
  });

  it("lets staff manage only the clients assigned to them", async () => {
    signIn("staff", { manages: [CLIENT_A] });
    await assertCanManage(CLIENT_A);
    await assert.rejects(assertCanManage(CLIENT_B), /do not have access/);
  });

  it("rejects staff with no assignments", async () => {
    signIn("staff");
    await assert.rejects(assertCanManage(CLIENT_A), /do not have access/);
  });

  it("never lets a client user manage, even their own client", async () => {
    signIn("client");
    assert.equal(await redirectOf(assertCanManage(CLIENT_A)), "/");
  });
});

describe("logEvent", () => {
  it("writes who did what, as the signed-in user", async () => {
    const me = signIn("staff");
    await logEvent({
      action: "document.upload",
      entity: "document",
      entityId: "doc-1",
      clientId: CLIENT_A,
      detail: { title: "SOW" },
    });
    const [row] = table("audit_log");
    assert.equal(row.actor_id, me.id);
    assert.equal(row.actor_email, me.email);
    assert.equal(row.actor_role, "staff");
    assert.equal(row.action, "document.upload");
    assert.equal(row.entity_id, "doc-1");
    assert.equal(row.client_id, CLIENT_A);
    assert.deepEqual(row.detail, { title: "SOW" });
  });

  it("fills empty optional fields with null and {}", async () => {
    signIn("admin");
    await logEvent({ action: "x" });
    const [row] = table("audit_log");
    assert.equal(row.entity, null);
    assert.equal(row.client_id, null);
    assert.deepEqual(row.detail, {});
  });

  it("writes nothing when nobody is signed in", async () => {
    await logEvent({ action: "x" });
    assert.equal(table("audit_log").length, 0);
  });

  it("never throws, so a logging failure cannot block the real action", async () => {
    signIn("admin");
    on("audit_log", "insert", () => {
      throw new Error("db down");
    });
    await logEvent({ action: "x" });
  });

  it("only ever inserts into the audit log, never updates or deletes", async () => {
    signIn("admin");
    await logEvent({ action: "x" });
    const writes = db.calls.filter((c) => c.table === "audit_log");
    assert.ok(writes.every((c) => c.action === "insert"));
  });
});

describe("getClientOr404", () => {
  it("returns 404 for an id that is not a UUID", async () => {
    signIn("admin");
    await assert.rejects(getClientOr404("../etc/passwd"), NotFoundSignal);
    assert.equal(db.calls.length, 0, "rejected before touching the database");
  });

  it("returns 404 when the client is not visible to the user", async () => {
    signIn("client");
    await assert.rejects(getClientOr404(CLIENT_B), NotFoundSignal);
  });

  it("returns the client when visible", async () => {
    signIn("client");
    seed("clients", { id: CLIENT_A, name: "Acme" });
    assert.equal((await getClientOr404(CLIENT_A)).name, "Acme");
  });
});

describe("getTeamMember", () => {
  it("returns null without a database call when no id is given", async () => {
    assert.equal(await getTeamMember(null), null);
    assert.equal(db.calls.length, 0);
  });
});

describe("getReadiness", () => {
  it("is ready when every item is filled in", async () => {
    signIn("admin");
    const client = readyClient();
    const r = await getReadiness(client as unknown as Client);
    assert.deepEqual(
      r.items.filter((i) => !i.ok).map((i) => i.key),
      [],
    );
    assert.equal(r.ready, true);
    assert.equal(r.done, r.items.length);
  });

  it("flags each missing item for a blank client", async () => {
    signIn("admin");
    const blank = {
      id: CLIENT_B,
      summary: "",
      approach: " ",
      priorities: [],
      expectations: "",
      engagement_owner_id: null,
      spoc_id: null,
      next_update_due: null,
    };
    const r = await getReadiness(blank as unknown as Client);
    assert.equal(r.ready, false);
    assert.equal(r.done, 0);
    assert.deepEqual(
      r.items.map((i) => i.key),
      [
        "summary",
        "approach",
        "priorities",
        "expect",
        "owner",
        "spoc",
        "team",
        "docs",
        "next",
        "meeting",
        "due",
      ],
    );
  });

  it("does not count hidden paperwork, other document types, or past meetings", async () => {
    signIn("admin");
    const client = readyClient();
    db.tables.documents = [
      { client_id: CLIENT_A, category: "SOW", published: false },
      { client_id: CLIENT_A, category: "Invoice", published: true },
    ];
    db.tables.meetings = [
      { client_id: CLIENT_A, starts_at: "2020-01-01T00:00:00Z" },
    ];
    db.tables.progress_items = [{ client_id: CLIENT_A, status: "completed" }];
    const r = await getReadiness(client as unknown as Client);
    const failed = r.items.filter((i) => !i.ok).map((i) => i.key);
    assert.deepEqual(failed, ["docs", "next", "meeting"]);
  });
});

describe("notifyClientUsers", () => {
  it("emails only this client's users who have not opted out, and CCs Sam", async () => {
    signIn("staff");
    seed("clients", { id: CLIENT_A, name: "Acme" });
    seed(
      "profiles",
      { id: "1", email: "on@acme.test", role: "client", client_id: CLIENT_A, notify_email: true },
      { id: "2", email: "off@acme.test", role: "client", client_id: CLIENT_A, notify_email: false },
      { id: "3", email: "other@b.test", role: "client", client_id: CLIENT_B, notify_email: true },
    );
    const res = await notifyClientUsers(CLIENT_A, "New update: Kickoff", ["Kickoff"]);
    assert.equal(res.sent, true);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ["on@acme.test"]);
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
  });

  it("sends nothing when no client user wants email", async () => {
    signIn("staff");
    const res = await notifyClientUsers(CLIENT_A, "x", ["y"]);
    assert.equal(res.sent, false);
    assert.equal(sent.length, 0);
  });
});
