"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Thin gold bar under the header: starts on any internal link click, ends when the route changes.
export default function TopProgress() {
  const [from, setFrom] = useState<string | null>(null);
  const path = usePathname(); const sp = useSearchParams().toString();
  const key = path + "?" + sp; // bar shows while the route is still the one we clicked away from
  useEffect(() => {
    const on = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (a && a.href.startsWith(location.origin) && !a.target && !e.metaKey && !e.ctrlKey && a.href !== location.href) setFrom(location.pathname + "?" + location.search.slice(1));
    };
    document.addEventListener("click", on);
    return () => document.removeEventListener("click", on);
  }, []);
  return from === key ? <div className="nav-bar fixed left-0 top-0 z-50 h-1 bg-amber-400 shadow-[0_0_8px_#fbbf24]" /> : null;
}
