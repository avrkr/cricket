import { registerPlayer } from "@/app/actions";
import { type FieldDef } from "@/lib/schemas";
import RhfForm from "@/components/RhfForm";

const fields: FieldDef[] = [
  { name: "full_name", label: "Full name" }, { name: "dob", label: "Date of birth", type: "date" },
  { name: "city", label: "City" }, { name: "state", label: "State" },
  { name: "role", label: "Playing role", type: "select", options: ["Batsman", "Bowler", "All-rounder", "Wicketkeeper"] },
  { name: "jersey_no", label: "Jersey number", type: "number" },
  { name: "batting_style", label: "Batting style", placeholder: "Right-hand bat" }, { name: "bowling_style", label: "Bowling style", placeholder: "Right-arm fast" },
  { name: "base_price", label: "Base auction price", type: "number" }, { name: "photo", label: "Profile photo", type: "file" },
  { name: "previous_teams", label: "Previous teams" }, { name: "keeper_exp", label: "Wicketkeeping experience" },
  { name: "bat_stats", label: "Batting statistics", placeholder: "Matches 40, Runs 1200, SR 135" }, { name: "bowl_stats", label: "Bowling statistics", placeholder: "Wickets 35, Econ 7.2" },
  { name: "experience", label: "Cricket experience", type: "textarea", span: 2 },
  { name: "available", label: "Available for auction", type: "checkbox", span: 2 },
  { name: "is_overseas", label: "Overseas player", type: "checkbox", span: 2 },
];

export default async function RegisterPlayer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RhfForm title="Player registration" schema="player" fields={fields} submitLabel="Submit registration"
    action={registerPlayer.bind(null, id)} defaults={{ role: "Batsman", available: true, base_price: "0" }} />;
}
