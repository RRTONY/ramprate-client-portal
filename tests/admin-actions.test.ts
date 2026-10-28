import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, seed, table, callsTo } from "./support/fake-supabase.ts";
import { redirectOf, nav, RedirectSignal } from "./support/fake-next.ts";
import {
  CLIENT_A,
  CLIENT_B,
  signIn,
  form,
  freshWorld,
  restoreWorld,
  auditActions,
  readyClient,
  type SentEmail,
} from "./support/helpers.ts";
import * as actions from "@/lib/admin-actions";

let sent: SentEmail[];
beforeEach(() => {
  sent = freshWorld();
});
afterEach(restoreWorld);

const writes = () => db.calls.filter((c) => c.action !== "select");

// ---------- Permission first, for every action ----------

// Actions guarded by assertCanManage(clientId): allowed for admins and assigned staff only.
const managerActions: [string, () => Promise<unknown>][] = [
  ["updateClientAction", () => actions.updateClientAction(CLIENT_A, form({ name: "x" }))],
  ["addProgress", () => actions.addProgress(CLIENT_A, form({ title: "x" }))],
  ["updateProgress", () => actions.updateProgress(CLIENT_A, "p1", form({ title: "x" }))],
  ["deleteProgress", () => actions.deleteProgress(CLIENT_A, "p1")],
  ["addUpdate", () => actions.addUpdate(CLIENT_A, form({ title: "x" }))],
  ["toggleUpdate", () => actions.toggleUpdate(CLIENT_A, "u1", true)],
  ["deleteUpdate", () => actions.deleteUpdate(CLIENT_A, "u1")],
  ["addMeeting", () => actions.addMeeting(CLIENT_A, form({ title: "x", starts_at: "2026-11-02T09:00" }))],
  ["updateMeetingNotes", () => actions.updateMeetingNotes(CLIENT_A, "m1", form({}))],
  ["deleteMeeting", () => actions.deleteMeeting(CLIENT_A, "m1")],
  ["uploadDocument", () => actions.uploadDocument(CLIENT_A, form({ storage_path: `${CLIENT_A}/x`, file_name: "x" }))],
  ["toggleDocument", () => actions.toggleDocument(CLIENT_A, "d1", true)],
  ["deleteDocument", () => actions.deleteDocument(CLIENT_A, "d1")],
  ["addClientTeamMember", () => actions.addClientTeamMember(CLIENT_A, form({ team_member_id: "t1" }))],
  ["removeClientTeamMember", () => actions.removeClientTeamMember(CLIENT_A, "r1")],
  ["inviteClientUser", () => actions.inviteClientUser(CLIENT_A, form({ email: "a@b.test" }))],
  ["revokeClientUser", () => actions.revokeClientUser(CLIENT_A, "u1")],
];

// Actions guarded by requireAdmin().
const adminActions: [string, () => Promise<unknown>][] = [
  ["createClientAction", () => actions.createClientAction(form({ name: "New" }))],
  ["assignStaff", () => actions.assignStaff(CLIENT_A, form({ user_id: "s1" }))],
  ["unassignStaff", () => actions.unassignStaff(CLIENT_A, "s1")],
  ["saveTeamMember", () => actions.saveTeamMember(form({ full_name: "x", email: "x@y.test" }))],
  ["inviteStaffUser", () => actions.inviteStaffUser(form({ email: "x@y.test" }))],
  ["removeStaffUser", () => actions.removeStaffUser("s1")],
  ["deleteClientAction", () => actions.deleteClientAction(CLIENT_A, form({ confirm: "Acme" }))],
];

const assertBlocked = () => {
  assert.deepEqual(writes(), [], "no data was changed");
  assert.equal(db.serviceClients, 0, "service key never used");
  assert.equal(sent.length, 0, "no email sent");
};

describe("permission: signed-out users are sent to login by every action", () => {
  for (const [name, run] of [...managerActions, ...adminActions]) {
    it(name, async () => {
      assert.equal(await redirectOf(run()), "/login");
      assertBlocked();
    });
  }
});

