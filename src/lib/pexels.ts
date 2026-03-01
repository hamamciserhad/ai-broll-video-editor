import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const PEXELS_API_BASE = "https://api.pexels.com/videos/search";

type PexelsVideoFile = {
  id: number;
  quality: string; // "hd" | "sd" | "uhd"
  file_type: string;
  width: number | null;
  height: number | null;
  link: string;
};

type PexelsVideo = {
  id: number;
  duration: number;
  video_files: PexelsVideoFile[];
};

type PexelsSearchResponse = {
  total_results: number;
  videos: PexelsVideo[];
};

/**
 * Picks the best MP4 file from a Pexels video:
 * prefers HD (≥1280px wide), falls back to any available file.
 */
function pickBestFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  const mp4Files = files.filter((f) => f.file_type === "video/mp4");
  if (!mp4Files.length) return null;

  const hd = mp4Files.find((f) => f.quality === "hd" && (f.width ?? 0) >= 1280);
  return hd ?? mp4Files[0];
}

/**
 * Searches Pexels for a short landscape video matching `query`,
 * downloads the best result to `destPath`.
 *
 * @param query       Short keyword string (3–5 words work best with Pexels)
 * @param destPath    Destination file path for the downloaded clip
 * @param usedIds     Set of Pexels video IDs already used — skips duplicates
 * @param pageOffset  Page index (0-based) — rotates search results per cue
 *
 * Returns `true` if a clip was downloaded, `false` if none found or key missing.
 */
export async function searchAndDownloadBRoll(
  query: string,
  destPath: string,
  usedIds: Set<number> = new Set(),
  pageOffset = 0
): Promise<boolean> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("PEXELS_API_KEY not set — skipping B-Roll download");
    return false;
  }

  const url = new URL(PEXELS_API_BASE);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "5");
  url.searchParams.set("orientation", "landscape");
  // page is 1-based; rotate by cue index so each cue draws from a different
  // slice of results even when queries are similar
  url.searchParams.set("page", String(pageOffset + 1));

  const searchRes = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!searchRes.ok) {
    console.warn(`Pexels search failed (${searchRes.status}) for: ${query}`);
    return false;
  }

  const data = (await searchRes.json()) as PexelsSearchResponse;

  if (!data.videos?.length) {
    console.warn(`No Pexels results for: "${query}"`);
    return false;
  }

  // Pick the first video that has a usable file AND hasn't been used before
  for (const video of data.videos) {
    if (usedIds.has(video.id)) continue;

    const file = pickBestFile(video.video_files);
    if (!file) continue;

    const dlRes = await fetch(file.link);
    if (!dlRes.ok || !dlRes.body) continue;

    const fileStream = createWriteStream(destPath);
    await pipeline(
      Readable.fromWeb(dlRes.body as import("stream/web").ReadableStream),
      fileStream
    );
    usedIds.add(video.id);
    return true;
  }

  console.warn(`Could not download any unique Pexels clip for: "${query}"`);
  return false;
}
