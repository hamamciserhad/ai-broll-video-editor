import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Log in via the /login form and wait for the redirect to /dashboard.
 * Throws if the dashboard is not reached within the default timeout.
 */
export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/dashboard");
}
