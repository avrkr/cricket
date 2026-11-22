import { notFound } from "next/navigation";
import { session } from "@/lib/supabase/server";
import Scorer from "@/components/Scorer";

export default async function ScorePage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const { supabase, user, role } = await session();
  const { data: m } = await supabase.from("matches").select("*, tournaments(organizer_id)").eq("id", matchId).single();
  if (!m) notFound();
  const { data: teams } = await supabase.from("teams").select("id,name,short_name").in("id", [m.team_a, m.team_b]);
  const { data: squad } = await supabase.from("players").select("id,full_name,team_id").in("team_id", [m.team_a, m.team_b]).order("full_name");
  const canScore = !!user && m.status !== "completed" && (m.scorer_id === user.id || role === "super_admin" || m.tournaments?.organizer_id === user.id);
  return <Scorer match={m} teams={teams ?? []} squad={squad ?? []} canScore={canScore} />;
}
