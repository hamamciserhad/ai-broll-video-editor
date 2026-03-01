"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VideoStatusBadge } from "./VideoStatusBadge";
import { Button } from "@/components/ui/button";

type VideoItem = {
  id: string;
  source_url: string;
  status: string | null;
  created_at: string | null;
  output_url: string | null;
};

interface VideoListProps {
  initialVideos: VideoItem[];
}

export function VideoList({ initialVideos }: VideoListProps) {
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);

  // Sync state when the server re-renders with fresh data (e.g. after router.refresh())
  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  // Poll every 3 s while any video is still pending/processing
  useEffect(() => {
    const hasActive = videos.some(
      (v) => v.status === "pending" || v.status === "processing"
    );
    if (!hasActive) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch("/api/videos");
        if (res.ok) {
          const fresh: VideoItem[] = await res.json();
          setVideos(fresh);
        }
      } catch {
        // silent — polling is best-effort
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [videos]);

  if (videos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No videos yet. Paste a Google Drive link above to get started.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Source
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Created
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video) => (
            <tr
              key={video.id}
              className="border-b last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <a
                  href={video.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline block max-w-[280px] truncate"
                  title={video.source_url}
                >
                  {video.source_url.length > 55
                    ? video.source_url.slice(0, 55) + "…"
                    : video.source_url}
                </a>
              </td>
              <td className="px-4 py-3">
                <VideoStatusBadge status={video.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {video.created_at
                  ? new Date(video.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/videos/${video.id}`}>
                    {video.status === "completed" ? "View" : "Details"}
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
