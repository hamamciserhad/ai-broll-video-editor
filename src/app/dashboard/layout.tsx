import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/features/auth/SignOutButton";
import { NavLink } from "@/components/features/nav/NavLink";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Videos", href: "/dashboard/my-videos" },
  { label: "Settings", href: "/dashboard/settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const email = user.email ?? "User";
  const initial = email[0].toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 border-r flex flex-col overflow-hidden">
        {/* Logo */}
        <div className="h-14 shrink-0 flex items-center px-6 border-b">
          <Link href="/dashboard" className="font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            B-Roll AI
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.label} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* User section */}
        <div className="border-t px-3 py-3">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors">
            <div className="h-8 w-8 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              {initial}
            </div>
            <span className="text-sm text-muted-foreground truncate flex-1">{email}</span>
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b flex items-center justify-end px-6">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            {initial}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
