/* eslint-disable react-hooks/purity */
import Link from "next/link";
import { notFound } from "next/navigation";
import { session } from "@/lib/supabase/server";

const money = (n: number | null) => (n == null ? "—" : "₹" + n.toLocaleString("en-IN"));
const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="card p-4 text-center"><div className="text-3xl font-black text-emerald-700">{value}</div><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div></div>
);

export default async function PlayerPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const { supabase } = await session();
  const { data: p } = await supabase.from("players").select("*").eq("id", pid).eq("tournament_id", id).single();
  if (!p) notFound();
  const [{ data: st }, { data: team }] = await Promise.all([
    supabase.from("player_stats").select("*").eq("player_id", pid).maybeSingle(),
    p.team_id ? supabase.from("teams").select("id,name,color").eq("id", p.team_id).single() : Promise.resolve({ data: null }),
  ]);
  const s = st ?? { runs: 0, balls_faced: 0, fours: 0, sixes: 0, dismissals: 0, wickets: 0, runs_conceded: 0, balls_bowled: 0 };
  const sr = s.balls_faced ? ((s.runs * 100) / s.balls_faced).toFixed(1) : "—";
  const econ = s.balls_bowled ? ((s.runs_conceded * 6) / s.balls_bowled).toFixed(2) : "—";
  const avg = s.dismissals ? (s.runs / s.dismissals).toFixed(1) : "—";
  const age = Math.floor((Date.now() - new Date(p.dob).getTime()) / 31557600000);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 text-sm text-emerald-700">{team && <Link href={`/t/${id}/teams/${team.id}`} className="hover:underline">← {team.name}</Link>}<Link href={`/t/${id}/stats`} className="hover:underline">All statistics</Link></div>
      <section className="flex flex-col gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 to-slate-950 p-6 text-white shadow-xl sm:flex-row sm:p-8">
        {p.photo_url /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={p.photo_url} alt="" className="h-48 w-48 rounded-2xl object-cover" /> : <div className="grid h-48 w-48 place-items-center rounded-2xl bg-white/10 text-6xl">🏏</div>}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2"><span className="pill bg-amber-400 text-slate-900">{p.role}</span><span className="pill bg-white/20 text-white">{p.reg_code}</span>{p.is_overseas && <span className="pill bg-white/20 text-white">Overseas ✈</span>}</div>
          <h1 className="text-3xl font-black sm:text-4xl">{p.full_name}</h1>
          <div className="text-emerald-100">Age {age} · {[p.city, p.state].filter(Boolean).join(", ")} {p.jersey_no != null && `· #${p.jersey_no}`}</div>
          <div className="text-sm text-emerald-100">Bat: {p.batting_style ?? "—"} · Bowl: {p.bowling_style ?? "—"}</div>
          <div className="pt-1 text-sm">{p.auction_status === "sold" && team
            ? <>🏆 <Link href={`/t/${id}/teams/${team.id}`} className="hover:underline"><b style={{ color: "#fbbf24" }}>{team.name}</b></Link> · {money(p.sold_price)}{p.is_retained && " (retained)"}</>
            : <>Auction: <b>{p.auction_status}</b> · Base {money(p.base_price)}</>}</div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Runs" value={s.runs} /><Stat label="Balls" value={s.balls_faced} /><Stat label="Strike rate" value={sr} /><Stat label="Average" value={avg} />
        <Stat label="Fours" value={s.fours} /><Stat label="Sixes" value={s.sixes} /><Stat label="Wickets" value={s.wickets} /><Stat label="Economy" value={econ} />
      </div>

      {(p.bat_stats || p.bowl_stats || p.experience || p.previous_teams || p.keeper_exp) && (
        <div className="card space-y-2 text-sm">
          <b className="text-base">Career background</b>
          {p.bat_stats && <p><span className="label inline">Batting</span> {p.bat_stats}</p>}
          {p.bowl_stats && <p><span className="label inline">Bowling</span> {p.bowl_stats}</p>}
          {p.keeper_exp && <p><span className="label inline">Wicketkeeping</span> {p.keeper_exp}</p>}
          {p.previous_teams && <p><span className="label inline">Previous teams</span> {p.previous_teams}</p>}
          {p.experience && <p className="text-slate-600">{p.experience}</p>}
        </div>)}
    </div>
  );
}
