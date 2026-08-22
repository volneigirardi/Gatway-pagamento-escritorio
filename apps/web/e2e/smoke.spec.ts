import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home page renders and is navigable to about", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "SaaS Enterprise" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();

    await page.getByRole("link", { name: "About" }).click();

    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
    await expect(page).toHaveURL(/\/about$/);
  });

  test("has a skip-to-content link for keyboard users", async ({ page }) => {
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toHaveAttribute("href", "#main");
  });

  test("does not produce browser console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "SaaS Enterprise" }),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});