describe("permission: client users cannot run any staff action", () => {
  for (const [name, run] of managerActions) {
    it(name, async () => {
      signIn("client");
      assert.equal(await redirectOf(run()), "/");
      assertBlocked();
    });
  }
  // requireAdmin sends non-admins to /admin; the admin layout then sends clients home.
  for (const [name, run] of adminActions) {
    it(name, async () => {
      signIn("client");
      assert.equal(await redirectOf(run()), "/admin");
      assertBlocked();
    });
  }
});

describe("permission: staff cannot manage a client they are not assigned to", () => {
  for (const [name, run] of managerActions) {
    it(name, async () => {
      signIn("staff", { manages: [CLIENT_B] });
      await assert.rejects(run(), /do not have access/);
      assertBlocked();
    });
  }
});

describe("permission: staff cannot run admin-only actions", () => {
  for (const [name, run] of adminActions) {
    it(name, async () => {
      signIn("staff", { manages: [CLIENT_A] });
      assert.equal(await redirectOf(run()), "/admin");
      assertBlocked();
    });
  }
});

describe("permission: assigned staff can run every manager action", () => {
  for (const [name, run] of managerActions) {
    it(name, async () => {
      signIn("staff", { manages: [CLIENT_A] });
      try {
        await run();
      } catch (e) {
        // Some actions finish with a redirect; that still means they were allowed in.
        if (!(e instanceof RedirectSignal)) throw e;
        assert.notEqual(e.url, "/");
        assert.notEqual(e.url, "/login");
      }
    });
  }
});

// ---------- Clients ----------

describe("createClientAction", () => {
  it("creates the client, adds owner and SPOC to the team, logs it and opens it", async () => {
    signIn("admin");
    const url = await redirectOf(
      actions.createClientAction(
        form({ name: "Acme Corp!", engagement_owner_id: "o1", spoc_id: "s1" }),
      ),
    );
    const [c] = table("clients");
    assert.equal(c.name, "Acme Corp!");
    assert.equal(c.slug, "acmecorp");
    assert.equal(url, `/admin/clients/${c.id}`);
    assert.deepEqual(
      table("client_team").map((r) => [r.team_member_id, r.engagement_role]),
      [
        ["o1", "Engagement lead"],
        ["s1", "Single point of contact"],
      ],
    );
    assert.deepEqual(auditActions(), ["client.create"]);
  });

  it("adds the person once when owner and SPOC are the same", async () => {
    signIn("admin");
    await redirectOf(
      actions.createClientAction(form({ name: "Solo", engagement_owner_id: "o1", spoc_id: "o1" })),
    );
    assert.equal(table("client_team").length, 1);
  });

  it("gives a random slug when the name has no letters or digits", async () => {
    signIn("admin");
    await redirectOf(actions.createClientAction(form({ name: "!!!" })));
    assert.match(table("clients")[0].slug as string, /^[0-9a-f]{8}$/);
  });

  it("rejects a blank name", async () => {
    signIn("admin");
    assert.equal(
      await redirectOf(actions.createClientAction(form({ name: "  " }))),
      "/admin/clients/new?error=missing",
    );
    assert.equal(table("clients").length, 0);
  });

  it("reports a duplicate", async () => {
    signIn("admin");
    db.handlers.unshift((c) =>
      c.table === "clients" && c.action === "insert"
        ? { data: null, error: { message: "duplicate key" } }
        : undefined,
    );
    assert.equal(
      await redirectOf(actions.createClientAction(form({ name: "Acme" }))),
      "/admin/clients/new?error=exists",
    );
    assert.deepEqual(auditActions(), []);
  });
});

