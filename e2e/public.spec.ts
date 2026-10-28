import { test, expect, type Page } from "@playwright/test";

// Signed-out screens. These need no database and run on every `npm run test:e2e`.

const SOME_CLIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function noSideScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll, "page should not scroll sideways").toBeLessThanOrEqual(width);
}

/** Every visible form field must have a name a screen reader can announce. */
async function fieldsAreLabelled(page: Page) {
  const unlabelled = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input, select, textarea"))
      .filter((el) => (el as HTMLInputElement).type !== "hidden")
      .filter((el) => {
        const e = el as HTMLInputElement;
        const byLabel = e.labels && e.labels.length > 0;
        return !byLabel && !e.getAttribute("aria-label") && !e.getAttribute("placeholder");
      })
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(unlabelled).toEqual([]);
}

test.describe("signed-out visitors are sent to sign in", () => {
  for (const [from, to] of [
    ["/", "/login"],
    [`/portal/${SOME_CLIENT}`, "/login"],
    [`/portal/${SOME_CLIENT}/documents`, "/login"],
    ["/admin", "/admin/login"],
    [`/admin/clients/${SOME_CLIENT}`, "/admin/login"],
    ["/admin/audit", "/admin/login"],
  ]) {
    test(`${from} goes to ${to}`, async ({ page }) => {
      await page.goto(from);
      await expect(page).toHaveURL(to);
    });
  }

  test("a document link cannot be opened without signing in", async ({ request }) => {
    const res = await request.get(
      `/portal/${SOME_CLIENT}/documents/${SOME_CLIENT}/download`,
      { maxRedirects: 0 },
    );
    expect(res.status()).toBe(307);
    expect(res.headers().location).toContain("/login");
  });

  test("the weekly digest refuses calls without the secret", async ({ request }) => {
    expect((await request.get("/api/cron/digest")).status()).toBe(401);
    const wrong = await request.get("/api/cron/digest", {
      headers: { authorization: "Bearer wrong" },
    });
    expect(wrong.status()).toBe(401);
  });
});

test.describe("client sign-in page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows the sign-in form with labelled fields", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await fieldsAreLabelled(page);
  });

  test("will not submit with empty fields", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
    const valid = await page.getByLabel("Email").evaluate((e) => (e as HTMLInputElement).validity.valid);
    expect(valid).toBe(false);
  });

  test("shows a plain error when sign-in fails", async ({ page }) => {
    await page.getByLabel("Email").fill("nobody@example.test");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login?error=invalid");
    await expect(page.getByText("That email or password is not correct.")).toBeVisible();
  });

  test("password reset never reveals whether an account exists", async ({ page }) => {
    await page.getByText("Forgot your password?").click();
    await page.getByPlaceholder("you@company.com").fill("nobody@example.test");
    await page.getByRole("button", { name: "Send link" }).click();
    await expect(page).toHaveURL("/login?reset=1");
    await expect(page.getByText("If that email has an account, a reset link is on its way.")).toBeVisible();
  });

  for (const [code, message] of [
    ["invalid", "That email or password is not correct."],
    ["no-profile", "Your account is not set up yet."],
    ["no-client", "Your account is not linked to a client portal yet."],
    ["link", "That link has expired. Please request a new one."],
    ["anything-else", "Something went wrong."],
  ]) {
    test(`explains the "${code}" error`, async ({ page }) => {
      await page.goto(`/login?error=${code}`);
      await expect(page.getByText(message)).toBeVisible();
    });
  }

  test("links to the privacy page and the team sign-in", async ({ page }) => {
    await page.getByRole("link", { name: "Privacy and security" }).click();
    await expect(page).toHaveURL("/privacy");
    await page.goBack();
    await page.getByRole("link", { name: "RampRate team sign-in" }).click();
    await expect(page).toHaveURL("/admin/login");
  });
});

test.describe("team sign-in page", () => {
  test("shows the staff form and the two-step notice", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { level: 1, name: "Portal admin" })).toBeVisible();
    await expect(page.getByText("Two-step verification is required")).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await fieldsAreLabelled(page);
  });

  test("tells clients to use the client sign-in", async ({ page }) => {
    await page.goto("/admin/login?error=notstaff");
    await expect(page.getByText("This sign-in is for the RampRate team.")).toBeVisible();
    await page.getByRole("link", { name: "Back to client sign-in" }).click();
    await expect(page).toHaveURL("/login");
  });

  test("shows a plain error when sign-in fails", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Work email").fill("nobody@example.test");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in to admin" }).click();
    await expect(page).toHaveURL("/admin/login?error=invalid");
    await expect(page.getByText("That email or password is not correct.")).toBeVisible();
  });
});

test.describe("invite and reset links", () => {
  test("a link without a token shows the expired message", async ({ page }) => {
    await page.goto("/auth/confirm?type=invite");
    await expect(page).toHaveURL("/login?error=link");
    await expect(page.getByText("That link has expired.")).toBeVisible();
  });
});

test.describe("privacy page", () => {
  test("is public and readable", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy and security" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who can see it" })).toBeVisible();
  });
});

test.describe("every public page", () => {
  for (const path of ["/login", "/admin/login", "/privacy"]) {
    test(`${path}: one main heading, English, images described, no sideways scroll`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("h1")).toHaveCount(1);
      const missingAlt = await page.locator("img:not([alt])").count();
      expect(missingAlt).toBe(0);
      await noSideScroll(page);
    });

    test(`${path}: the first Tab reaches the skip link`, async ({ page }) => {
      await page.goto(path);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    });

    test(`${path}: shows no browser errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });
  }
});

test.describe("dark mode", () => {
  test("a saved dark choice is applied before the page shows", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass(/dark/);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe("rgb(255, 255, 255)");
  });

  test("light is the default", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
