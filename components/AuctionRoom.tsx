"use client";
/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "control" | "public" | "bid";
const money = (n: number | null | undefined) => (n == null ? "—" : "₹" + n.toLocaleString("en-IN"));

function Ring({ left, total, paused }: { left: number | null; total: number; paused: boolean }) {
  const R = 54, C = 2 * Math.PI * R, frac = left == null ? 0 : Math.min(1, left / Math.max(total, 1));
  const hot = left != null && left <= 5;
  return (
    <div className="relative grid h-36 w-36 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="8" />
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
          className={`transition-[stroke-dashoffset] duration-300 ${hot ? "stroke-red-500" : "stroke-amber-400"}`} />
      </svg>
      <div className={`text-5xl font-black tabular-nums ${hot ? "text-red-400" : "text-white"}`}>{left ?? "--"}</div>
      <div className="absolute bottom-6 text-[10px] uppercase tracking-widest text-slate-400">{paused ? "paused" : "seconds"}</div>
    </div>
  );
}

export default function AuctionRoom({ auctionId, tournamentId, mode, myTeamId, code, maxSquad }: { auctionId: string; tournamentId: string; mode: Mode; myTeamId?: string | null; code?: string; maxSquad: number }) {
  const [sb] = useState(() => supabaseBrowser());
  const [a, setA] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [squad, setSquad] = useState<any[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [last, setLast] = useState<any>(null);
  const [dismissed, setDismissed] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [skew, setSkew] = useState(0);
  const [msg, setMsg] = useState("");
  const [custom, setCustom] = useState("");
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const resolving = useRef("");

  const load = useCallback(async () => {
    const t0 = Date.now();
    const [{ data: sn }, { data: au }, { data: tm }, { data: sq }, { data: bd }, { data: ev }] = await Promise.all([
      sb.rpc("server_now"),
      sb.from("auctions").select("*").eq("id", auctionId).single(),
      sb.from("teams").select("*").eq("tournament_id", tournamentId).eq("status", "approved").order("name"),
      sb.from("players").select("id,team_id").eq("tournament_id", tournamentId).not("team_id", "is", null),
      sb.from("bids").select("*").eq("auction_id", auctionId).order("id", { ascending: false }).limit(30),
      sb.from("auction_events").select("*").eq("auction_id", auctionId).in("type", ["sold", "unsold"]).order("id", { ascending: false }).limit(1),
    ]);
    if (sn) setSkew(new Date(sn as string).getTime() - (t0 + Date.now()) / 2);
    setA(au); setTeams(tm ?? []); setSquad(sq ?? []); setBids(bd ?? []);
    if (au?.current_player_id) setPlayer((await sb.from("players").select("*").eq("id", au.current_player_id).single()).data);
    else setPlayer(null);
    const e = ev?.[0];
    if (e) { const { data: p } = await sb.from("players").select("full_name,photo_url").eq("id", e.payload.player).single(); setLast({ ...e, p }); }
  }, [sb, auctionId, tournamentId]);

  useEffect(() => {
    load();
    let timer: ReturnType<typeof setTimeout>;
    const reload = () => { clearTimeout(timer); timer = setTimeout(load, 100); };
    const ch = sb.channel(`auction-${auctionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "bids", filter: `auction_id=eq.${auctionId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${tournamentId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${tournamentId}` }, reload)
      .subscribe((s) => { setOnline(s === "SUBSCRIBED"); if (s === "SUBSCRIBED") load(); }); // resync on every (re)connect
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => { clearTimeout(timer); clearInterval(tick); sb.removeChannel(ch); };
  }, [sb, auctionId, tournamentId, load]);

  const serverNow = now + skew;
  const left = a?.status === "paused" ? a.paused_left : a?.ends_at ? Math.max(0, Math.ceil((new Date(a.ends_at).getTime() - serverNow) / 1000)) : null;

  // Any browser may trigger resolution at zero; the RPC is row-locked and idempotent.
  useEffect(() => {
    if (a?.status !== "live" || !a.current_player_id || left !== 0) return;
    const key = a.current_player_id + a.ends_at;
    if (resolving.current === key) return;
    resolving.current = key;
    sb.rpc("auction_resolve", { p_auction: auctionId }).then(({ error }) => { if (error) resolving.current = ""; });
  }, [left, a, sb, auctionId]);

  const rpc = async (fn: string, args: object) => {
    setMsg(""); setBusy(true);
    const { error } = await sb.rpc(fn, args);
    if (error) setMsg(error.message); else await load();
    setBusy(false);
  };
  const ctl = (action: string, p_secs = 0) => rpc("auction_control", { p_auction: auctionId, p_action: action, p_secs });
  const bid = (amount: number) => rpc("place_bid", { p_auction: auctionId, p_code: code, p_amount: amount });

  if (!a) return (
    <div className="space-y-5 rounded-3xl bg-slate-950 p-6" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-full bg-white/10" />
      <div className="grid gap-5 lg:grid-cols-3"><div className="h-80 animate-pulse rounded-2xl bg-white/10 lg:col-span-2" /><div className="h-80 animate-pulse rounded-2xl bg-white/10" /></div>
    </div>);
  const minBid = a.current_team_id ? a.current_bid + a.increment : a.current_bid;
  const leader = teams.find((t) => t.id === a.current_team_id);
  const mine = teams.find((t) => t.id === myTeamId);
  const slots = (id: string) => squad.filter((s) => s.team_id === id).length;
  const live = a.status === "live" && player;
  const showResult = last && last.id !== dismissed && serverNow - new Date(last.created_at).getTime() < 8000 && !player;
  const quick = [minBid, minBid + a.increment, minBid + a.increment * 2];

  return (
    <div className="relative space-y-5 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 p-4 text-white shadow-2xl sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold tracking-widest">
          <span className={`h-2 w-2 rounded-full bg-white ${a.status === "live" ? "animate-pulse" : "opacity-40"}`} />{a.status.toUpperCase()}</span>
        <h1 className="text-xl font-extrabold tracking-tight">{a.name}</h1>
        <span className="text-sm text-slate-400">Round {a.round}</span>
        {!online && <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300">Reconnecting…</span>}
        {mine && <span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-sm">Bidding as <b style={{ color: mine.color }}>{mine.name}</b> · purse <b>{money(mine.purse)}</b></span>}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="dark-card relative overflow-hidden lg:col-span-2">
          {player ? (
            <div className="flex flex-col gap-6 sm:flex-row">
              <div className="relative">
                {player.photo_url ? <img src={player.photo_url} alt="" className="h-64 w-full rounded-2xl object-cover sm:h-72 sm:w-60" />
                  : <div className="grid h-72 w-full place-items-center rounded-2xl bg-slate-800 text-7xl sm:w-60">🏏</div>}
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold">{player.reg_code}</span>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-amber-400 px-2.5 py-0.5 font-bold text-slate-900">{player.role}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5">{player.category}</span>{player.is_overseas && <span className="rounded-full bg-sky-500/30 px-2.5 py-0.5">Overseas ✈</span>}</div>
                <div className="text-3xl font-black leading-none tracking-tight sm:text-4xl">{player.full_name}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-300">
                  <span>Age <b className="text-white">{Math.floor((Date.now() - new Date(player.dob).getTime()) / 31557600000)}</b></span>
                  <span>Base <b className="text-white">{money(player.base_price)}</b></span>
                  <span>Bat <b className="text-white">{player.batting_style ?? "—"}</b></span>
                  <span>Bowl <b className="text-white">{player.bowling_style ?? "—"}</b></span>
                </div>
                {(player.bat_stats || player.bowl_stats) && <div className="rounded-xl bg-white/5 p-3 text-xs text-slate-300">{player.bat_stats}<br />{player.bowl_stats}</div>}
              </div>
              <div className="flex flex-row items-center justify-between gap-4 sm:flex-col">
                <Ring left={left} total={a.timer_secs} paused={a.status === "paused"} />
                <div key={a.current_bid} className="animate-flash rounded-2xl text-center">
                  <div className="text-[11px] uppercase tracking-widest text-slate-400">{leader ? "Current bid" : "Base price"}</div>
                  <div className="text-4xl font-black text-amber-400">{money(a.current_bid)}</div>
                  <div className="text-sm">{leader ? <b style={{ color: leader.color }}>{leader.name}</b> : <span className="text-slate-400">No bids yet</span>}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center text-center text-slate-400">
              <div><div className="text-6xl">{a.status === "closed" ? "🏁" : "🏏"}</div>
                <p className="mt-3 text-lg">{a.status === "scheduled" ? "The auction hasn't started yet." : a.status === "closed" ? "Auction closed. Good luck this season!" : "Waiting for the next player…"}</p></div>
            </div>
          )}
          {showResult && (
            <div onClick={() => setDismissed(last.id)} className="animate-pop absolute inset-0 z-10 grid cursor-pointer place-items-center bg-slate-950/90 text-center">
              {last.type === "sold" && Array.from({ length: 36 }, (_, i) => <span key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 120}ms`, background: ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#fff"][i % 5] }} />)}
              {last.type === "sold" ? (<div>
                <div className="text-6xl font-black tracking-widest text-amber-400">SOLD!</div>
                <div className="mt-2 text-3xl font-bold">{last.p?.full_name}</div>
                <div className="mt-1 text-xl">to <b style={{ color: teams.find((t) => t.id === last.payload.team)?.color }}>{teams.find((t) => t.id === last.payload.team)?.name}</b> for <b className="text-amber-400">{money(last.payload.amount)}</b></div>
              </div>) : (<div><div className="text-6xl font-black tracking-widest text-slate-400">UNSOLD</div><div className="mt-2 text-2xl">{last.p?.full_name}</div></div>)}
            </div>
          )}
        </div>

        <div className="dark-card max-h-[26rem] overflow-auto">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Bid history</div>
          {!bids.length && <p className="text-sm text-slate-500">No bids yet.</p>}
          {bids.map((b, i) => { const t = teams.find((x) => x.id === b.team_id); return (
            <div key={b.id} className={`flex items-center justify-between border-b border-white/5 py-2 text-sm ${i === 0 ? "font-bold" : "text-slate-300"}`}>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: t?.color }} />{t?.short_name}</span><span>{money(b.amount)}</span></div>); })}
        </div>
      </div>

      {mode === "bid" && (
        <div className="dark-card sticky bottom-2 z-20 border-amber-400/30 bg-slate-900/95 shadow-2xl">
          <fieldset disabled={busy} className="flex flex-wrap items-center gap-3 border-0 p-0">
          {busy && <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />}
          {quick.map((q, i) => <button key={i} disabled={!live} onClick={() => bid(q)} className={i === 0 ? "btn-gold h-12 px-6 text-base" : "btn-alt h-12 border-white/20 bg-white/5 text-white hover:bg-white/10"}>{i === 0 ? "BID " : ""}{money(q)}</button>)}
          <input className="h-12 w-40 rounded-lg border border-white/20 bg-white/5 px-3 text-white placeholder:text-slate-500" placeholder="Custom ₹" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn-alt h-12 border-white/20 bg-white/5 text-white hover:bg-white/10" disabled={!live || !custom} onClick={() => bid(Number(custom))}>Place bid</button>
          {a.current_team_id === myTeamId && live && <span className="font-semibold text-emerald-400">✔ You hold the highest bid</span>}
          </fieldset>
        </div>
      )}

      {mode === "control" && (
        <div className="dark-card">
          <fieldset disabled={busy} className="flex flex-wrap items-center gap-2 border-0 p-0">
          {busy && <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />}
          {a.status === "scheduled" && <button className="btn-gold" onClick={() => ctl("start")}>▶ Start auction</button>}
          {a.status === "live" && !a.current_player_id && <button className="btn-gold" onClick={() => rpc("auction_next", { p_auction: auctionId })}>Next player →</button>}
          {a.status === "live" && <button className="btn-alt" onClick={() => ctl("pause")}>⏸ Pause</button>}
          {a.status === "paused" && <button className="btn-gold" onClick={() => ctl("resume")}>▶ Resume</button>}
          {live && <>
            <button className="btn-alt" onClick={() => ctl("extend", 10)}>+10s</button>
            <button className="btn" onClick={() => ctl("sold")}>Mark sold</button>
            <button className="btn-alt" onClick={() => ctl("unsold")}>Mark unsold</button>
            <button className="btn-alt" onClick={() => ctl("skip")}>Skip</button>
            <button className="btn-alt" onClick={() => ctl("cancel")}>Cancel player</button>
          </>}
          {a.status !== "closed" && <button className="btn-alt" onClick={() => ctl("round2")}>↺ Second round</button>}
          {a.status !== "closed" && <button className="btn-alt text-red-600" onClick={() => confirm("Close auction?") && ctl("close")}>Close auction</button>}
          </fieldset>
        </div>
      )}
      {msg && <p className="rounded-lg bg-red-500/20 p-3 text-sm text-red-200">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {teams.map((t) => { const used = slots(t.id), pct = Math.round((t.purse / Math.max(t.initial_purse, 1)) * 100); return (
          <div key={t.id} className={`dark-card p-4 text-sm transition ${t.id === a.current_team_id ? "ring-2 ring-amber-400" : ""}`} style={{ borderTop: `4px solid ${t.color}` }}>
            <div className="flex items-center justify-between"><b>{t.name}</b>{t.id === myTeamId && <span className="text-[10px] text-amber-300">YOU</span>}</div>
            <div className="mt-1 text-lg font-bold text-amber-300">{money(t.purse)}</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full rounded" style={{ width: `${pct}%`, background: t.color }} /></div>
            <div className="mt-2 text-xs text-slate-400">Squad {used}/{maxSquad} · {Math.max(0, maxSquad - used)} slots left</div>
          </div>); })}
      </div>
    </div>
  );
}