describe("updateClientAction", () => {
  beforeEach(() => {
    seed("clients", { id: CLIENT_A, name: "Acme" });
  });

  it("saves the overview with cleaned-up lists", async () => {
    signIn("staff", { manages: [CLIENT_A] });
    await actions.updateClientAction(
      CLIENT_A,
      form({
        name: " Acme ",
        health: "at_risk",
        priorities: "Cut costs\n\n  Renew MSA  \n",
        phases: "A\nB\nC\nD\nE\nF\nG\nH\nI\nJ",
        current_phase: "2",
        slack_channel: "",
        next_update_due: "2026-11-15",
      }),
    );
    const c = table("clients")[0];
    assert.equal(c.name, "Acme");
    assert.equal(c.health, "at_risk");
    assert.equal(c.status, "Active");
    assert.deepEqual(c.priorities, ["Cut costs", "Renew MSA"]);
    assert.equal((c.phases as string[]).length, 8, "at most 8 phases");
    assert.equal(c.current_phase, 2);
    assert.equal(c.slack_channel, null);
    assert.equal(c.next_update_due, "2026-11-15");
    assert.deepEqual(auditActions(), ["client.update"]);
    assert.ok(nav.revalidated.includes(`/portal/${CLIENT_A}`));
  });

  it("falls back to safe values for bad input", async () => {
    signIn("admin");
    await actions.updateClientAction(
      CLIENT_A,
      form({ name: "Acme", health: "<script>", phases: "", current_phase: "-5" }),
    );
    const c = table("clients")[0];
    assert.equal(c.health, "on_track");
    assert.deepEqual(c.phases, ["Kickoff", "Build", "Launch"]);
    assert.equal(c.current_phase, 0);
  });

  it("only updates the given client", async () => {
    seed("clients", { id: CLIENT_B, name: "Other" });
    signIn("admin");
    await actions.updateClientAction(CLIENT_A, form({ name: "Changed" }));
    assert.equal(table("clients")[1].name, "Other");
  });
});

describe("deleteClientAction", () => {
  beforeEach(() => {
    seed("clients", { id: CLIENT_A, name: "Acme" });
    seed("documents", { id: "d1", client_id: CLIENT_A, storage_path: `${CLIENT_A}/a.pdf` });
    seed(
      "profiles",
      { id: "c1", role: "client", client_id: CLIENT_A },
      { id: "c2", role: "client", client_id: CLIENT_B },
      { id: "st", role: "staff", client_id: CLIENT_A },
    );
  });

  it("requires the exact client name", async () => {
    signIn("admin");
    assert.equal(
      await redirectOf(actions.deleteClientAction(CLIENT_A, form({ confirm: "acme" }))),
      `/admin/clients/${CLIENT_A}?error=confirm`,
    );
    assert.equal(table("clients").length, 1);
    assert.deepEqual(db.storageRemoved, []);
    assert.deepEqual(db.deletedUsers, []);
  });

  it("removes the client, its files and only its own client logins, and logs it first", async () => {
    signIn("admin");
    assert.equal(
      await redirectOf(actions.deleteClientAction(CLIENT_A, form({ confirm: "Acme" }))),
      "/admin",
    );
    assert.equal(table("clients").length, 0);
    assert.deepEqual(db.storageRemoved, [`${CLIENT_A}/a.pdf`]);
    assert.deepEqual(db.deletedUsers, ["c1"]);
    assert.deepEqual(auditActions(), ["client.delete"]);
  });
});

// ---------- Progress, updates, meetings ----------

describe("progress items", () => {
  it("adds an item with a safe status and marks the portal updated", async () => {
    signIn("admin");
    seed("clients", { id: CLIENT_A, last_updated_at: "2020-01-01" });
    await actions.addProgress(
      CLIENT_A,
      form({ title: "Send data", status: "bogus", due_date: "", owner_name: "Jane" }),
    );
    const [p] = table("progress_items");
    assert.equal(p.status, "upcoming");
    assert.equal(p.due_date, null);
    assert.equal(p.owner_name, "Jane");
    assert.notEqual(table("clients")[0].last_updated_at, "2020-01-01");
    assert.deepEqual(auditActions(), ["progress.create"]);
  });

  it("ignores an item without a title", async () => {
    signIn("admin");
    await actions.addProgress(CLIENT_A, form({ title: " " }));
    assert.equal(table("progress_items").length, 0);
    assert.deepEqual(auditActions(), []);
  });

  it("updates and deletes only within the given client", async () => {
    signIn("admin");
    seed("progress_items", { id: "p1", client_id: CLIENT_B, title: "B's item" });
    await actions.updateProgress(CLIENT_A, "p1", form({ title: "hijack" }));
    await actions.deleteProgress(CLIENT_A, "p1");
    assert.equal(table("progress_items")[0].title, "B's item");
  });

  it("updates and deletes an item on the right client", async () => {
    signIn("admin");
    seed("progress_items", { id: "p1", client_id: CLIENT_A, title: "Old" });
    await actions.updateProgress(CLIENT_A, "p1", form({ title: "New", status: "completed" }));
    assert.equal(table("progress_items")[0].status, "completed");
    await actions.deleteProgress(CLIENT_A, "p1");
    assert.equal(table("progress_items").length, 0);
    assert.deepEqual(auditActions(), ["progress.update", "progress.delete"]);
  });
});

