/**
 * Test 2 — Project creation flow
 *
 * Strategy: intercept POST /api/videos at the browser level so
 * processVideo() / FFmpeg never fires.  Inside the route handler (Node.js
 * context) we use the Supabase admin client to insert a real "pending"
 * record, so the Next.js server component can query it and render the
 * Pending badge.  The video is deleted in a finally block for clean-up.
 *
 * Covers:
 *  • Drive URL input accepts a valid Google Drive URL
 *  • Clicking "Generate B-Roll" submits POST /api/videos
 *  • A new row with a "Pending" status badge appears in Recent Videos
 *  • The badge is rendered correctly without triggering FFmpeg
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./helpers/auth";

const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";

// A syntactically valid Drive URL — the video itself doesn't need to exist
// because processVideo() is never called.
const MOCK_DRIVE_URL =
  "https://drive.google.com/file/d/e2e-test-mock-no-file/view?usp=sharing";

test.describe("Project creation flow", () => {
  test(
    "submit Drive URL → Pending badge appears in Recent Videos",
    async ({ page }) => {
      test.skip(
        !TEST_EMAIL || !TEST_PASSWORD,
        "PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD not set"
      );
      test.skip(
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          !process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Supabase env vars not set"
      );

      // ── Admin client — runs in Node.js (Playwright process), not browser ──
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Resolve the test user's UUID from their email
      const {
        data: { users },
      } = await adminSupabase.auth.admin.listUsers();
      const testUser = users.find((u) => u.email === TEST_EMAIL);
      if (!testUser) {
        throw new Error(
          `Test user "${TEST_EMAIL}" not found in Supabase. ` +
            "Create it via the Supabase dashboard → Authentication → Users."
        );
      }

      let insertedVideoId: string | null = null;

      try {
        await login(page, TEST_EMAIL, TEST_PASSWORD);

        // ── Route intercept: mock POST /api/videos ──────────────────────
        // We intercept the browser-side POST so the real Next.js handler
        // (and its after() background job) never runs.  We insert the DB
        // record ourselves so the server component can read it from Supabase.
        await page.route("**/api/videos", async (route) => {
          if (route.request().method() !== "POST") {
            // Let GET requests (VideoList polling) through to the real server
            await route.continue();
            return;
          }

          // Insert a pending video record via admin client
          const { data: video, error } = await adminSupabase
            .from("videos")
            .insert({
              user_id: testUser.id,
              source_url: MOCK_DRIVE_URL,
              status: "pending",
            })
            .select("id")
            .single();

          if (error || !video) {
            throw new Error(
              `Failed to insert test video: ${error?.message ?? "unknown"}`
            );
          }

          insertedVideoId = video.id;

          // Return the same shape the real POST handler returns
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ id: video.id }),
          });
        });

        // ── Fill form and submit ─────────────────────────────────────────
        await page.fill('input[type="url"]', MOCK_DRIVE_URL);
        await page.click('button:has-text("Generate B-Roll")');

        // After the mocked POST responds, VideoUrlInput calls router.refresh().
        // Next.js re-runs DashboardPage on the server, queries Supabase, and
        // finds the newly inserted pending record → VideoList renders the badge.
        await expect(page.getByText("Pending")).toBeVisible({
          timeout: 10_000,
        });

        // The input should have been cleared on success
        await expect(page.locator('input[type="url"]')).toHaveValue("");

        // The source URL should appear in the table
        await expect(page.getByText("e2e-test-mock-no-file")).toBeVisible();
      } finally {
        // Always clean up — remove the test row from the database
        if (insertedVideoId) {
          await adminSupabase
            .from("videos")
            .delete()
            .eq("id", insertedVideoId);
        }
      }
    }
  );
});
