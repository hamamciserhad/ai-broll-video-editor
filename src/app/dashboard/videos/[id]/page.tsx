import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VideoStatusBadge } from "@/components/features/video/VideoStatusBadge";
import { VideoPoller } from "@/components/features/video/VideoPoller";
import type { GeminiMetadata } from "@/types/database";

const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: video, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !video) notFound();

  // Generate a signed URL for completed videos
  let downloadUrl: string | null = null;
  if (video.status === "completed" && video.output_url) {
    const { data: signed } = await supabase.storage
      .from("videos")
      .createSignedUrl(video.output_url, SIGNED_URL_EXPIRY);
    downloadUrl = signed?.signedUrl ?? null;
  }

  const isActive =
    video.status === "pending" || video.status === "processing";
  const metadata = video.metadata as GeminiMetadata | null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Auto-refresh while still processing */}
      {isActive && <VideoPoller />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">← Back</Link>
        </Button>
        <h1 className="text-xl font-bold">Video Result</h1>
        <VideoStatusBadge status={video.status} />
      </div>

      {/* Source link */}
      <p className="text-sm text-muted-foreground">
        Source:{" "}
        <a
          href={video.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {video.source_url}
        </a>
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Output video ────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Output Video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {downloadUrl ? (
              <>
                <video
                  src={downloadUrl}
                  controls
                  className="w-full rounded-md bg-black"
                />
                <a
                  href={downloadUrl}
                  download={`broll-output-${id}.mp4`}
                  className="inline-block text-sm text-blue-600 hover:underline"
                >
                  Download MP4
                </a>
              </>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                {video.status === "processing"
                  ? "Processing… page refreshes automatically."
                  : video.status === "pending"
                    ? "Queued for processing."
                    : video.status === "failed"
                      ? "Processing failed — see error details."
                      : "No output video available."}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Right: Gemini JSON panel ─────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Editing Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            {metadata?.error ? (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {metadata.error}
              </div>
            ) : metadata?.b_roll_cues?.length ? (
              <div className="space-y-3">
                {metadata.b_roll_cues.map((cue, i) => (
                  <div
                    key={i}
                    className="rounded-md border p-3 text-sm space-y-1.5"
                  >
                    <div className="font-mono text-xs text-muted-foreground font-medium">
                      {cue.start_time} → {cue.end_time}
                    </div>
                    <p className="font-medium leading-snug">
                      {cue.visual_description}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {cue.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? "Analysis is still running…"
                  : "No B-Roll cues were generated."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