describe("activity updates", () => {
  beforeEach(() => {
    seed("clients", { id: CLIENT_A, name: "Acme" });
    seed("profiles", {
      id: "c1",
      email: "jane@acme.test",
      role: "client",
      client_id: CLIENT_A,
      notify_email: true,
    });
  });

  it("adds a published update and emails the client when asked", async () => {
    const me = signIn("staff", { manages: [CLIENT_A] });
    await actions.addUpdate(
      CLIENT_A,
      form({ title: "Kickoff", body: "Went well", kind: "milestone", published: "on", notify: "on" }),
    );
    const [u] = table("updates");
    assert.equal(u.kind, "milestone");
    assert.equal(u.published, true);
    assert.equal(u.created_by, me.id);
    assert.match(u.occurred_on as string, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ["jane@acme.test"]);
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
    assert.equal(sent[0].subject, "[RampRate] New update: Kickoff");
    assert.deepEqual(auditActions(), ["update.create", "email.client_notification"]);
  });

  it("never emails about a hidden (draft) update", async () => {
    signIn("admin");
    await actions.addUpdate(CLIENT_A, form({ title: "Draft", notify: "on" }));
    assert.equal(table("updates")[0].published, false);
    assert.equal(sent.length, 0);
  });

  it("does not email unless asked", async () => {
    signIn("admin");
    await actions.addUpdate(CLIENT_A, form({ title: "Quiet", published: "on" }));
    assert.equal(sent.length, 0);
  });

  it("publishes, hides and deletes within the given client", async () => {
    signIn("admin");
    seed("updates", { id: "u1", client_id: CLIENT_A, published: false });
    await actions.toggleUpdate(CLIENT_A, "u1", true);
    assert.equal(table("updates")[0].published, true);
    await actions.toggleUpdate(CLIENT_A, "u1", false);
    await actions.deleteUpdate(CLIENT_A, "u1");
    assert.equal(table("updates").length, 0);
    assert.deepEqual(auditActions(), ["update.publish", "update.unpublish", "update.delete"]);
  });
});

describe("meetings", () => {
  it("stores the start time converted from Pacific time", async () => {
    signIn("admin");
    await actions.addMeeting(
      CLIENT_A,
      form({ title: "Sync", starts_at: "2026-11-02T09:00", location: "" }),
    );
    const [m] = table("meetings");
    assert.equal(m.starts_at, "2026-11-02T17:00:00.000Z");
    assert.equal(m.location, null);
    assert.deepEqual(auditActions(), ["meeting.create"]);
  });

  it("needs both a title and a time", async () => {
    signIn("admin");
    await actions.addMeeting(CLIENT_A, form({ title: "Sync" }));
    await actions.addMeeting(CLIENT_A, form({ starts_at: "2026-11-02T09:00" }));
    assert.equal(table("meetings").length, 0);
  });

  it("updates notes and deletes within the given client", async () => {
    signIn("admin");
    seed("meetings", { id: "m1", client_id: CLIENT_A, notes: "" });
    await actions.updateMeetingNotes(CLIENT_A, "m1", form({ notes: "Decided X", agenda: "A" }));
    assert.equal(table("meetings")[0].notes, "Decided X");
    await actions.deleteMeeting(CLIENT_B, "m1");
    assert.equal(table("meetings").length, 1);
    await actions.deleteMeeting(CLIENT_A, "m1");
    assert.equal(table("meetings").length, 0);
  });
});

