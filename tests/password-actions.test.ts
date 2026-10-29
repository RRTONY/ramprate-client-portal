import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, table } from "./support/fake-supabase.ts";
import { redirectOf } from "./support/fake-next.ts";
import { signIn, form, freshWorld, restoreWorld, auditActions } from "./support/helpers.ts";
import { setOwnPassword } from "@/lib/password-actions";

beforeEach(() => {
  freshWorld();
});
afterEach(restoreWorld);

const change = (password: string, confirm = password) =>
  redirectOf(setOwnPassword(form({ password, confirm })));

describe("setOwnPassword", () => {
  it("changes only the signed-in person's password and clears the starting-password flag", async () => {
    const me = signIn("client", { profile: { must_change_password: true } });
    assert.equal(await change("My-own-password-1"), "/");
    assert.deepEqual(db.passwordChanges, ["My-own-password-1"]);
    assert.equal(table("profiles").find((p) => p.id === me.id)!.must_change_password, false);
    assert.deepEqual(auditActions(), ["auth.password_change"]);
  });

  it("refuses short, mismatched or starting passwords before changing anything", async () => {
    signIn("staff");
    assert.match(await change("short"), /error=short$/);
    assert.match(await change("Long-enough-1", "Different-1"), /error=match$/);
    assert.match(await change("Start-pass-2026"), /error=default$/);
    assert.deepEqual(db.passwordChanges, []);
  });

  it("keeps the flag when Supabase refuses the new password", async () => {
    const me = signIn("client", { profile: { must_change_password: true } });
    db.passwordChangeError = { message: "weak" };
    assert.match(await change("Rejected-pass-1"), /error=failed$/);
    assert.equal(table("profiles").find((p) => p.id === me.id)!.must_change_password, true);
  });

  it("sends signed-out visitors to sign in", async () => {
    assert.equal(await change("Long-enough-1"), "/login");
    assert.deepEqual(db.passwordChanges, []);
  });
});
