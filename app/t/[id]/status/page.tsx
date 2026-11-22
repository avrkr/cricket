import Link from "next/link";
import { session } from "@/lib/supabase/server";

type SP = { code?: string; phone?: string; team?: string; email?: string };

export default async function Status({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params; const q = await searchParams;
  const { supabase } = await session();
  const player = q.code && q.phone ? (await supabase.rpc("player_status", { p_tid: id, p_phone: q.phone, p_code: q.code })).data?.[0] : null;
  const team = q.team && q.email ? (await supabase.rpc("team_status", { p_tid: id, p_email: q.email, p_short: q.team })).data?.[0] : null;
  const teamId = team ? (await supabase.from("teams").select("id").eq("tournament_id", id).ilike("short_name", q.team!).single()).data?.id : null;
  const asked = (q.code && q.phone) || (q.team && q.email);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href={`/t/${id}`} className="text-sm text-emerald-700 hover:underline">← Back to tournament</Link>
      <h1 className="text-2xl font-extrabold">Registration status</h1>
      {(player || team) && (
        <div className="card space-y-2 border-emerald-300 bg-emerald-50">
          {player && <>
            <div className="text-lg font-bold">{player.full_name}</div>
            <div>Registration ID: <b className="font-mono">{player.reg_code}</b> <span className="text-xs text-slate-500">(save this)</span></div>
            <div>Registered ✔ · Auction: <span className="pill">{player.auction_status}</span></div>
            {player.team && <div>🏆 Won by <b>{player.team}</b> for {player.sold_price?.toLocaleString("en-IN")}</div>}
          </>}
          {team && <>
            <div className="text-lg font-bold">{team.name}</div>
            <div>Registered ✔ · {teamId && <Link href={`/t/${id}/teams/${teamId}`} className="font-semibold text-emerald-700 underline">View team members →</Link>}</div>
            <p className="text-sm text-slate-600">The organizer will send you your private bidding link.</p>
          </>}
        </div>)}
      {asked && !player && !team && <div className="card text-red-700">No registration matches those details.</div>}

      <form className="card grid gap-3 sm:grid-cols-3">
        <b className="sm:col-span-3">Player lookup</b>
        <input name="code" placeholder="Registration ID (PL-…)" className="input" /><input name="phone" placeholder="Mobile" className="input" /><button className="btn">Check</button>
      </form>
      <form className="card grid gap-3 sm:grid-cols-3">
        <b className="sm:col-span-3">Team lookup</b>
        <input name="team" placeholder="Team short name" className="input" /><input name="email" placeholder="Owner email" className="input" /><button className="btn">Check</button>
      </form>
    </div>
  );
}