// ---------- Documents ----------

describe("uploadDocument", () => {
  const objectName = "0f8fad5b-d9cb-469f-a165-70867728950e-Signed SOW.pdf";
  const path = `${CLIENT_A}/${objectName}`;
  const upload = (values: Record<string, string> = {}) =>
    redirectOf(
      actions.uploadDocument(
        CLIENT_A,
        form({ storage_path: path, file_name: "Signed SOW.pdf", category: "SOW", ...values }),
      ),
    );
  const putObject = (size: number) => {
    db.storageObjects[`client-documents/${CLIENT_A}`] = [
      { name: objectName, metadata: { size } },
    ];
  };

  it("records a file that really exists in this client's folder, using Storage's size", async () => {
    const me = signIn("staff", { manages: [CLIENT_A] });
    putObject(12345);
    const url = await upload({ title: "", file_size: "1", published: "on", is_signed: "on" });
    assert.equal(url, `/admin/clients/${CLIENT_A}/documents?ok=1`);
    const [d] = table("documents");
    assert.equal(d.title, "Signed SOW.pdf");
    assert.equal(d.category, "SOW");
    assert.equal(d.file_size, 12345);
    assert.equal(d.published, true);
    assert.equal(d.is_signed, true);
    assert.equal(d.uploaded_by, me.id);
    assert.deepEqual(auditActions(), ["document.upload"]);
  });

  it("rejects a path in another client's folder", async () => {
    signIn("admin");
    const url = await redirectOf(
      actions.uploadDocument(
        CLIENT_A,
        form({ storage_path: `${CLIENT_B}/${objectName}`, file_name: "x.pdf" }),
      ),
    );
    assert.equal(url, `/admin/clients/${CLIENT_A}/documents?error=nofile`);
    assert.equal(table("documents").length, 0);
  });

  it("rejects path tricks and missing names", async () => {
    signIn("admin");
    for (const bad of [
      `${CLIENT_A}/../${CLIENT_B}/x.pdf`,
      `${CLIENT_A}/not-a-uuid-file.pdf`,
      `${CLIENT_A}/0f8fad5b-d9cb-469f-a165-70867728950e-a/b.pdf`,
    ]) {
      const url = await redirectOf(
        actions.uploadDocument(CLIENT_A, form({ storage_path: bad, file_name: "x.pdf" })),
      );
      assert.match(url, /error=nofile/, bad);
    }
    assert.match(await upload({ file_name: "" }), /error=nofile/);
    assert.equal(table("documents").length, 0);
  });

  it("refuses to record a file that was never uploaded", async () => {
    signIn("admin");
    assert.match(await upload(), /error=upload$/);
    assert.equal(table("documents").length, 0);
  });

  it("deletes and refuses a file over 25 MB", async () => {
    signIn("admin");
    putObject(25 * 1024 * 1024 + 1);
    assert.match(await upload(), /error=toolarge$/);
    assert.deepEqual(db.storageRemoved, [path]);
    assert.equal(table("documents").length, 0);
  });

  it("accepts a file of exactly 25 MB", async () => {
    signIn("admin");
    putObject(25 * 1024 * 1024);
    assert.match(await upload(), /ok=1$/);
  });

  it("falls back to Other for an unknown category", async () => {
    signIn("admin");
    putObject(10);
    await upload({ category: "Secret" });
    assert.equal(table("documents")[0].category, "Other");
  });

  it("emails the client only when published and notify are both ticked", async () => {
    signIn("admin");
    seed("clients", { id: CLIENT_A, name: "Acme" });
    seed("profiles", { email: "jane@acme.test", role: "client", client_id: CLIENT_A, notify_email: true });
    putObject(10);
    await upload({ notify: "on" });
    assert.equal(sent.length, 0, "hidden document, no email");
    await upload({ notify: "on", published: "on", title: "Final SOW" });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].subject, "[RampRate] New document: Final SOW");
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
  });
});

