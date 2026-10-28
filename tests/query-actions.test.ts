import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, seed, table, on, callsTo } from "./support/fake-supabase.ts";
import { redirectOf, nav } from "./support/fake-next.ts";
import {
  CLIENT_A,
  signIn,
  form,
  freshWorld,
  restoreWorld,
  auditActions,
  type SentEmail,
} from "./support/helpers.ts";
import { createQuery, replyToQuery, setQueryStatus } from "@/lib/query-actions";

let sent: SentEmail[];
beforeEach(() => {
  sent = freshWorld();
  seed("clients", {
    id: CLIENT_A,
    name: "Acme",
    engagement_owner: { email: "owner@ramprate.com" },
  });
  seed(
    "team_members",
    { email: "admin1@ramprate.com", is_admin_contact: true, active: true },
    { email: "gone@ramprate.com", is_admin_contact: true, active: false },
    { email: "plain@ramprate.com", is_admin_contact: false, active: true },
  );
});
afterEach(restoreWorld);

describe("createQuery", () => {
  const ask = (values: Record<string, string>) =>
    redirectOf(createQuery(CLIENT_A, form(values)));

  it("saves the question and first message, then opens the thread", async () => {
    const me = signIn("client");
    const url = await ask({
      subject: "  Invoice question ",
      body: " When is it due? ",
      category: "Billing / invoices",
    });
    const [q] = table("queries");
    assert.equal(q.subject, "Invoice question");
    assert.equal(q.category, "Billing / invoices");
    assert.equal(q.created_by, me.id);
    assert.equal(q.client_id, CLIENT_A);
    const [m] = table("query_messages");
    assert.equal(m.body, "When is it due?");
    assert.equal(m.query_id, q.id);
    assert.equal(m.author_id, me.id);
    assert.equal(url, `/portal/${CLIENT_A}/queries/${q.id}?sent=1`);
  });

  it("emails the engagement owner and active admin contacts, CCing Sam", async () => {
    const me = signIn("client");
    await ask({ subject: "Hi", body: "Hello" });
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ["owner@ramprate.com", "admin1@ramprate.com"]);
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
    assert.equal(sent[0].reply_to, me.email);
  });

  it("writes an audit entry including whether the email went out", async () => {
    signIn("client");
    await ask({ subject: "Hi", body: "Hello" });
    const [row] = table("audit_log");
    assert.equal(row.action, "query.create");
    assert.deepEqual(row.detail, { subject: "Hi", emailSent: true });
  });

  it("still saves the question when email is not set up, and says so", async () => {
    delete process.env.RESEND_API_KEY;
    signIn("client");
    const url = await ask({ subject: "Hi", body: "Hello" });
    assert.equal(table("queries").length, 1);
    assert.match(url, /\?sent=0$/);
  });

  it("falls back to General for an unknown category", async () => {
    signIn("client");
    await ask({ subject: "Hi", body: "Hello", category: "Hacked" });
    assert.equal(table("queries")[0].category, "General");
  });

  it("rejects a blank subject or body", async () => {
    signIn("client");
    assert.equal(
      await ask({ subject: " ", body: "x" }),
      `/portal/${CLIENT_A}/queries?error=missing`,
    );
    assert.equal(
      await ask({ subject: "x", body: "" }),
      `/portal/${CLIENT_A}/queries?error=missing`,
    );
    assert.equal(table("queries").length, 0);
    assert.equal(sent.length, 0);
  });

  it("reports failure and sends nothing when the database refuses (e.g. wrong client)", async () => {
    signIn("client");
    on("queries", "insert", { data: null, error: { message: "RLS" } });
    assert.equal(
      await ask({ subject: "Hi", body: "Hello" }),
      `/portal/${CLIENT_A}/queries?error=failed`,
    );
    assert.equal(table("query_messages").length, 0);
    assert.equal(sent.length, 0);
  });

  it("requires a signed-in user", async () => {
    assert.equal(await ask({ subject: "Hi", body: "Hello" }), "/login");
    assert.equal(table("queries").length, 0);
  });
});

