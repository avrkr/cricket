import { redirect } from "next/navigation";
import { session, canManage } from "@/lib/supabase/server";
import { createTournament } from "@/app/actions";
import { type FieldDef } from "@/lib/schemas";
import RhfForm from "@/components/RhfForm";

const fields: FieldDef[] = [
  { name: "name", label: "Name" }, { name: "format", label: "Format", type: "select", options: ["T10", "T20", "ODI", "Test", "Custom"] },
  { name: "location", label: "Location" }, { name: "num_teams", label: "Number of teams", type: "number" },
  { name: "start_date", label: "Start date", type: "date" }, { name: "end_date", label: "End date", type: "date" },
  { name: "budget", label: "Budget per team", type: "number" }, { name: "max_retentions", label: "Retentions per team", type: "number" },
  { name: "min_squad", label: "Min squad size", type: "number" }, { name: "max_squad", label: "Max squad size", type: "number" },
  { name: "overseas_limit", label: "Overseas limit per team (optional)", type: "number" }, { name: "logo", label: "Logo", type: "file" },
  { name: "banner", label: "Banner", type: "file", span: 2 }, { name: "description", label: "Description", type: "textarea", span: 2 },
];

export default async function NewTournament() {
  const { role } = await session();
  if (!canManage(role)) redirect("/");
  return <RhfForm title="Create tournament" schema="tournament" fields={fields} submitLabel="Create" action={createTournament}
    defaults={{ format: "T20", num_teams: "8", budget: "100000000", min_squad: "11", max_squad: "18", max_retentions: "0" }} />;
}
