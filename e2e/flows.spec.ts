import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { stagingEnabled, STATE_FILE, ADMIN_SESSION, type World } from "./support/env";
import { totp, nextTotpWindow } from "./support/totp";

// First-time and recovery flows real people go through: invite links, password reset,
// two-step setup for new staff, and uploading documents. Staging only.
test.skip(!stagingEnabled(), "needs a staging Supabase project");

const world = (): World => JSON.parse(readFileSync(STATE_FILE, "utf8"));
const svc = () =>
  createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const created: string[] = [];
test.afterAll(async () => {
  for (const id of created) await svc().auth.admin.deleteUser(id);
});

async function makeUser(role: "client" | "staff", opts: { invited?: boolean } = {}) {
  const w = world();
  const email = `e2e-${w.run}-${role}-${randomUUID().slice(0, 6)}@example.test`;
  const password = `E2e-${randomUUID()}`;
  const db = svc();
  const { data, error } = opts.invited
    ? await db.auth.admin.generateLink({ type: "invite", email })
    : await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("no user");
  created.push(data.user.id);
  await db.from("profiles").upsert({
    id: data.user.id,
    email,
    full_name: `E2E ${role}`,
    role,
    client_id: role === "client" ? w.clientA.id : null,
  });
  return { email, password, id: data.user.id };
}

/**
 * The link in the email, built the way our custom template does ("custom") or the way Supabase's
 * default template does ("default"). Each call makes a fresh one-time link.
 */
async function emailLink(
  kind: "custom" | "default",
  type: "invite" | "recovery",
  email: string,
  baseURL: string,
) {
  const { data, error } = await svc().auth.admin.generateLink({
    type,
    email,
    options: { redirectTo: `${baseURL}/auth/confirm?next=/auth/set-password` },
  } as Parameters<ReturnType<typeof svc>["auth"]["admin"]["generateLink"]>[0]);
  if (error) throw error;
  if (kind === "custom")
    return `${baseURL}/auth/confirm?token_hash=${data.properties.hashed_token}&type=${type}&next=/auth/set-password`;
  // The default template goes to Supabase first, which redirects back with the session in the
  // #fragment, to our address or, if it is not on the allowed list, the Site URL. Follow that
  // hop and keep its path, query and fragment, on this test server.
  const res = await fetch(data.properties.action_link, { redirect: "manual" });
  const back = new URL(res.headers.get("location")!);
  return `${baseURL}${back.pathname}${back.search}${back.hash}`;
}

async function setPassword(page: Page, password: string) {
  await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Save and continue" }).click();
}

test.describe("invite links", () => {
  for (const kind of ["custom", "default"] as const) {
    test(`a new client can accept an invite (${kind} email template)`, async ({ page, baseURL }) => {
      const w = world();
      const user = await makeUser("client", { invited: true });
      await page.goto(await emailLink(kind, "invite", user.email, baseURL!));
      await setPassword(page, `New-${randomUUID()}`);
      await expect(page).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`), { timeout: 15_000 });
    });
  }

  test("an expired link from the default template says so plainly", async ({ page }) => {
    await page.goto("/auth/confirm?next=/auth/set-password#error=access_denied&error_code=otp_expired");
    await expect(page.getByRole("alert").filter({ hasText: "expired or was already used" })).toBeVisible();
  });

  test("an expired link that lands on the home page is still explained", async ({ page }) => {
    await page.goto("/#error=access_denied&error_code=otp_expired");
    await expect(page.getByRole("alert").filter({ hasText: "expired or was already used" })).toBeVisible();
  });

  test("a used or broken link says so plainly", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=not-a-real-token&type=invite&next=/auth/set-password");
    await expect(page).toHaveURL(/\/login\?error=link/);
    await expect(page.getByText("That link has expired")).toBeVisible();
  });
});

test.describe("password reset", () => {
  for (const kind of ["custom", "default"] as const) {
    test(`a client can reset their password and sign in with it (${kind} email template)`, async ({
      page,
      baseURL,
    }) => {
      const w = world();
      const user = await makeUser("client");
      await page.goto(await emailLink(kind, "recovery", user.email, baseURL!));
      const fresh = `Reset-${randomUUID()}`;
      await setPassword(page, fresh);
      await expect(page).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`), { timeout: 15_000 });

      await page.context().clearCookies();
      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(fresh);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`), { timeout: 15_000 });
    });
  }
});

test.describe("new staff member", () => {
  // Waits up to 30 seconds for a fresh authenticator code.
  test.describe.configure({ timeout: 75_000 });

  async function enrolAndContinue(page: Page) {
    const key = page.getByText(/^[A-Z2-7]{16,}$/);
    await expect(key).toBeVisible({ timeout: 15_000 });
    const secret = (await key.textContent())!.trim();
    await nextTotpWindow();
    await page.getByLabel("6 digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Turn on and continue" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(page.getByLabel("6 digit code")).toHaveCount(0);
  }

  test("sets up two-step sign-in on first sign-in from the team page", async ({ page }) => {
    const user = await makeUser("staff");
    await page.goto("/admin/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in to admin" }).click();
    await enrolAndContinue(page);
  });

  test("is also taken to two-step setup from the client sign-in page", async ({ page }) => {
    const user = await makeUser("staff");
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await enrolAndContinue(page);
  });
});

test.describe("document upload", () => {
  test.use({ storageState: ADMIN_SESSION });

  for (const name of ["Signed MSA.pdf", "Contract (final) v2 é.pdf"]) {
    test(`an admin can upload "${name}" and the client sees it`, async ({ page }) => {
      const w = world();
      const title = `E2E upload ${randomUUID().slice(0, 6)}`;
      await page.goto(`/admin/clients/${w.clientA.id}/documents`);
      await page.getByLabel("Title").fill(title);
      await page.getByLabel("File (max 25 MB)").setInputFiles({
        name,
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 e2e test file"),
      });
      // Never email anyone from tests.
      await page.getByLabel(/Email the client/).uncheck();
      await page.getByRole("button", { name: "Upload" }).click();
      await expect(page.getByText("Document uploaded.")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(title)).toBeVisible();

      const { data } = await svc().from("documents").select("id").eq("title", title);
      expect(data).toHaveLength(1);
    });
  }

  test("the upload form says when no file was chosen", async ({ page }) => {
    const w = world();
    await page.goto(`/admin/clients/${w.clientA.id}/documents`);
    await page.getByLabel("File (max 25 MB)").evaluate((el) => el.removeAttribute("required"));
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choose a file" })).toBeVisible();
  });
});
