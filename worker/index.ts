/**
 * Railway polling worker
 *
 * Runs as a persistent Node.js process on Railway.
 * Every POLL_INTERVAL_MS it queries Supabase for the oldest pending video,
 * claims it (status → "processing"), and runs the full processVideo() pipeline.
 *
 * Only a single Railway instance should run this worker to avoid two instances
 * picking up the same video simultaneously.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { processVideo } from "@/services/videoProcessor/analyze";

const POLL_INTERVAL_MS = 15_000; // 15 seconds

async function pollAndProcess(): Promise<void> {
  const supabase = createAdminClient();

  // Pick the oldest pending video. maybeSingle() returns null (not an error)
  // when no rows match, unlike single() which throws on 0 rows.
  const { data: video, error } = await supabase
    .from("videos")
    .select("id, source_url")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[worker] Supabase query error:", error.message);
    return;
  }

  if (!video) return; // nothing pending — wait for next poll

  console.log(`[worker] picked up video ${video.id}`);

  try {
    await processVideo(video.id, video.source_url);
    console.log(`[worker] completed ${video.id}`);
  } catch (err) {
    // processVideo() already marks status → "failed" internally; this catch is
    // a safety net in case the error escapes before that update runs.
    console.error(`[worker] unhandled error for ${video.id}:`, err);
  }
}

async function main(): Promise<void> {
  console.log(
    `[worker] started — polling every ${POLL_INTERVAL_MS / 1000}s`,
    new Date().toISOString()
  );

  // Validate required env vars before entering the loop
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_DRIVE_API_KEY",
    "PEXELS_API_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("[worker] Missing required env vars:", missing.join(", "));
    process.exit(1);
  }

  for (;;) {
    await pollAndProcess().catch((err) =>
      console.error("[worker] poll cycle error:", err)
    );
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
