import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { stagingEnabled, STATE_FILE, ADMIN_SESSION, type World } from "./support/env";

// First-time and recovery flows real people go through: invite links, password reset,
// first sign-in for new staff, and uploading documents. Staging only.
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
  const tag = randomUUID().slice(0, 6);
  const email = `e2e-${w.run}-${role}-${tag}@example.test`;
  const name = `E2E ${role} ${tag}`;
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
    full_name: name,
    role,
    client_id: role === "client" ? w.clientA.id : null,
  });
  return { email, password, name, id: data.user.id };
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
  /** Staff assigned to client A, so the dashboard proves the database gives them their rights. */
  async function assignedStaff() {
    const user = await makeUser("staff");
    await svc().from("staff_clients").insert({ user_id: user.id, client_id: world().clientA.id });
    return user;
  }

  async function landsOnDashboard(page: Page) {
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(page.getByLabel("6 digit code")).toHaveCount(0);
    await expect(page.getByText(world().clientA.name)).toBeVisible();
  }

  test("goes straight to the dashboard from the team sign-in page", async ({ page }) => {
    const user = await assignedStaff();
    await page.goto("/admin/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in to admin" }).click();
    await landsOnDashboard(page);
  });

  test("goes straight to the dashboard from the client sign-in page", async ({ page }) => {
    const user = await assignedStaff();
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await landsOnDashboard(page);
  });
});

test.describe("accounts an admin adds", () => {
  // The browser tests run the app with this starting password (playwright.config.ts).
  const STARTING = "E2e-starting-password-1";
  test.describe.configure({ timeout: 90_000 });

  async function signInWith(page: Page, email: string, password: string) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
  }

  async function chooseOwnPassword(page: Page) {
    await expect(page).toHaveURL(/\/auth\/set-password\?first=1/, { timeout: 15_000 });
    await expect(page.getByText("You signed in with the starting password")).toBeVisible();
    const mine = `Mine-${randomUUID()}`;
    await setPassword(page, mine);
    return mine;
  }

  test("admin adds a client login; first sign-in forces a new password; admin can reset it", async ({
    browser,
  }) => {
    const w = world();
    const email = `e2e-${w.run}-added-${randomUUID().slice(0, 6)}@example.test`;
    const admin = await browser.newPage({ storageState: ADMIN_SESSION });
    const access = `/admin/clients/${w.clientA.id}/access`;
    await admin.goto(access);
    await admin.getByRole("button", { name: "Add user" }).click();
    const addForm = admin.getByRole("dialog", { name: "Add a client login" });
    await addForm.getByLabel("Full name").fill("E2E Added");
    await addForm.getByLabel("Email").fill(email);
    await addForm.getByLabel(/Add anyway/).check();
    await addForm.getByRole("button", { name: "Add user" }).click();
    await expect(admin.getByText("User added.")).toBeVisible({ timeout: 15_000 });
    await expect(admin.getByRole("dialog"), "the pop-up closes after saving").toHaveCount(0);
    const { data } = await svc().from("profiles").select("id").eq("email", email).single();
    created.push(data!.id);

    const person = await browser.newPage();
    await signInWith(person, email, STARTING);
    const mine = await chooseOwnPassword(person);
    await expect(person).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`), { timeout: 15_000 });

    await signInWith(person, email, STARTING);
    await expect(person.getByText("That email or password is not correct.")).toBeVisible();
    await signInWith(person, email, mine);
    await expect(person).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`), { timeout: 15_000 });

    await admin.goto(access);
    await admin.getByRole("button", { name: "Edit E2E Added" }).click();
    await admin.getByRole("dialog", { name: "Edit E2E Added" }).getByRole("button", { name: "Reset password" }).click();
    await expect(admin.getByText("Password reset to the starting password.")).toBeVisible({ timeout: 15_000 });
    await signInWith(person, email, STARTING);
    await chooseOwnPassword(person);
  });

  test("an admin can change a person's name and email", async ({ browser }) => {
    const w = world();
    const user = await makeUser("client");
    const admin = await browser.newPage({ storageState: ADMIN_SESSION });
    await admin.goto(`/admin/clients/${w.clientA.id}/access`);
    await admin.getByRole("button", { name: `Edit ${user.name}` }).click();
    const edit = admin.getByRole("dialog");
    await expect(edit.getByLabel("Email")).toHaveValue(user.email);
    const renamed = user.email.replace("@", "-renamed@");
    await edit.getByLabel("Full name").fill("E2E Renamed");
    await edit.getByLabel("Email").fill(renamed);
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(admin.getByText("Details saved.")).toBeVisible({ timeout: 15_000 });
    await expect(admin.getByText("E2E Renamed", { exact: true })).toBeVisible();

    const person = await browser.newPage();
    await signInWith(person, renamed, user.password);
    await expect(person).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`), { timeout: 15_000 });
  });

  test("a client can change their own password from Account", async ({ page }) => {
    const w = world();
    const user = await makeUser("client");
    await signInWith(page, user.email, user.password);
    await expect(page).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`), { timeout: 15_000 });
    await page.goto(`/portal/${w.clientA.id}/account`);
    await page.getByRole("link", { name: "Change password" }).click();
    const fresh = `Fresh-${randomUUID()}`;
    await setPassword(page, fresh);
    await expect(page).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`), { timeout: 15_000 });
    await signInWith(page, user.email, fresh);
    await expect(page).toHaveURL(new RegExp(`/portal/${w.clientA.id}$`), { timeout: 15_000 });
  });
});

test.describe("team directory", () => {
  test.use({ storageState: ADMIN_SESSION });

  test("an admin adds a team member in the pop-up and switches them to inactive", async ({ page }) => {
    const w = world();
    const name = `E2E member ${w.run}-${randomUUID().slice(0, 4)}`;
    const email = `e2e-${w.run}-member-${randomUUID().slice(0, 4)}@example.test`;
    try {
      await page.goto("/admin/team");
      await page.getByRole("button", { name: "Add team member" }).click();
      const add = page.getByRole("dialog", { name: "Add a team member" });
      await add.getByRole("textbox", { name: "Name" }).fill(name);
      await add.getByRole("textbox", { name: "Email" }).fill(email);
      await add.getByRole("button", { name: "Add team member" }).click();
      await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await expect(page.getByRole("dialog"), "the pop-up closes after saving").toHaveCount(0);

      await page.getByRole("button", { name: `Edit ${name}` }).click();
      const edit = page.getByRole("dialog", { name: `Edit ${name}` });
      const active = edit.getByRole("switch", { name: /Active/ });
      await expect(active).toBeChecked();
      await edit.getByText("Active", { exact: true }).click();
      await expect(active).not.toBeChecked();
      await edit.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
      const row = page.locator("div.p-4").filter({ hasText: name });
      await expect(row.getByText("Inactive")).toBeVisible();
    } finally {
      await svc().from("team_members").delete().eq("email", email);
    }
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
