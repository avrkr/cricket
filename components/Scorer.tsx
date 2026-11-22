"use client";
/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Legal balls only count toward the over; wides/no-balls are extras that don't consume a ball.
export function summarize(balls: any[]) {
  const runs = balls.reduce((s, b) => s + b.runs + b.extra_runs, 0);
  const wkts = balls.filter((b) => b.is_wicket).length;
  const legal = balls.filter((b) => b.extra_type !== "wide" && b.extra_type !== "noball").length;
  return { runs, wkts, overs: `${Math.floor(legal / 6)}.${legal % 6}` };
}

export default function Scorer({ match, teams, squad, canScore }: { match: any; teams: any[]; squad: any[]; canScore: boolean }) {
  const [sb] = useState(() => supabaseBrowser());
  const [balls, setBalls] = useState<any[]>([]);
  const [innings, setInnings] = useState(1);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState(match.status);
  const [extra, setExtra] = useState<"" | "wide" | "noball" | "bye" | "legbye">("");
  const [batter, setBatter] = useState(""); const [bowler, setBowler] = useState(""); const [kind, setKind] = useState("bowled");
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";

  const load = useCallback(async () => {
    const { data } = await sb.from("ball_events").select("*").eq("match_id", match.id).order("id");
    setBalls(data ?? []);
  }, [sb, match.id]);

  useEffect(() => {
    load();
    const ch = sb.channel(`m-${match.id}`).on("postgres_changes", { event: "*", schema: "public", table: "ball_events", filter: `match_id=eq.${match.id}` }, load)
      .subscribe((s) => s === "SUBSCRIBED" && load());
    return () => { sb.removeChannel(ch); };
  }, [sb, match.id, load]);

  const add = async (b: object) => {
    setErr("");
    const batting_team = innings === 1 ? match.team_a : match.team_b;
    const { error } = await sb.from("ball_events").insert({ match_id: match.id, innings, batting_team, batter_id: batter || null, bowler_id: bowler || null, ...b });
    if (error) setErr(error.message);
    if (status === "scheduled") { await sb.from("matches").update({ status: "live" }).eq("id", match.id); setStatus("live"); }
  };
  // Runs button meaning depends on the extra mode: no-ball = bat runs + 1 penalty, wide = all extras, bye/leg-bye = extras.
  const score = (r: number) => {
    if (extra === "noball") add({ extra_type: "noball", extra_runs: 1, runs: r });
    else if (extra === "wide") add({ extra_type: "wide", extra_runs: 1 + r });
    else if (extra) add({ extra_type: extra, extra_runs: r });
    else add({ runs: r });
    setExtra("");
  };
  const undo = async () => { const last = balls.at(-1); if (last) { const { error } = await sb.from("ball_events").delete().eq("id", last.id); if (error) setErr(error.message); } };
  const finish = async () => {
    const a = summarize(balls.filter((b) => b.innings === 1)), b = summarize(balls.filter((x) => x.innings === 2));
    const winner = a.runs === b.runs ? null : a.runs > b.runs ? match.team_a : match.team_b;
    const result = winner ? `${name(winner)} won (${a.runs}/${a.wkts} v ${b.runs}/${b.wkts})` : `Tied/No result (${a.runs} v ${b.runs})`;
    const { error } = await sb.rpc("match_finish", { p_match: match.id, p_winner: winner, p_result: result });
    if (error) setErr(error.message); else setStatus("completed");
  };

  const cur = balls.filter((b) => b.innings === innings);
  const s1 = summarize(balls.filter((b) => b.innings === 1)), s2 = summarize(balls.filter((b) => b.innings === 2));
  const sc = summarize(cur);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{name(match.team_a)} vs {name(match.team_b)} <span className="text-sm font-normal text-slate-500">{status}</span></h1>
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-emerald-950 p-6 text-xl text-white shadow-xl [&_b]:text-3xl [&_b]:text-amber-400">
        <div>{name(match.team_a)}: <b>{s1.runs}/{s1.wkts}</b> ({s1.overs})</div>
        <div>{name(match.team_b)}: <b>{s2.runs}/{s2.wkts}</b> ({s2.overs})</div>
        {match.result && <div className="text-emerald-700">{match.result}</div>}
      </div>
      {canScore && status !== "completed" && (
        <div className="card space-y-3">
          <div className="flex gap-2 items-center">Innings {innings} — {sc.runs}/{sc.wkts} ({sc.overs})
            <button className="btn-alt" onClick={() => setInnings(innings === 1 ? 2 : 1)}>Switch innings</button></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select className="input" value={batter} onChange={(e) => setBatter(e.target.value)}><option value="">Batter…</option>
              {squad.filter((p) => p.team_id === (innings === 1 ? match.team_a : match.team_b)).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
            <select className="input" value={bowler} onChange={(e) => setBowler(e.target.value)}><option value="">Bowler…</option>
              {squad.filter((p) => p.team_id === (innings === 1 ? match.team_b : match.team_a)).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{["bowled", "caught", "lbw", "run out", "stumped", "hit wicket"].map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["wide", "noball", "bye", "legbye"] as const).map((x) => <button key={x} className={extra === x ? "btn" : "btn-alt"} onClick={() => setExtra(extra === x ? "" : x)}>{x}</button>)}
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 6].map((r) => <button key={r} className="btn" onClick={() => score(r)}>{r}</button>)}
            <button className="btn-alt" onClick={() => add({ is_wicket: true, wicket_kind: kind })}>Wicket ({kind})</button>
            <button className="btn-alt" onClick={undo}>Undo</button>
            <button className="btn-alt" onClick={() => confirm("Finish match?") && finish()}>Finish match</button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}
      <div className="card flex flex-wrap gap-1 text-xs">
        {cur.slice(-24).map((b) => <span key={b.id} className="rounded bg-slate-100 px-2 py-1">{b.is_wicket ? "W" : b.extra_type ? `${b.extra_type[0].toUpperCase()}${b.extra_runs}` : b.runs}</span>)}
      </div>
    </div>
  );
}
