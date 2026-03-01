import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        AI-Powered B-Roll Editor
      </h1>
      <p className="max-w-md text-muted-foreground">
        Paste a Google Drive link to your talking-head video. Gemini analyzes
        it, FFmpeg splices in B-Roll. Done.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/signup">Get started</Link>
        </Button>
      </div>
    </main>
  );
}
