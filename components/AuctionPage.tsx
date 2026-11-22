import { notFound, redirect } from "next/navigation";
import { session, canManage } from "@/lib/supabase/server";
import AuctionRoom from "./AuctionRoom";

type SP = { a?: string; code?: string };
export default async function AuctionPage({ params, searchParams, mode }: { params: Promise<{ id: string }>; searchParams: Promise<SP>; mode: "control" | "public" | "bid" }) {
  const { id } = await params; const { a, code } = await searchParams;
  const { supabase, user, role } = await session();
  const { data: t } = await supabase.from("tournaments").select("max_squad, organizer_id").eq("id", id).single();
  if (!t) notFound();
  let q = supabase.from("auctions").select("id").eq("tournament_id", id).order("created_at", { ascending: false }).limit(1);
  if (a) q = supabase.from("auctions").select("id").eq("id", a).eq("tournament_id", id).limit(1);
  const auction = (await q).data?.[0];
  if (!auction) return <div className="card text-center text-slate-500">No auction has been configured yet.</div>;

  if (mode === "control" && !(canManage(role) && (role === "super_admin" || t.organizer_id === user?.id))) redirect(`/t/${id}/auction?a=${auction.id}`);
  let team: { id: string; name: string } | null = null;
  if (mode === "bid") {
    team = code ? (await supabase.rpc("team_by_code", { p_code: code })).data?.[0] : null;
    if (!team || (team as { tournament_id?: string } & typeof team).tournament_id !== id)
      return <div className="card text-center text-red-700">This bidding link is invalid or the team is not approved.</div>;
  }
  return <AuctionRoom auctionId={auction.id} tournamentId={id} mode={mode} myTeamId={team?.id ?? null} code={code} maxSquad={t.max_squad} />;
}
