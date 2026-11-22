import SubmitButton from "@/components/SubmitButton";
import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import "./globals.css";
import { session } from "@/lib/supabase/server";
import { signOut } from "./actions";

const font = Geist({ subsets: ["latin"], variable: "--font-sans" });
export const metadata: Metadata = { title: "CricAuction — Tournaments & Live Player Auctions", description: "Run cricket tournaments with a live IPL-style player auction." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, name } = await session();
  const { count: unread } = user ? await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false) : { count: 0 };
  return (
    <html lang="en" className={font.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 text-white backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="flex items-center gap-2 text-base font-extrabold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-400 text-lg text-slate-900">🏏</span>
              Cric<span className="text-amber-400">Auction</span>
            </Link>
            <span className="ml-auto" />
            {user ? (<>
              <Link href="/tournaments/new" className="text-slate-300 hover:text-white">+ New tournament</Link>
              <Link href="/notifications" className="relative text-slate-300 hover:text-white">🔔
                {!!unread && <b className="absolute -right-3 -top-2 rounded-full bg-red-600 px-1.5 text-[10px]">{unread}</b>}</Link>
              <form action={signOut} className="flex items-center gap-3">
                <span className="hidden text-slate-400 sm:inline">{name ?? "Admin"}</span>
                <SubmitButton className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10">Sign out</SubmitButton>
              </form>
            </>) : <Link href="/login" className="rounded-lg border border-white/20 px-3 py-1.5 text-slate-300 hover:bg-white/10">Admin login</Link>}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="py-8 text-center text-xs text-slate-400">CricAuction · live cricket auctions &amp; tournaments</footer>
      </body>
    </html>
  );
}
