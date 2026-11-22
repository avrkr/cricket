import Link from "next/link";
import { notFound } from "next/navigation";
import { session } from "@/lib/supabase/server";

const money = (n: number | null) => (n == null ? "—" : "₹" + n.toLocaleString("en-IN"));

export default async function TeamPage({ params }: { params: Promise<{ id: string; tid: string }> }) {
  const { id, tid } = await params;
  const { supabase } = await session();
  const [{ data: tm }, { data: t }, { data: squad }] = await Promise.all([
    supabase.from("teams").select("*").eq("id", tid).eq("tournament_id", id).single(),
    supabase.from("tournaments").select("max_squad,min_squad").eq("id", id).single(),
    supabase.from("players").select("*").eq("team_id", tid).order("sold_price", { ascending: false }),
  ]);
  if (!tm || !t) notFound();
  const S = squad ?? [];
  return (
    <div className="space-y-5">
      <Link href={`/t/${id}`} className="text-sm text-emerald-700 hover:underline">← Back to tournament</Link>
      <div className="card flex items-center gap-4" style={{ borderTop: `5px solid ${tm.color}` }}>
        {tm.logo_url /* eslint-disable-next-line @next/next/no-img-element */ && <img src={tm.logo_url} alt="" className="h-16 w-16 rounded-full object-cover" />}
        <div><h1 className="text-2xl font-black">{tm.name} <span className="text-base font-normal text-slate-400">{tm.short_name}</span></h1>
          <div className="text-sm text-slate-500">Purse left {money(tm.purse)} · Squad {S.length}/{t.max_squad}</div></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {S.map((p) => (
          <Link key={p.id} href={`/t/${id}/players/${p.id}`} className="card lift flex gap-3 p-4 text-sm">
            {p.photo_url /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={p.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100 text-2xl">🏏</div>}
            <div><div className="font-bold">{p.full_name}</div><span className="pill">{p.role}</span>{p.is_retained && <span className="pill ml-1">retained</span>}
              <div className="mt-1 font-semibold text-emerald-700">{money(p.sold_price)}</div></div>
          </Link>))}
        {!S.length && <div className="card text-slate-400">No players in this squad yet.</div>}
      </div>
    </div>
  );
}
