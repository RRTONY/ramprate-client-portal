import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  sendQueryNotification,
  sendClientReplyNotification,
  sendClientChangeNotification,
  sendWeeklyDigest,
  type QueryEmailInput,
} from "../lib/email.ts";

// Resend talks to its API over fetch. Intercepting fetch lets us inspect the email
// that would be sent without any network call or real inbox.
type Sent = {
  from: string;
  to: string[];
  cc?: string[];
  reply_to?: string | string[];
  subject: string;
  html: string;
};

const ENV_KEYS = ["RESEND_API_KEY", "SAM_EMAIL", "ADMIN_EMAIL", "EMAIL_FROM"];
const realFetch = globalThis.fetch;
let savedEnv: Record<string, string | undefined>;
let sent: Sent[];
let failWith: string | null;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.SAM_EMAIL = "sam@ramprate.com";
  sent = [];
  failWith = null;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    if (failWith)
      return new Response(
        JSON.stringify({ name: "validation_error", message: failWith }),
        { status: 422, headers: { "content-type": "application/json" } },
      );
    return new Response(JSON.stringify({ id: "email_1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const query = (over: Partial<QueryEmailInput> = {}): QueryEmailInput => ({
  clientId: "client-1",
  clientName: "Acme",
  queryId: "query-1",
  subject: "Contract question",
  category: "Billing",
  body: "Hello",
  fromName: "Jane Client",
  fromEmail: "jane@acme.test",
  isReply: false,
  to: ["owner@ramprate.com"],
  ...over,
});

describe("sendQueryNotification", () => {
  it("CCs Sam and sends to the listed recipients", async () => {
    const res = await sendQueryNotification(query());
    assert.deepEqual(res, { sent: true });
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ["owner@ramprate.com"]);
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
    assert.equal(sent[0].subject, "[Acme] Contract question");
  });

  it("sets reply-to to the client so staff can answer directly", async () => {
    await sendQueryNotification(query());
    const replyTo = sent[0].reply_to;
    assert.ok(
      replyTo === "jane@acme.test" ||
        (Array.isArray(replyTo) && replyTo.includes("jane@acme.test")),
    );
  });

  it("marks replies in the subject", async () => {
    await sendQueryNotification(query({ isReply: true }));
    assert.equal(sent[0].subject, "[Acme] Re: Contract question");
  });

  it("removes duplicates and never lists Sam in both To and CC", async () => {
    await sendQueryNotification(
      query({
        to: ["owner@ramprate.com", "owner@ramprate.com", "SAM@ramprate.com"],
      }),
    );
    assert.deepEqual(sent[0].to, ["owner@ramprate.com"]);
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
  });

  it("falls back to the admin address when there are no recipients", async () => {
    process.env.ADMIN_EMAIL = "admin@ramprate.com";
    await sendQueryNotification(query({ to: [] }));
    assert.deepEqual(sent[0].to, ["admin@ramprate.com"]);
  });

  it("does not send when Sam's address is missing", async () => {
    delete process.env.SAM_EMAIL;
    const res = await sendQueryNotification(query());
    assert.equal(res.sent, false);
    assert.equal(sent.length, 0);
  });

  it("does not send when the API key is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const res = await sendQueryNotification(query());
    assert.equal(res.sent, false);
    assert.equal(sent.length, 0);
  });

  it("does not send when the only recipient is Sam and there is no admin", async () => {
    const res = await sendQueryNotification(query({ to: ["sam@ramprate.com"] }));
    assert.equal(res.sent, false);
    assert.equal(sent.length, 0);
  });

  it("escapes HTML the client typed", async () => {
    await sendQueryNotification(
      query({ subject: "<script>x</script>", body: "a & b\nline 2" }),
    );
    const html = sent[0].html;
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;x&lt;/script&gt;"));
    assert.ok(html.includes("a &amp; b<br/>line 2"));
  });

  it("links to the query in the admin area", async () => {
    await sendQueryNotification(query());
    assert.ok(sent[0].html.includes("/admin/clients/client-1/queries/query-1"));
  });

  it("returns the error instead of throwing when Resend rejects", async () => {
    failWith = "Domain not verified";
    const res = await sendQueryNotification(query());
    assert.equal(res.sent, false);
    assert.equal(res.error, "Domain not verified");
  });

  it("returns the error instead of throwing when the network fails", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const res = await sendQueryNotification(query());
    assert.equal(res.sent, false);
    assert.ok(res.error);
  });
});

describe("sendClientReplyNotification", () => {
  const input = {
    to: "jane@acme.test",
    clientId: "client-1",
    clientName: "Acme",
    subject: "Contract question",
    body: "Here is the answer",
    fromName: "Owner",
  };

  it("emails the client and CCs Sam", async () => {
    const res = await sendClientReplyNotification(input);
    assert.deepEqual(res, { sent: true });
    assert.deepEqual(sent[0].to, ["jane@acme.test"]);
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
    assert.equal(
      sent[0].subject,
      "[RampRate] Response to your query: Contract question",
    );
    assert.ok(sent[0].html.includes("/portal/client-1/queries"));
  });

  it("does not send when Sam's address is missing", async () => {
    delete process.env.SAM_EMAIL;
    const res = await sendClientReplyNotification(input);
    assert.equal(res.sent, false);
    assert.equal(sent.length, 0);
  });
});

describe("sendClientChangeNotification", () => {
  const input = {
    to: ["jane@acme.test", "joe@acme.test"],
    clientId: "client-1",
    clientName: "Acme",
    headline: "New document added",
    lines: ["Signed SOW <final>"],
  };

  it("emails all client users and CCs Sam", async () => {
    const res = await sendClientChangeNotification(input);
    assert.deepEqual(res, { sent: true });
    assert.deepEqual(sent[0].to, ["jane@acme.test", "joe@acme.test"]);
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
    assert.equal(sent[0].subject, "[RampRate] New document added");
    assert.ok(sent[0].html.includes("Signed SOW &lt;final&gt;"));
  });

  it("does not send with no recipients", async () => {
    const res = await sendClientChangeNotification({ ...input, to: [] });
    assert.equal(res.sent, false);
    assert.equal(sent.length, 0);
  });
});

describe("sendWeeklyDigest", () => {
  const empty = {
    to: ["jane@acme.test"],
    clientId: "client-1",
    clientName: "Acme",
    newUpdates: [],
    newDocuments: [],
    actionNeeded: [],
    upcomingMeetings: [],
  };

  it("does not send when there is nothing new", async () => {
    const res = await sendWeeklyDigest(empty);
    assert.equal(res.sent, false);
    assert.equal(sent.length, 0);
  });

  it("sends only the sections that have content, and CCs Sam", async () => {
    const res = await sendWeeklyDigest({
      ...empty,
      actionNeeded: ["Review the SOW"],
    });
    assert.deepEqual(res, { sent: true });
    assert.deepEqual(sent[0].cc, ["sam@ramprate.com"]);
    assert.equal(sent[0].subject, "[RampRate] Your weekly summary: Acme");
    assert.ok(sent[0].html.includes("Needs your action"));
    assert.ok(sent[0].html.includes("Review the SOW"));
    assert.ok(!sent[0].html.includes("New documents"));
  });
});
