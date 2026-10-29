import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { db } from "./support/fake-supabase.ts";
import { signIn, freshWorld, restoreWorld } from "./support/helpers.ts";
import { middleware, config } from "../middleware.ts";

beforeEach(() => {
  freshWorld();
});
afterEach(restoreWorld);

const visit = (path: string) =>
  middleware(new NextRequest(`http://portal.test${path}`));

/** Where the middleware sent the visitor, or null if it let them through. */
async function landing(path: string): Promise<string | null> {
  const res = await visit(path);
  const loc = res.headers.get("location");
  return loc ? loc.replace("http://portal.test", "") : null;
}

const enrolled = { currentLevel: "aal1", nextLevel: "aal2" };
const verified = { currentLevel: "aal2", nextLevel: "aal2" };
const noFactor = { currentLevel: "aal1", nextLevel: "aal1" };

describe("middleware: signed out", () => {
  for (const path of [
    "/login",
    "/admin/login",
    "/auth/confirm",
    "/auth/finish",
    "/auth/set-password",
    "/privacy",
    "/brand/logo.svg",
    "/api/cron/digest",
    "/auth/signout",
  ]) {
    it(`lets visitors reach the public page ${path}`, async () => {
      assert.equal(await landing(path), null);
    });
  }

  it("sends portal visitors to the client login", async () => {
    assert.equal(await landing("/portal/abc"), "/login");
    assert.equal(await landing("/"), "/login");
  });

  it("sends admin visitors to the staff login", async () => {
    assert.equal(await landing("/admin"), "/admin/login");
    assert.equal(await landing("/admin/clients/abc"), "/admin/login");
  });

  it("does not treat look-alike paths as public", async () => {
    assert.equal(await landing("/loginx"), "/login");
    assert.equal(await landing("/privacy-secret"), "/login");
    assert.equal(await landing("/api/cronjob"), "/login");
  });
});

describe("middleware: signed in", () => {
  it("skips the login pages", async () => {
    signIn("client");
    assert.equal(await landing("/login"), "/");
    assert.equal(await landing("/admin/login"), "/");
  });

  it("asks for the second step when a factor is enrolled but not used yet", async () => {
    signIn("client");
    db.aal = enrolled;
    assert.equal(await landing("/portal/abc"), "/auth/mfa");
  });

  it("lets a verified user through", async () => {
    signIn("staff");
    db.aal = verified;
    assert.equal(await landing("/admin"), null);
  });

  it("makes staff enrol in two-step sign-in", async () => {
    signIn("staff");
    db.aal = noFactor;
    assert.equal(await landing("/admin"), "/auth/mfa?enroll=1");
  });

  it("makes admins enrol in two-step sign-in", async () => {
    signIn("admin");
    db.aal = noFactor;
    assert.equal(await landing("/admin/users"), "/auth/mfa?enroll=1");
  });

  it("does not force clients to enrol by default", async () => {
    signIn("client");
    db.aal = noFactor;
    assert.equal(await landing("/portal/abc"), null);
  });

  it("forces clients to enrol when REQUIRE_CLIENT_MFA is true", async () => {
    process.env.REQUIRE_CLIENT_MFA = "true";
    signIn("client");
    db.aal = noFactor;
    assert.equal(await landing("/portal/abc"), "/auth/mfa?enroll=1");
  });

  it("never loops on the two-step, sign-out or set-password pages", async () => {
    signIn("staff");
    db.aal = noFactor;
    assert.equal(await landing("/auth/mfa"), null);
    assert.equal(await landing("/auth/signout"), null);
    assert.equal(await landing("/auth/set-password"), null);
  });
});

describe("middleware config", () => {
  it("skips static files but covers pages and API routes", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    assert.ok(re.test("/admin"));
    assert.ok(re.test("/api/cron/digest"));
    assert.ok(!re.test("/_next/static/chunk.js"));
    assert.ok(!re.test("/brand/logo.svg"));
  });
});
