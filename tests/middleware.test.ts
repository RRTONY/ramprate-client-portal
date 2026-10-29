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

  it("never asks anyone for a two-step code, even with an authenticator set up", async () => {
    for (const role of ["client", "staff", "admin"] as const) {
      signIn(role);
      for (const aal of [enrolled, noFactor]) {
        db.aal = aal;
        assert.equal(await landing(role === "client" ? "/portal/abc" : "/admin"), null);
      }
    }
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