describe("toggleDocument and deleteDocument", () => {
  beforeEach(() => {
    seed("documents", { id: "d1", client_id: CLIENT_A, storage_path: `${CLIENT_A}/f.pdf`, published: true });
  });

  it("hides and republishes a document", async () => {
    signIn("admin");
    await actions.toggleDocument(CLIENT_A, "d1", false);
    assert.equal(table("documents")[0].published, false);
    await actions.toggleDocument(CLIENT_A, "d1", true);
    assert.deepEqual(auditActions(), ["document.hide", "document.publish"]);
  });

  it("deletes the file from Storage and the row, and logs it", async () => {
    signIn("admin");
    await actions.deleteDocument(CLIENT_A, "d1");
    assert.deepEqual(db.storageRemoved, [`${CLIENT_A}/f.pdf`]);
    assert.equal(table("documents").length, 0);
    assert.deepEqual(auditActions(), ["document.delete"]);
  });

  it("does nothing for a document on a different client", async () => {
    signIn("admin");
    await actions.deleteDocument(CLIENT_B, "d1");
    assert.deepEqual(db.storageRemoved, []);
    assert.equal(table("documents").length, 1);
    assert.deepEqual(auditActions(), []);
  });
});

// ---------- Team and access ----------

describe("client team", () => {
  it("adds a person, and saving again updates rather than duplicates", async () => {
    signIn("admin");
    await actions.addClientTeamMember(CLIENT_A, form({ team_member_id: "t1", engagement_role: "Analyst" }));
    await actions.addClientTeamMember(CLIENT_A, form({ team_member_id: "t1", engagement_role: "Lead" }));
    assert.equal(table("client_team").length, 1);
    assert.equal(table("client_team")[0].engagement_role, "Lead");
  });

  it("ignores a missing person", async () => {
    signIn("admin");
    await actions.addClientTeamMember(CLIENT_A, form({}));
    assert.equal(table("client_team").length, 0);
  });

  it("removes only within the given client", async () => {
    signIn("admin");
    seed("client_team", { id: "r1", client_id: CLIENT_B, team_member_id: "t1" });
    await actions.removeClientTeamMember(CLIENT_A, "r1");
    assert.equal(table("client_team").length, 1);
    await actions.removeClientTeamMember(CLIENT_B, "r1");
    assert.equal(table("client_team").length, 0);
  });
});

describe("inviteClientUser", () => {
  const invite = (values: Record<string, string>) =>
    redirectOf(actions.inviteClientUser(CLIENT_A, form(values)));

  it("invites to a ready portal and creates a client profile tied to this client", async () => {
    signIn("staff", { manages: [CLIENT_A] });
    readyClient();
    process.env.NEXT_PUBLIC_SITE_URL = "https://portal.ramprate.com";
    const url = await invite({ email: " Jane@Acme.TEST ", full_name: "Jane" });
    assert.equal(url, `/admin/clients/${CLIENT_A}/access?ok=invited`);
    assert.equal(db.invites[0].email, "jane@acme.test");
    assert.equal(
      db.invites[0].options.redirectTo,
      "https://portal.ramprate.com/auth/confirm?next=/auth/set-password",
    );
    const p = table("profiles").find((r) => r.email === "jane@acme.test")!;
    assert.equal(p.role, "client");
    assert.equal(p.client_id, CLIENT_A);
    assert.deepEqual(table("audit_log")[0].detail, {
      email: "jane@acme.test",
      readinessOverride: false,
    });
  });

  it("blocks the invite while the portal is incomplete", async () => {
    signIn("staff", { manages: [CLIENT_A] });
    seed("clients", { id: CLIENT_A, summary: "", approach: "", priorities: [], expectations: "" });
    assert.match(await invite({ email: "a@b.test" }), /error=notready$/);
    assert.equal(db.invites.length, 0);
    assert.equal(db.serviceClients, 0);
  });

  it("does not let staff use the override", async () => {
    signIn("staff", { manages: [CLIENT_A] });
    seed("clients", { id: CLIENT_A, summary: "", approach: "", priorities: [], expectations: "" });
    assert.match(await invite({ email: "a@b.test", override: "on" }), /error=notready$/);
    assert.equal(db.invites.length, 0);
  });

  it("lets an admin override, and records the override in the audit log", async () => {
    signIn("admin");
    seed("clients", { id: CLIENT_A, summary: "", approach: "", priorities: [], expectations: "" });
    assert.match(await invite({ email: "a@b.test", override: "on" }), /ok=invited$/);
    assert.deepEqual(table("audit_log")[0].detail, {
      email: "a@b.test",
      readinessOverride: true,
    });
  });

  it("requires an email", async () => {
    signIn("admin");
    assert.match(await invite({ email: "" }), /error=missing$/);
  });

  it("reports an invite failure without creating a profile", async () => {
    signIn("admin");
    readyClient();
    db.inviteError = { message: "rate limited" };
    assert.match(await invite({ email: "a@b.test" }), /error=invite$/);
    assert.equal(table("profiles").filter((p) => p.email === "a@b.test").length, 0);
  });
});

