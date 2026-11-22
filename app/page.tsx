import Link from "next/link";
import { session } from "@/lib/supabase/server";

const grad = ["from-emerald-600 to-teal-800", "from-sky-600 to-indigo-800", "from-amber-500 to-orange-700", "from-rose-600 to-fuchsia-800"];

export default async function Home() {
  const { supabase } = await session();
  const { data: ts } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-950 to-slate-950 animate-gradient p-8 text-white shadow-xl sm:p-14">
        <div className="animate-float absolute -right-6 -top-6 text-[14rem] leading-none opacity-15 sm:text-[18rem]">🏏</div>
        <span className="pill bg-amber-400 text-slate-900">LIVE AUCTIONS · FIXTURES · STANDINGS</span>
        <h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">Where cricket teams are built, <span className="text-amber-400">one bid at a time.</span></h1>
        <p className="mt-3 max-w-xl text-emerald-100">Register your team or yourself as a player, then watch the auction unfold live — bids, purses and squads update in real time.</p>
      </section>

      <section>
        <h2 className="section-title">Tournaments</h2>
        {!ts?.length && <div className="card text-center text-slate-500">No tournaments yet. The admin can create one after signing in.</div>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ts?.map((t, i) => (
            <Link key={t.id} href={`/t/${t.id}`} style={{ animationDelay: `${i * 70}ms` }} className="animate-fade-up group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              {t.banner_url /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={t.banner_url} alt="" className="h-36 w-full object-cover" />
                : <div className={`grid h-36 place-items-center bg-gradient-to-br ${grad[i % 4]} text-5xl`}>🏆</div>}
              <div className="p-4">
                <div className="flex items-center gap-2"><span className="pill bg-emerald-100 text-emerald-800">{t.format}</span><span className="pill capitalize">{t.status}</span></div>
                <div className="mt-2 text-lg font-bold group-hover:text-emerald-700">{t.name}</div>
                <div className="text-sm text-slate-500">📍 {t.location ?? "TBA"}{t.start_date && ` · ${t.start_date}`}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
