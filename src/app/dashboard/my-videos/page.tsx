import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VideoLibrary } from "@/components/features/video/VideoLibrary";

export default async function MyVideosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">My Videos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All your B-Roll projects in one place.
        </p>
      </div>

      <VideoLibrary videos={videos ?? []} />
    </div>
  );
}