describe("revokeClientUser", () => {
  beforeEach(() => {
    seed(
      "profiles",
      { id: "mine", role: "client", client_id: CLIENT_A },
      { id: "theirs", role: "client", client_id: CLIENT_B },
      { id: "staffer", role: "staff", client_id: CLIENT_A },
    );
  });

  it("removes a client login on this client", async () => {
    signIn("staff", { manages: [CLIENT_A] });
    await actions.revokeClientUser(CLIENT_A, "mine");
    assert.deepEqual(db.deletedUsers, ["mine"]);
    assert.deepEqual(auditActions(), ["client_user.revoke"]);
  });

  it("refuses to remove a login from another client", async () => {
    signIn("staff", { manages: [CLIENT_A] });
    await actions.revokeClientUser(CLIENT_A, "theirs");
    assert.deepEqual(db.deletedUsers, []);
  });

  it("refuses to remove a staff account through the client screen", async () => {
    signIn("admin");
    await actions.revokeClientUser(CLIENT_A, "staffer");
    assert.deepEqual(db.deletedUsers, []);
    assert.deepEqual(auditActions(), []);
  });
});

describe("staff assignment", () => {
  it("assigns once and unassigns", async () => {
    signIn("admin");
    await actions.assignStaff(CLIENT_A, form({ user_id: "s1" }));
    await actions.assignStaff(CLIENT_A, form({ user_id: "s1" }));
    assert.equal(table("staff_clients").filter((r) => r.user_id === "s1").length, 1);
    await actions.unassignStaff(CLIENT_A, "s1");
    assert.equal(table("staff_clients").filter((r) => r.user_id === "s1").length, 0);
    assert.deepEqual(auditActions(), ["staff.assign", "staff.assign", "staff.unassign"]);
  });

  it("does not write an assignment without a user", async () => {
    signIn("admin");
    await actions.assignStaff(CLIENT_A, form({}));
    assert.equal(callsTo("staff_clients", "upsert").length, 0);
  });
});

describe("saveTeamMember", () => {
  it("creates an active member with a lower-case email", async () => {
    signIn("admin");
    assert.equal(
      await redirectOf(
        actions.saveTeamMember(
          form({ full_name: "Sam", title: "CEO", email: "SAM@RampRate.com", calendly_url: "https://calendly.com/sam" }),
        ),
      ),
      "/admin/team?ok=1",
    );
    const [t] = table("team_members");
    assert.equal(t.email, "sam@ramprate.com");
    assert.equal(t.active, true);
    assert.equal(t.calendly_url, "https://calendly.com/sam");
    assert.deepEqual(auditActions(), ["team_member.create"]);
  });

  it("drops booking links that are not plain https", async () => {
    signIn("admin");
    for (const bad of ["javascript:alert(1)", "http://calendly.com/x", "https://a b"]) {
      await redirectOf(actions.saveTeamMember(form({ full_name: "X", email: `${bad.length}@x.test`, calendly_url: bad })));
    }
    assert.ok(table("team_members").every((t) => t.calendly_url === null));
  });

  it("can deactivate an existing member", async () => {
    signIn("admin");
    seed("team_members", { id: "t1", full_name: "Old", email: "old@x.test", active: true });
    await redirectOf(actions.saveTeamMember(form({ id: "t1", full_name: "Old", email: "old@x.test" })));
    assert.equal(table("team_members")[0].active, false);
    assert.deepEqual(auditActions(), ["team_member.update"]);
  });

  it("requires a name and email", async () => {
    signIn("admin");
    assert.equal(
      await redirectOf(actions.saveTeamMember(form({ full_name: "", email: "x@y.test" }))),
      "/admin/team?error=missing",
    );
    assert.equal(table("team_members").length, 0);
  });
});

