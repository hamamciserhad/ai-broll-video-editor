import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VideoUrlInput } from "@/components/features/video/VideoUrlInput";
import { VideoList } from "@/components/features/video/VideoList";

export default async function DashboardPage() {
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
    <div className="space-y-8 max-w-5xl">
      {/* Generate card */}
      <Card>
        <CardHeader>
          <CardTitle>Generate B-Roll</CardTitle>
          <CardDescription>
            Paste a public Google Drive video link. Gemini analyzes the content
            and FFmpeg automatically splices in relevant B-Roll clips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VideoUrlInput />
        </CardContent>
      </Card>

      {/* Recent projects */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Videos</h2>
        <VideoList initialVideos={videos ?? []} />
      </div>
    </div>
  );
}
