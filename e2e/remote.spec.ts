import { expect, test } from "@playwright/test";

test("signed out: every page sends you to the sign-in screen, which has no tab bar", async ({ page }) => {
  for (const path of ["/", "/workout", "/profile", "/live", "/routine/new"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { name: "Lift Log" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
});

test("sign-in form: switches to sign-up, checks password length, and shows a server problem instead of freezing", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("me@example.com");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Can't reach the server")).toBeVisible(); // an error, not a hang
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("at least 8 characters")).toBeVisible();
});
