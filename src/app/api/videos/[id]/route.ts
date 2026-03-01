import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch to verify ownership and get output_url
  const { data: video } = await supabase
    .from("videos")
    .select("output_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!video) {
    return Response.json({ error: "Video not found" }, { status: 404 });
  }

  // Remove storage file if present
  if (video.output_url) {
    await supabase.storage.from("videos").remove([video.output_url]);
  }

  const { error } = await supabase.from("videos").delete().eq("id", id);

  if (error) {
    return Response.json({ error: "Failed to delete video" }, { status: 500 });
  }

  return Response.json({ success: true });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: video, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id) // belt-and-suspenders alongside RLS
    .single();

  if (error || !video) {
    return Response.json({ error: "Video not found" }, { status: 404 });
  }

  // Generate a short-lived signed URL for completed videos with an output
  let downloadUrl: string | null = null;
  if (video.status === "completed" && video.output_url) {
    const { data: signed } = await supabase.storage
      .from("videos")
      .createSignedUrl(video.output_url, SIGNED_URL_EXPIRY_SECONDS);
    downloadUrl = signed?.signedUrl ?? null;
  }

  return Response.json({ ...video, download_url: downloadUrl });
}
