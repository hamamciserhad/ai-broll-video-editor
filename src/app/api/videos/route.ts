import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createVideoSchema = z.object({
  source_url: z
    .string()
    .url("Must be a valid URL")
    .refine(
      (url) => url.includes("drive.google.com"),
      "Must be a Google Drive URL"
    ),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createVideoSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: video, error } = await supabase
    .from("videos")
    .insert({ user_id: user.id, source_url: parsed.data.source_url })
    .select()
    .single();

  if (error || !video) {
    return Response.json({ error: "Failed to create video record" }, { status: 500 });
  }

  // Processing is handled by the Railway worker, which polls for pending videos.
  return Response.json({ id: video.id }, { status: 201 });
}

export async function GET(_request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: videos, error } = await supabase
    .from("videos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(videos ?? []);
}
