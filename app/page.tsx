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

      <section className="grid gap-5 md:grid-cols-2">
        {[
          { kind: "player", icon: "🏏", title: "Player Registration", text: "Create your player profile, share your stats and get into the auction pool.", cta: "Register as player", tone: "from-amber-400 to-orange-500 text-slate-900", btn: "bg-slate-900 text-white hover:bg-slate-800" },
          { kind: "team", icon: "🛡️", title: "Team Registration", text: "Register your franchise, get a private bidding link and build your squad live.", cta: "Register your team", tone: "from-emerald-500 to-teal-700 text-white", btn: "bg-white text-emerald-800 hover:bg-emerald-50" },
        ].map((b, i) => (
          <div key={b.kind} style={{ animationDelay: `${i * 100}ms` }} className={`animate-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br ${b.tone} p-7 shadow-lg`}>
            <div className="animate-float absolute -right-3 -top-3 text-8xl opacity-25">{b.icon}</div>
            <h2 className="text-2xl font-black tracking-tight">{b.title}</h2>
            <p className="mt-1 max-w-sm text-sm opacity-90">{b.text}</p>
            {!ts?.length ? <p className="mt-5 text-sm font-semibold opacity-80">Opens when a tournament is created.</p>
              : ts.length === 1 ? <Link href={`/t/${ts[0].id}/register-${b.kind}`} className={`mt-5 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold shadow transition ${b.btn}`}>{b.cta} →</Link>
              : <div className="mt-5 flex flex-wrap gap-2">{ts.map((t) => <Link key={t.id} href={`/t/${t.id}/register-${b.kind}`} className={`rounded-xl px-4 py-2 text-sm font-bold shadow transition ${b.btn}`}>{t.name} →</Link>)}</div>}
          </div>))}
      </section>

      <section>
        <h2 className="section-title">Tournaments</h2>
        {!ts?.length && <div className="card text-center text-slate-500">No tournaments yet. The admin can create one after signing in.</div>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ts?.map((t, i) => (
            <div key={t.id} style={{ animationDelay: `${i * 70}ms` }} className="animate-fade-up group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <Link href={`/t/${t.id}`} className="block">
              {t.banner_url /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={t.banner_url} alt="" className="h-36 w-full object-cover" />
                : <div className={`grid h-36 place-items-center bg-gradient-to-br ${grad[i % 4]} text-5xl`}>🏆</div>}
              <div className="p-4">
                <div className="flex items-center gap-2"><span className="pill bg-emerald-100 text-emerald-800">{t.format}</span><span className="pill capitalize">{t.status}</span></div>
                <div className="mt-2 text-lg font-bold group-hover:text-emerald-700">{t.name}</div>
                <div className="text-sm text-slate-500">📍 {t.location ?? "TBA"}{t.start_date && ` · ${t.start_date}`}</div>
              </div></Link>
              <div className="flex gap-2 border-t p-3"><Link href={`/t/${t.id}/register-player`} className="btn-gold flex-1">Player</Link><Link href={`/t/${t.id}/register-team`} className="btn flex-1">Team</Link></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
