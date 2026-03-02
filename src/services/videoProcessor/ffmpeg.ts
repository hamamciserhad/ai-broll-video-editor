import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobeBin from "ffprobe-static";
import type { BRollCue } from "@/types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converts HH:MM:SS (or MM:SS or bare seconds) to a float number of seconds. */
export function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/** Runs an arbitrary FFmpeg or FFprobe command, resolves on exit code 0. */
function runCommand(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    proc.stdout.on("data", (d: Buffer) => stdout.push(d));
    proc.stderr.on("data", (d: Buffer) => stderr.push(d));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString());
      } else {
        reject(
          new Error(
            `FFmpeg exited with code ${code}:\n${Buffer.concat(stderr).toString()}`
          )
        );
      }
    });

    proc.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// FFprobe — get video metadata
// ---------------------------------------------------------------------------

type VideoInfo = {
  width: number;
  height: number;
  fps: number;
  duration: number;
};

/**
 * Returns width, height, fps, and duration for a video file.
 * Combines streams + format in a single ffprobe call.
 */
async function getVideoInfo(filePath: string): Promise<VideoInfo> {
  try {
    const out = await runCommand(ffprobeBin.path, [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      filePath,
    ]);
    const data = JSON.parse(out) as {
      streams: {
        codec_type: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
      }[];
      format: { duration?: string };
    };
    const vs = data.streams.find((s) => s.codec_type === "video");
    const [num, den] = (vs?.r_frame_rate ?? "30/1").split("/").map(Number);
    const fps = den > 0 ? num / den : 30;
    return {
      width: vs?.width ?? 1920,
      height: vs?.height ?? 1080,
      fps: Math.round(fps * 100) / 100,
      duration: parseFloat(data.format.duration ?? "0"),
    };
  } catch {
    return { width: 1920, height: 1080, fps: 30, duration: 0 };
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export type BRollItem = {
  cue: BRollCue;
  clipPath: string;
};

/**
 * Splices B-Roll clips into the main video at the timestamps specified by
 * Gemini cues using FFmpeg's `concat` filter.
 *
 * Strategy:
 *   1. Sort cues by start time.
 *   2. Build alternating segments: main[0,s0] → broll0 → main[e0,s1] → broll1 → … → main[eN,end]
 *   3. Trim + normalize each segment (fps, pixel format, dimensions).
 *   4. Concat all video segments; map original audio stream unchanged.
 *
 * Result: B-Roll genuinely replaces the corresponding section of the main
 * video while the speaker's audio plays continuously — identical to how
 * professional NLEs (Premiere, DaVinci) handle B-Roll editing.
 *
 * Production note: runs on a persistent server (VPS/container).
 * Vercel serverless + ffmpeg-static binary exceeds the 50 MB function limit.
 */
export async function overlayBRoll(
  mainPath: string,
  brollItems: BRollItem[],
  outputPath: string
): Promise<void> {
  if (!ffmpegPath) throw new Error("FFmpeg binary not found (ffmpeg-static)");
  if (!brollItems.length) throw new Error("No B-Roll items to overlay");

  // Drop any cue where end_time ≤ start_time (Gemini occasionally hallucinates
  // inverted timestamps; passing a negative trim duration to FFmpeg is fatal).
  const validItems = brollItems.filter(({ cue }) => {
    const valid = timestampToSeconds(cue.end_time) > timestampToSeconds(cue.start_time);
    if (!valid) {
      console.warn(
        `[ffmpeg] Dropping cue with non-positive window: ${cue.start_time}–${cue.end_time}`
      );
    }
    return valid;
  });
  if (!validItems.length) throw new Error("All B-Roll cues are invalid (end_time ≤ start_time)");

  // Get main video info and each B-Roll clip's info in parallel
  const [mainInfo, ...clipInfos] = await Promise.all([
    getVideoInfo(mainPath),
    ...validItems.map(({ clipPath }) => getVideoInfo(clipPath)),
  ]);

  const { width, height, fps: mainFps, duration: mainDuration } = mainInfo;

  // Normalise fps to main video rate; yuv420p ensures broad compatibility
  const normFilter = `fps=fps=${mainFps},format=yuv420p`;

  // Scale + letterbox B-Roll to match main video dimensions
  const scaleFilter =
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;

  // Sort cues by start time to guarantee correct concat order
  const sorted = validItems
    .map((item, originalIdx) => ({ item, originalIdx }))
    .sort(
      (a, b) =>
        timestampToSeconds(a.item.cue.start_time) -
        timestampToSeconds(b.item.cue.start_time)
    );

  // Plan the segment list: alternating main-video gaps and B-Roll clips.
  // Overlapping cues (start_time < previous end_time) are dropped — keeping
  // them would make the output video longer than the original audio, causing
  // the -t cap to silently chop the tail of the video.
  type MainSeg = { kind: "main"; start: number; end: number };
  type BRollSeg = { kind: "broll"; sortedIdx: number };
  const segments: (MainSeg | BRollSeg)[] = [];

  let cursor = 0;
  for (let i = 0; i < sorted.length; i++) {
    const startSec = timestampToSeconds(sorted[i].item.cue.start_time);
    const endSec = timestampToSeconds(sorted[i].item.cue.end_time);
    if (startSec < cursor - 0.01) {
      console.warn(
        `[ffmpeg] Dropping overlapping cue at ${sorted[i].item.cue.start_time} ` +
          `(previous cue ends at ${cursor.toFixed(3)}s)`
      );
      continue;
    }
    if (startSec > cursor + 0.01) {
      segments.push({ kind: "main", start: cursor, end: startSec });
    }
    segments.push({ kind: "broll", sortedIdx: i });
    cursor = endSec;
  }
  if (mainDuration > cursor + 0.01) {
    segments.push({ kind: "main", start: cursor, end: mainDuration });
  }

  // Build FFmpeg args: main first, then each B-Roll clip in sorted order
  const args: string[] = ["-y", "-i", mainPath];
  for (const { item } of sorted) {
    args.push("-i", item.clipPath);
  }

  // Build filter_complex
  // Each segment gets a unique label [s0], [s1], ... for the final concat.
  // Main segments reference [0:v] (FFmpeg allows multiple reads of the same
  // input in filter_complex; no explicit split needed).
  const filterParts: string[] = [];
  const concatLabels: string[] = [];

  segments.forEach((seg, i) => {
    const label = `s${i}`;

    if (seg.kind === "main") {
      filterParts.push(
        `[0:v]trim=${seg.start.toFixed(3)}:${seg.end.toFixed(3)},` +
          `setpts=PTS-STARTPTS,${normFilter}[${label}]`
      );
    } else {
      const { sortedIdx } = seg;
      const { item } = sorted[sortedIdx];
      const clipInfo = clipInfos[sorted[sortedIdx].originalIdx];

      const windowDur =
        timestampToSeconds(item.cue.end_time) -
        timestampToSeconds(item.cue.start_time);
      const useDur = Math.min(clipInfo.duration || windowDur, windowDur);
      const shortfall = windowDur - useDur;

      // B-Roll inputs are indexed 1, 2, ... in sorted order
      const inputIdx = sortedIdx + 1;

      let f =
        `[${inputIdx}:v]trim=0:${useDur.toFixed(3)},setpts=PTS-STARTPTS`;
      if (shortfall > 0.02) {
        // Freeze-frame the last frame to fill the gap if clip is too short
        f += `,tpad=stop_mode=clone:stop_duration=${shortfall.toFixed(3)}`;
      }
      f += `,${scaleFilter},${normFilter}[${label}]`;
      filterParts.push(f);
    }

    concatLabels.push(`[${label}]`);
  });

  // Concat all video segments; audio comes from the original stream unmolested
  filterParts.push(
    `${concatLabels.join("")}concat=n=${segments.length}:v=1:a=0[vout]`
  );

  args.push(
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[vout]",
    "-map",
    "0:a",
    "-c:a",
    "copy",
    // Cap at main duration to absorb any floating-point rounding drift
    ...(mainDuration > 0 ? ["-t", mainDuration.toFixed(3)] : []),
    "-movflags",
    "+faststart",
    outputPath
  );

  await runCommand(ffmpegPath, args);
}
