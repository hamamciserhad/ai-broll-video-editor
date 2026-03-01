import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB guard

/**
 * Extracts the file ID from common Google Drive URL formats:
 *   https://drive.google.com/file/d/{id}/view
 *   https://drive.google.com/open?id={id}
 *   https://drive.google.com/uc?id={id}
 */
export function parseDriveFileId(url: string): string {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error(
    `Cannot extract file ID from Drive URL: ${url}. ` +
      "Share the file as 'Anyone with the link' and paste the share URL."
  );
}

/**
 * Downloads a publicly shared Google Drive file (anyone-with-link) to a
 * local path using the Drive API v3 media endpoint.
 *
 * Requires GOOGLE_DRIVE_API_KEY to be set and the file to be shared publicly.
 */
export async function downloadDriveFile(
  fileId: string,
  destPath: string
): Promise<void> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_DRIVE_API_KEY is not set");

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Drive download failed (${response.status}): ${response.statusText}. ` +
        "Make sure the file is shared as 'Anyone with the link'."
    );
  }

  // Guard against oversized files
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_BYTES) {
    throw new Error(
      `File exceeds the 500 MB size limit (${Math.round(parseInt(contentLength, 10) / 1024 / 1024)} MB).`
    );
  }

  if (!response.body) throw new Error("No response body from Drive API");

  const fileStream = createWriteStream(destPath);
  await pipeline(
    Readable.fromWeb(response.body as import("stream/web").ReadableStream),
    fileStream
  );
}
