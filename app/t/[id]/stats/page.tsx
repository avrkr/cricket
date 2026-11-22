import Link from "next/link";
import { session } from "@/lib/supabase/server";
import StatsCharts from "@/components/StatsCharts";

export default async function Stats({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  const q = ((await searchParams).q ?? "").replace(/[%_,()]/g, " ").trim();
  const { supabase } = await session();
  const [{ data: st }, { data: pts }] = await Promise.all([
    supabase.from("player_stats").select("*").eq("tournament_id", id),
    supabase.from("points_table").select("name:short_name, points").eq("tournament_id", id),
  ]);
  const everyone = st ?? [];
  const all = q ? everyone.filter((p) => p.full_name.toLowerCase().includes(q.toLowerCase())) : everyone;
  const sr = (r: number, b: number) => (b ? ((r * 100) / b).toFixed(1) : "—");
  const econ = (r: number, b: number) => (b ? ((r * 6) / b).toFixed(2) : "—");
  const top = (k: "runs" | "wickets") => [...everyone].sort((a, b) => b[k] - a[k]).slice(0, 5).map((p) => ({ name: p.full_name.split(" ")[0], [k]: p[k] }));
  return (
    <div className="space-y-4">
      <Link href={`/t/${id}`} className="text-sm text-emerald-700 underline">← Tournament</Link>
      <h1 className="text-2xl font-extrabold">Player statistics{q && <span className="text-slate-400"> · “{q}”</span>}</h1>
      <form className="card flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="🔍 Find a player by name to see their stats" className="input flex-1" />
        <button className="btn">Search</button>
        {q && <Link href={`/t/${id}/stats`} className="btn-alt">Clear</Link>}
      </form>
      {q && !all.length && <div className="card text-center text-slate-500">No player named “{q}” in this tournament.</div>}
      <StatsCharts runs={top("runs")} wickets={top("wickets")} points={pts ?? []} />
      <div className="overflow-x-auto"><table className="tbl">
        <thead><tr><th>Player</th><th>Runs</th><th>Balls</th><th>SR</th><th>4s</th><th>6s</th><th>Wkts</th><th>Econ</th></tr></thead>
        <tbody>{all.map((p) => <tr key={p.player_id}><td><Link href={`/t/${id}/players/${p.player_id}`} className="font-medium text-emerald-700 hover:underline">{p.full_name}</Link></td><td>{p.runs}</td><td>{p.balls_faced}</td><td>{sr(p.runs, p.balls_faced)}</td><td>{p.fours}</td><td>{p.sixes}</td><td>{p.wickets}</td><td>{econ(p.runs_conceded, p.balls_bowled)}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