describe("replyToQuery", () => {
  let creatorEmail: string;
  const QID = "query-1";

  beforeEach(() => {
    const creator = {
      id: "creator-1",
      email: "jane@acme.test",
      role: "client",
      client_id: CLIENT_A,
    };
    creatorEmail = creator.email;
    seed("profiles", creator);
    seed("queries", {
      id: QID,
      client_id: CLIENT_A,
      subject: "Invoice question",
      category: "Billing / invoices",
      created_by: creator.id,
      status: "open",
    });
  });

  const reply = (body: string) =>
    redirectOf(replyToQuery(CLIENT_A, QID, form({ body })));

  it("staff reply: saves it, marks answered, emails the client with Sam CC'd", async () => {
    const me = signIn("staff", { manages: [CLIENT_A] });
    const url = await reply("Due on the 1st.");
    assert.equal(url, `/admin/clients/${CLIENT_A}/queries/${QID}`);
    const [m] = table("query_messages");
    assert.equal(m.body, "Due on the 1st.");
    assert.equal(m.author_id, me.id);
    assert.equal(table("queries")[0].status, "answered");
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, [creatorEmail]);
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
    assert.deepEqual(auditActions(), ["query.staff_reply"]);
  });

  it("client reply: reopens the query and notifies RampRate", async () => {
    table("queries")[0].status = "answered";
    signIn("client");
    const url = await reply("Thanks, one more thing");
    assert.equal(url, `/portal/${CLIENT_A}/queries/${QID}`);
    assert.equal(table("queries")[0].status, "open");
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ["owner@ramprate.com", "admin1@ramprate.com"]);
    assert.match(sent[0].subject, /Re: Invoice question/);
    assert.deepEqual(auditActions(), ["query.client_reply"]);
  });

  it("ignores an empty reply", async () => {
    signIn("client");
    await reply("   ");
    assert.equal(table("query_messages").length, 0);
    assert.equal(sent.length, 0);
  });

  it("does nothing when the query is not on this client", async () => {
    signIn("client");
    const url = await redirectOf(
      replyToQuery("other-client", QID, form({ body: "hi" })),
    );
    assert.equal(url, `/portal/other-client/queries/${QID}`);
    assert.equal(table("query_messages").length, 0);
  });

  it("never edits or deletes what the client already wrote", async () => {
    signIn("staff", { manages: [CLIENT_A] });
    await reply("Answer");
    assert.equal(callsTo("query_messages", "update").length, 0);
    assert.equal(callsTo("query_messages", "delete").length, 0);
    const queryUpdates = callsTo("queries", "update");
    assert.ok(
      queryUpdates.every(
        (c) => JSON.stringify(Object.keys(c.payload as object)) === '["status"]',
      ),
      "only the status of a query changes",
    );
  });
});

describe("setQueryStatus", () => {
  beforeEach(() => {
    seed("queries", { id: "q1", client_id: CLIENT_A, status: "open" });
  });

  it("lets staff set any status and logs it", async () => {
    signIn("staff", { manages: [CLIENT_A] });
    await setQueryStatus(CLIENT_A, "q1", "answered");
    assert.equal(table("queries")[0].status, "answered");
    assert.deepEqual(table("audit_log")[0].detail, { status: "answered" });
    assert.ok(nav.revalidated.includes(`/portal/${CLIENT_A}/queries/q1`));
  });

  it("lets a client close their query", async () => {
    signIn("client");
    await setQueryStatus(CLIENT_A, "q1", "closed");
    assert.equal(table("queries")[0].status, "closed");
  });

  it("does not let a client mark a query answered or reopen it this way", async () => {
    signIn("client");
    await setQueryStatus(CLIENT_A, "q1", "answered");
    assert.equal(table("queries")[0].status, "open");
    assert.equal(table("audit_log").length, 0);
  });

  it("only touches the query on the given client", async () => {
    signIn("admin");
    await setQueryStatus("other-client", "q1", "closed");
    assert.equal(table("queries")[0].status, "open");
  });

  it("requires a signed-in user", async () => {
    assert.equal(await redirectOf(setQueryStatus(CLIENT_A, "q1", "closed")), "/login");
    assert.equal(db.calls.filter((c) => c.table === "queries").length, 0);
  });
});
