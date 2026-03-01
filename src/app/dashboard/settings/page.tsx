import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordResetButton } from "@/components/features/settings/PasswordResetButton";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch usage stats
  const { count: totalVideos } = await supabase
    .from("videos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: completedVideos } = await supabase
    .from("videos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed");

  const email = user.email ?? "Unknown";
  const initial = email[0].toUpperCase();
  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
              {initial}
            </div>
            <div>
              <p className="font-medium">{email}</p>
              <p className="text-xs text-muted-foreground">
                Member since {memberSince}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Your project activity summary.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Total Projects
              </p>
              <p className="text-3xl font-bold">{totalVideos ?? 0}</p>
            </div>
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Completed
              </p>
              <p className="text-3xl font-bold text-green-600">
                {completedVideos ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Update your password or manage login options.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordResetButton email={email} />
        </CardContent>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Read-only account metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-xs">{user.id}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Email</span>
            <span>{email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auth provider</span>
            <span className="capitalize">
              {user.app_metadata?.provider ?? "email"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
