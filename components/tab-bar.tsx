"use client";

import { Dumbbell, Home, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/workout", label: "Workout", Icon: Dumbbell },
  { href: "/profile", label: "Profile", Icon: User },
] as const;

// Hidden during a live workout so a stray tap cannot leave it (a design decision, not copied from the original).
const HIDE_ON = ["/live", "/routine"];

export function TabBar() {
  const path = usePathname();
  if (HIDE_ON.some((p) => path === p || path.startsWith(p + "/"))) return null;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex h-tab-bar max-w-[480px]">
        {TABS.map(({ href, label, Icon }) => {
          const current = href === "/" ? path === "/" || path.startsWith("/history") : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={current ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-2xs ${current ? "text-accent" : "text-muted"}`}>
                <Icon size={24} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
