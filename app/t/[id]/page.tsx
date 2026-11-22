import Link from "next/link";
import { notFound } from "next/navigation";
import { session, canManage } from "@/lib/supabase/server";
import { setStatus, setCategory, createAuction, createMatch, addAward, retain } from "@/app/actions";
import { Field } from "@/components/Field";
import CopyLink from "@/components/CopyLink";

const money = (n: number | null) => (n == null ? "—" : "₹" + n.toLocaleString("en-IN"));
const H = ({ children }: { children: React.ReactNode }) => <h2 className="section-title">{children}</h2>;
const statusTone: Record<string, string> = { live: "bg-red-600 text-white", auction: "bg-amber-400 text-slate-900", registration: "bg-emerald-500 text-white", completed: "bg-slate-500 text-white", draft: "bg-slate-400 text-white" };

export default async function Tournament({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, role } = await session();
  const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();
  if (!t) notFound();
  const manage = canManage(role) && (role === "super_admin" || t.organizer_id === user?.id);

  const [teams, players, auctions, matches, points, awards, secrets] = await Promise.all([
    supabase.from("teams").select("*").eq("tournament_id", id).order("created_at"),
    supabase.from("players").select("*").eq("tournament_id", id).order("created_at"),
    supabase.from("auctions").select("*").eq("tournament_id", id).order("created_at", { ascending: false }),
    supabase.from("matches").select("*").eq("tournament_id", id).order("scheduled_at"),
    supabase.from("points_table").select("*").eq("tournament_id", id).order("points", { ascending: false }).order("nrr", { ascending: false }),
    supabase.from("awards").select("*").eq("tournament_id", id),
    manage ? supabase.from("team_secrets").select("*") : Promise.resolve({ data: [] as { team_id: string; code: string }[] }),
  ]);
  const T = teams.data ?? [], P = players.data ?? [];
  const tname = (tid: string | null) => T.find((x) => x.id === tid)?.short_name ?? "?";
  const pname = (pid: string | null) => P.find((x) => x.id === pid)?.full_name ?? "—";
  const code = (tid: string) => secrets.data?.find((s) => s.team_id === tid)?.code;
  const pending = [...T.filter((x) => x.status === "pending").map((x) => ({ table: "teams" as const, row: x, label: `Team: ${x.name} (${x.owner_name})` })),
    ...P.filter((x) => x.status === "pending").map((x) => ({ table: "players" as const, row: x, label: `Player: ${x.full_name} · ${x.role}` }))];
  const approvedTeams = T.filter((x) => x.status === "approved");
  const approvedPlayers = P.filter((x) => x.status === "approved");
  const liveAuction = auctions.data?.find((a) => a.status === "live" || a.status === "paused");

  return (
    <div>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 to-slate-950 text-white shadow-xl">
        {t.banner_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="relative p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2"><span className={`pill ${statusTone[t.status]}`}>{t.status.toUpperCase()}</span><span className="pill bg-white/20 text-white">{t.format}</span></div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{t.name}</h1>
          <p className="mt-2 max-w-2xl text-emerald-100">{t.description}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-emerald-100">
            <span>📍 {t.location ?? "TBA"}</span><span>📅 {t.start_date ?? "TBA"} → {t.end_date ?? "TBA"}</span>
            <span>💰 Purse {money(t.budget)}</span><span>👥 Squad {t.min_squad}–{t.max_squad}</span>
            {t.overseas_limit != null && <span>✈ Overseas ≤ {t.overseas_limit}</span>}{t.max_retentions > 0 && <span>🔁 Retentions {t.max_retentions}</span>}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {liveAuction && <Link className="btn-gold animate-pulse" href={`/t/${id}/auction?a=${liveAuction.id}`}>🔴 Watch live auction</Link>}
            <Link className="btn-gold" href={`/t/${id}/register-player`}>Register as player</Link>
            <Link className="btn" href={`/t/${id}/register-team`}>Register a team</Link>
            <Link className="btn-alt" href={`/t/${id}/status`}>Check my status</Link>
            <Link className="btn-alt" href={`/t/${id}/stats`}>📊 Statistics</Link>
          </div>
        </div>
      </section>

      {manage && <>
        <H>Admin panel</H>
        <div className="card space-y-3">
          <b>Pending approvals ({pending.length})</b>
          {!pending.length && <p className="text-sm text-slate-500">All caught up.</p>}
          {pending.map(({ table, row, label }) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
              <span className="flex-1 font-medium">{label}</span>
              <form action={setStatus.bind(null, table, row.id, id, "approved")}><button className="btn">Approve</button></form>
              <form action={setStatus.bind(null, table, row.id, id, "rejected")}><button className="btn-alt">Reject</button></form>
            </div>))}
        </div>
        {!!approvedTeams.length && <div className="card mt-4 space-y-2">
          <b>Team bidding links <span className="font-normal text-slate-500">— send each link privately to its owner</span></b>
          {approvedTeams.map((tm) => code(tm.id) && (
            <div key={tm.id} className="flex items-center gap-3 text-sm"><span className="w-40 font-medium">{tm.name}</span>
              <CopyLink path={`/t/${id}/auction/bid?code=${code(tm.id)}`} label="Copy bidding link" /></div>))}
        </div>}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form action={createAuction.bind(null, id)} className="card grid grid-cols-2 gap-3">
            <b className="col-span-2">Configure auction</b>
            <div className="col-span-2"><Field label="Name" name="name" required /></div>
            <Field label="Date & time" name="starts_at" type="datetime-local" />
            <Field label="Base price" name="base_price" type="number" defaultValue={2000000} />
            <Field label="Min bid increment" name="increment" type="number" defaultValue={500000} />
            <Field label="Timer (s)" name="timer_secs" type="number" defaultValue={30} />
            <Field label="Reset on bid (s)" name="reset_secs" type="number" defaultValue={15} />
            <button className="btn col-span-2 self-end">Create auction</button>
          </form>
          <form action={createMatch.bind(null, id)} className="card grid grid-cols-2 gap-3">
            <b className="col-span-2">Schedule match</b>
            {(["team_a", "team_b"] as const).map((k) => (
              <div key={k}><label className="label">{k === "team_a" ? "Team A" : "Team B"}</label>
                <select name={k} className="input" required>{approvedTeams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>))}
            <Field label="Date & time" name="scheduled_at" type="datetime-local" />
            <Field label="Venue" name="venue" />
            <div className="col-span-2"><Field label="Umpires" name="umpires" /></div>
            <button className="btn col-span-2">Schedule</button>
          </form>
        </div>
        {t.max_retentions > 0 && <form action={retain.bind(null, id)} className="card mt-4 flex flex-wrap items-end gap-3">
          <b className="w-full">Retain a player (before the auction)</b>
          <div><label className="label">Player</label><select name="player_id" className="input">{approvedPlayers.filter((x) => x.auction_status === "available").map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></div>
          <div><label className="label">Team</label><select name="team_id" className="input">{approvedTeams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <Field label="Retention price" name="price" type="number" required /><button className="btn">Retain</button>
        </form>}
        <form action={addAward.bind(null, id)} className="card mt-4 flex flex-wrap items-end gap-3">
          <Field label="Award title" name="title" required placeholder="Player of the Tournament" />
          <div><label className="label">Player</label><select name="player_id" className="input">{approvedPlayers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></div>
          <button className="btn">Publish award</button>
        </form>
        {!!auctions.data?.length && <div className="card mt-4 space-y-2"><b>Auctions</b>
          {auctions.data.map((a) => <div key={a.id} className="flex items-center gap-3 text-sm"><span className="flex-1 font-medium">{a.name} <span className="pill ml-1">{a.status}</span></span>
            <Link className="btn" href={`/t/${id}/auction/control?a=${a.id}`}>Control room</Link><Link className="btn-alt" href={`/t/${id}/auction?a=${a.id}`}>Public screen</Link></div>)}</div>}
      </>}
      {!manage && !!auctions.data?.length && <div className="mt-4 flex flex-wrap gap-2">{auctions.data.map((a) => <Link key={a.id} className="btn-alt" href={`/t/${id}/auction?a=${a.id}`}>{a.name} · {a.status}</Link>)}</div>}

      <H>Points table</H>
      <table className="tbl"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>NR</th><th>Pts</th><th>NRR</th></tr></thead>
        <tbody>{points.data?.map((r, i) => <tr key={r.team_id}><td>{i + 1}</td><td className="font-semibold">{r.name}</td><td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.no_result}</td><td className="font-bold text-emerald-700">{r.points}</td><td>{r.nrr}</td></tr>)}
          {!points.data?.length && <tr><td colSpan={8} className="text-center text-slate-400">No teams yet</td></tr>}</tbody></table>

      <H>Fixtures &amp; results</H>
      <div className="space-y-3">
        {!matches.data?.length && <div className="card text-slate-400">No matches scheduled.</div>}
        {matches.data?.map((m) => (
          <div key={m.id} className="card flex flex-wrap items-center gap-4">
            <div className="text-lg font-extrabold">{tname(m.team_a)} <span className="text-slate-400">vs</span> {tname(m.team_b)}</div>
            <div className="text-sm text-slate-500">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "TBD"} · {m.venue}</div>
            <span className="pill">{m.status}</span>
            {m.result && <span className="text-sm font-medium text-emerald-700">{m.result}</span>}
            <Link className="btn-alt ml-auto" href={`/score/${m.id}`}>{m.status === "completed" ? "Scorecard" : manage ? "Score match" : "Live score"}</Link>
          </div>))}
      </div>

      <H>Teams ({approvedTeams.length}/{t.num_teams})</H>
      <div className="grid gap-4 md:grid-cols-2">
        {approvedTeams.map((tm) => {
          const squad = P.filter((p) => p.team_id === tm.id);
          return (<div key={tm.id} className="card" style={{ borderTop: `5px solid ${tm.color}` }}>
            <div className="flex items-center gap-3">
              {tm.logo_url /* eslint-disable-next-line @next/next/no-img-element */ && <img src={tm.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />}
              <div><div className="text-lg font-bold">{tm.name} <span className="text-sm font-normal text-slate-400">{tm.short_name}</span></div>
                <div className="text-sm text-slate-500">Purse {money(tm.purse)} · Squad {squad.length}/{t.max_squad}</div></div>
            </div>
            <ul className="mt-3 divide-y text-sm">{squad.map((p) => <li key={p.id} className="flex justify-between py-1.5"><span>{p.full_name} <span className="text-slate-400">· {p.role}</span></span><b>{money(p.sold_price)}</b></li>)}</ul>
          </div>);
        })}
      </div>

      <H>Players ({approvedPlayers.length})</H>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {approvedPlayers.map((p) => (
          <div key={p.id} className="card flex gap-3 p-4 text-sm">
            {p.photo_url /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={p.photo_url} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-xl bg-slate-100 text-3xl">🏏</div>}
            <div className="flex-1">
              <div className="font-bold">{p.full_name}</div>
              <div className="font-mono text-xs text-slate-400">{p.reg_code}</div>
              <div className="mt-1 flex flex-wrap gap-1"><span className="pill">{p.role}</span>{p.is_overseas && <span className="pill">✈</span>}{p.is_retained && <span className="pill">retained</span>}
                <span className={`pill ${p.auction_status === "sold" ? "bg-emerald-100 text-emerald-800" : ""}`}>{p.auction_status}</span></div>
              <div className="mt-1 text-slate-500">Base {money(p.base_price)} · {p.category}</div>
              {manage && <form action={setCategory.bind(null, p.id, id)} className="mt-2 flex gap-1"><input name="category" defaultValue={p.category ?? ""} className="input py-1" /><button className="btn-alt">Set</button></form>}
            </div>
          </div>))}
      </div>

      {!!awards.data?.length && <><H>Awards</H><div className="grid gap-3 sm:grid-cols-3">{awards.data.map((a) => <div key={a.id} className="card text-center"><div className="text-3xl">🏆</div><div className="text-xs uppercase tracking-wide text-slate-500">{a.title}</div><b>{pname(a.player_id)}</b></div>)}</div></>}
    </div>
  );
}
