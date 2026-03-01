"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Invisible client component that calls router.refresh() every 5 s.
 * Mount only when the video is still pending/processing so the server
 * component re-fetches and re-renders with updated status.
 */
export function VideoPoller() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
