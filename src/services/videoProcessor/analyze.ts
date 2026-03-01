import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDriveFileId, downloadDriveFile } from "@/lib/drive";
import { uploadVideoToGemini, analyzeVideoForBRoll } from "@/lib/gemini";
import { searchAndDownloadBRoll } from "@/lib/pexels";
import { overlayBRoll, type BRollItem } from "./ffmpeg";

/**
 * Full processing pipeline for a video record:
 *
 *   pending → processing
 *     1. Download main video from Google Drive
 *     2. Upload to Gemini File API → analyze for B-Roll cues
 *     3. Fetch a stock clip for each cue from Pexels
 *     4. FFmpeg: overlay B-Roll clips at cue timestamps
 *     5. Upload rendered video to Supabase Storage
 *   → completed (output_url set) | failed (error in metadata)
 *
 * Production note: runs on a persistent server (VPS/container) triggered via
 * after() from the API route. For Vercel deployments, replace after() with
 * an Inngest event or QStash message to avoid function timeout limits.
 */
export async function processVideo(
  videoId: string,
  sourceUrl: string
): Promise<void> {
  const supabase = createAdminClient();

  // Collect all temp paths for cleanup in finally block
  const tempFiles: string[] = [];

  const mainPath = join(tmpdir(), `broll-main-${videoId}.mp4`);
  const outputPath = join(tmpdir(), `broll-out-${videoId}.mp4`);
  tempFiles.push(mainPath, outputPath);

  try {
    // ── Step 1: mark as processing ──────────────────────────────────────
    const { data: videoRecord } = await supabase
      .from("videos")
      .update({ status: "processing" })
      .eq("id", videoId)
      .select("user_id")
      .single();

    const userId = videoRecord?.user_id;
    if (!userId) throw new Error("Video record not found or missing user_id");

    // ── Step 2: download from Google Drive ──────────────────────────────
    const fileId = parseDriveFileId(sourceUrl);
    await downloadDriveFile(fileId, mainPath);

    // ── Step 3: Gemini analysis ──────────────────────────────────────────
    const fileUri = await uploadVideoToGemini(mainPath);
    const metadata = await analyzeVideoForBRoll(fileUri);

    // ── Step 4: fetch Pexels B-Roll clips ───────────────────────────────
    const brollItems: BRollItem[] = [];
    // Track used Pexels video IDs across cues to avoid downloading the same
    // clip twice (can happen when Gemini generates similar descriptions)
    const usedPexelsIds = new Set<number>();

    for (let i = 0; i < metadata.b_roll_cues.length; i++) {
      const cue = metadata.b_roll_cues[i];
      const clipPath = join(tmpdir(), `broll-clip-${videoId}-${i}.mp4`);
      tempFiles.push(clipPath);

      // Use Gemini's purpose-built Pexels keyword (2-4 words, stock-optimised)
      // instead of truncating the verbose visual_description
      const keyword = cue.pexels_keyword;

      const downloaded = await searchAndDownloadBRoll(
        keyword,
        clipPath,
        usedPexelsIds,
        i // page offset rotates results so each cue draws from a different slice
      );
      if (downloaded) {
        brollItems.push({ cue, clipPath });
      }
    }

    // ── Step 5: FFmpeg overlay ───────────────────────────────────────────
    let outputUrl: string | null = null;

    if (brollItems.length > 0) {
      await overlayBRoll(mainPath, brollItems, outputPath);

      // ── Step 6: upload to Supabase Storage ────────────────────────────
      const fileBuffer = await readFile(outputPath);
      const storagePath = `${userId}/${videoId}/output.mp4`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(storagePath, fileBuffer, {
          contentType: "video/mp4",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Store the path — the GET route converts it to a signed URL on demand
      outputUrl = storagePath;
    } else {
      console.warn(
        `[${videoId}] No B-Roll clips downloaded — skipping FFmpeg. ` +
          "Gemini metadata is still saved."
      );
    }

    // ── Step 7: mark completed ───────────────────────────────────────────
    await supabase
      .from("videos")
      .update({ status: "completed", metadata, output_url: outputUrl })
      .eq("id", videoId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[processVideo:${videoId}] failed:`, message);

    await supabase
      .from("videos")
      .update({
        status: "failed",
        metadata: { b_roll_cues: [], error: message },
      })
      .eq("id", videoId);
  } finally {
    // Best-effort cleanup of all temp files
    await Promise.all(tempFiles.map((f) => unlink(f).catch(() => undefined)));
  }
}