describe("inviteStaffUser", () => {
  it("invites staff by default and never ties them to a client", async () => {
    signIn("admin");
    assert.equal(
      await redirectOf(actions.inviteStaffUser(form({ email: "New@RampRate.com", role: "superuser" }))),
      "/admin/users?ok=invited",
    );
    const p = table("profiles").find((r) => r.email === "new@ramprate.com")!;
    assert.equal(p.role, "staff");
    assert.equal(p.client_id, null);
  });

  it("can invite an admin", async () => {
    signIn("admin");
    await redirectOf(actions.inviteStaffUser(form({ email: "boss@ramprate.com", role: "admin" })));
    assert.equal(table("profiles").find((r) => r.email === "boss@ramprate.com")!.role, "admin");
  });

  it("reports failures", async () => {
    signIn("admin");
    assert.equal(await redirectOf(actions.inviteStaffUser(form({ email: "" }))), "/admin/users?error=missing");
    db.inviteError = { message: "x" };
    assert.equal(await redirectOf(actions.inviteStaffUser(form({ email: "a@b.test" }))), "/admin/users?error=invite");
  });
});

describe("removeStaffUser", () => {
  it("removes a staff account and logs it", async () => {
    signIn("admin");
    seed("profiles", { id: "s1", email: "s1@ramprate.com", role: "staff" });
    await actions.removeStaffUser("s1");
    assert.deepEqual(db.deletedUsers, ["s1"]);
    assert.deepEqual(table("audit_log")[0].detail, { email: "s1@ramprate.com" });
  });

  it("never lets an admin remove themselves", async () => {
    const me = signIn("admin");
    await actions.removeStaffUser(me.id as string);
    assert.deepEqual(db.deletedUsers, []);
    assert.equal(db.serviceClients, 0);
  });

  it("refuses to remove a client account through the staff screen", async () => {
    signIn("admin");
    seed("profiles", { id: "c1", role: "client", client_id: CLIENT_A });
    await actions.removeStaffUser("c1");
    assert.deepEqual(db.deletedUsers, []);
  });
});

describe("setNotifyPreference", () => {
  it("changes only the signed-in user's own preference via the safe database function", async () => {
    signIn("client");
    await actions.setNotifyPreference(form({}));
    assert.deepEqual(db.rpcs, [{ fn: "set_my_notify", args: { v: false } }]);
    await actions.setNotifyPreference(form({ notify_email: "on" }));
    assert.deepEqual(db.rpcs[1], { fn: "set_my_notify", args: { v: true } });
    assert.equal(callsTo("profiles", "update").length, 0);
  });

  it("does nothing when signed out", async () => {
    await actions.setNotifyPreference(form({ notify_email: "on" }));
    assert.deepEqual(db.rpcs, []);
  });
});

describe("service key use", () => {
  it("is only used by invite, revoke, staff removal and client deletion", async () => {
    signIn("admin");
    seed("clients", { id: CLIENT_A, name: "Acme" });
    await actions.addProgress(CLIENT_A, form({ title: "x" }));
    await actions.addUpdate(CLIENT_A, form({ title: "x" }));
    await actions.addMeeting(CLIENT_A, form({ title: "x", starts_at: "2026-11-02T09:00" }));
    await actions.updateClientAction(CLIENT_A, form({ name: "Acme" }));
    await actions.assignStaff(CLIENT_A, form({ user_id: "s1" }));
    assert.equal(db.serviceClients, 0);
    assert.ok(db.calls.every((c) => c.client === "user"));
  });
});
