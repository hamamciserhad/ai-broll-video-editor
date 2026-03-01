"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  label: string;
}

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {label}
    </Link>
  );
}
