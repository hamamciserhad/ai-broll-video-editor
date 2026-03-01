"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function PasswordResetButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );

  async function handleReset() {
    setState("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <p className="text-sm text-green-600">
        Password reset email sent — check your inbox.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={handleReset}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Sending…" : "Send password reset email"}
      </Button>
      {state === "error" && (
        <p className="text-xs text-destructive">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
