import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../lib/links.ts";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    assert.equal(safeNext("/auth/set-password"), "/auth/set-password");
    assert.equal(safeNext("/portal/x?tab=1"), "/portal/x?tab=1");
  });

  it("refuses other sites and falls back", () => {
    for (const bad of ["//evil.test", "/\\\\evil.test", "https://evil.test", "", null, undefined])
      assert.equal(safeNext(bad), "/", String(bad));
    assert.equal(safeNext("https://evil.test", "/auth/set-password"), "/auth/set-password");
  });
});
