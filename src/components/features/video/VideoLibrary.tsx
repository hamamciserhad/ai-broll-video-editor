"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

type FilterStatus = "all" | "pending" | "processing" | "completed" | "failed";

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

interface VideoLibraryProps {
  videos: VideoItem[];
}

export function VideoLibrary({ videos: initialVideos }: VideoLibraryProps) {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered =
    filter === "all"
      ? videos
      : filter === "processing"
        ? videos.filter(
            (v) => v.status === "processing" || v.status === "pending"
          )
        : videos.filter((v) => v.status === filter);

  async function handleDelete(id: string) {
    if (!confirm("Delete this video? This cannot be undone.")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== id));
        router.refresh();
      } else {
        alert("Failed to delete video. Please try again.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  // Stats derived from full (unfiltered) list
  const stats = {
    total: videos.length,
    completed: videos.filter((v) => v.status === "completed").length,
    processing: videos.filter(
      (v) => v.status === "processing" || v.status === "pending"
    ).length,
    failed: videos.filter((v) => v.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Completed", value: stats.completed, color: "text-green-600" },
          { label: "Processing", value: stats.processing, color: "text-yellow-600" },
          { label: "Failed", value: stats.failed, color: "text-red-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b pb-0">
        {FILTER_LABELS.map(({ value, label }) => {
          const isActive = filter === value;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {value === "all"
                  ? stats.total
                  : value === "processing"
                    ? stats.processing
                    : value === "completed"
                      ? stats.completed
                      : stats.failed}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No videos match this filter.
        </p>
      ) : (
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
              {filtered.map((video) => (
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
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/videos/${video.id}`}>
                          {video.status === "completed" ? "View" : "Details"}
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === video.id}
                        onClick={() => handleDelete(video.id)}
                      >
                        {deletingId === video.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
