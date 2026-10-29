import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { stagingEnabled, STATE_FILE, CLIENT_SESSION, ADMIN_SESSION, type World } from "./support/env";

// Signed-in flows. Run only against a confirmed staging project (see README, "Browser tests").
test.skip(!stagingEnabled(), "needs a staging Supabase project");

const world = (): World => JSON.parse(readFileSync(STATE_FILE, "utf8"));

test.describe("client user", () => {
  test.use({ storageState: CLIENT_SESSION });

  test("sees their own portal", async ({ page }) => {
    const w = world();
    await page.goto(`/portal/${w.clientA.id}`);
    await expect(page.getByText(w.clientA.name).filter({ visible: true }).first()).toBeVisible();
  });

  test("cannot open another client's portal", async ({ page }) => {
    const w = world();
    const res = await page.goto(`/portal/${w.clientB.id}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByText(w.clientB.name)).toHaveCount(0);
  });

  test("cannot open the admin console", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test("sees published documents but not hidden ones", async ({ page }) => {
    const w = world();
    await page.goto(`/portal/${w.clientA.id}/documents`);
    await expect(page.getByText(w.docA.title)).toBeVisible();
    await expect(page.getByText(w.hiddenDocA.title)).toHaveCount(0);
  });

  test("gets a short-lived signed link for a published document", async ({ request }) => {
    const w = world();
    const res = await request.get(`/portal/${w.clientA.id}/documents/${w.docA.id}/download`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toContain("/storage/v1/object/sign/");
  });

  test("cannot download a hidden document", async ({ request }) => {
    const w = world();
    const res = await request.get(`/portal/${w.clientA.id}/documents/${w.hiddenDocA.id}/download`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(404);
  });

  test("cannot download a document through another client's address", async ({ request }) => {
    const w = world();
    const res = await request.get(`/portal/${w.clientB.id}/documents/${w.docA.id}/download`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(404);
  });

  test("can send a question and see it in the thread", async ({ page }) => {
    const w = world();
    const subject = `E2E question ${w.run}`;
    await page.goto(`/portal/${w.clientA.id}/queries`);
    await page.getByLabel("Subject").fill(subject);
    await page.getByLabel("Your question").fill("Is the browser test working?");
    await page.getByRole("button", { name: "Send question" }).click();
    // Several sequential Supabase round trips plus the redirected page load; 5s is too tight.
    await expect(page).toHaveURL(new RegExp(`/portal/${w.clientA.id}/queries/[0-9a-f-]{36}`), {
      timeout: 15_000,
    });
    await expect(page.getByText(subject).first()).toBeVisible();
  });
});

test.describe("admin user", () => {
  test.use({ storageState: ADMIN_SESSION });

  test("sees every client in the console", async ({ page }) => {
    const w = world();
    await page.goto("/admin");
    await expect(page.getByText(w.clientA.name)).toBeVisible();
    await expect(page.getByText(w.clientB.name)).toBeVisible();
  });

  test("can open a client's admin page", async ({ page }) => {
    const w = world();
    const res = await page.goto(`/admin/clients/${w.clientA.id}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText(w.clientA.name).first()).toBeVisible();
  });

  test("can read the audit log", async ({ page }) => {
    const res = await page.goto("/admin/audit");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/audit/);
  });
});

/** Opens a page and checks it loads with a main heading, sideways-scroll free, and no errors. */
async function loadsCleanly(page: Page, path: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const res = await page.goto(path);
  expect(res?.status(), path).toBe(200);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll, `${path} should not scroll sideways`).toBeLessThanOrEqual(width);
  expect(errors, path).toEqual([]);
}

const PORTAL_PAGES = ["", "/progress", "/updates", "/documents", "/queries", "/team", "/account"];
const ADMIN_CLIENT_PAGES = [
  "",
  "/progress",
  "/updates",
  "/meetings",
  "/documents",
  "/queries",
  "/team",
  "/access",
  "/history",
];
const ADMIN_PAGES = ["/admin", "/admin/audit", "/admin/team", "/admin/users", "/admin/clients/new"];

test.describe("every client page", () => {
  test.use({ storageState: CLIENT_SESSION });
  for (const p of PORTAL_PAGES)
    test(`portal${p || " overview"} loads`, async ({ page }) => {
      await loadsCleanly(page, `/portal/${world().clientA.id}${p}`);
    });

  test("admin pages send a client back to their own portal", async ({ page }) => {
    test.setTimeout(120_000);
    const w = world();
    for (const p of [...ADMIN_PAGES, ...ADMIN_CLIENT_PAGES.map((c) => `/admin/clients/${w.clientA.id}${c}`)]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`));
    }
  });
});

test.describe("every admin page", () => {
  test.use({ storageState: ADMIN_SESSION });
  for (const p of ADMIN_PAGES)
    test(`${p} loads`, async ({ page }) => {
      await loadsCleanly(page, p);
    });
  for (const p of ADMIN_CLIENT_PAGES)
    test(`client admin${p || " overview"} loads`, async ({ page }) => {
      await loadsCleanly(page, `/admin/clients/${world().clientA.id}${p}`);
    });
});
