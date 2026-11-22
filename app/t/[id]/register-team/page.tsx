import { registerTeam } from "@/app/actions";
import { type FieldDef } from "@/lib/schemas";
import RhfForm from "@/components/RhfForm";

const fields: FieldDef[] = [
  { name: "name", label: "Team name" }, { name: "short_name", label: "Short name (2-5 letters)" },
  { name: "owner_name", label: "Owner name" }, { name: "owner_email", label: "Owner email", type: "email" },
  { name: "owner_phone", label: "Owner phone" }, { name: "city", label: "City" },
  { name: "color", label: "Team colour", type: "color" }, { name: "logo", label: "Logo", type: "file" },
  { name: "docs", label: "Registration documents", type: "file", span: 2 },
  { name: "description", label: "Description", type: "textarea", span: 2 },
];

export default async function RegisterTeam({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RhfForm title="Register your team" schema="team" fields={fields} submitLabel="Submit for approval"
    action={registerTeam.bind(null, id)} defaults={{ color: "#16a34a" }} />;
}
