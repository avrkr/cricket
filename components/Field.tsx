import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({ label, name, type = "text", required, defaultValue, placeholder }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number | null; placeholder?: string }) {
  return (
    <div>
      <Label htmlFor={name} className="mb-1">{label}</Label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue ?? undefined} placeholder={placeholder} />
    </div>
  );
}
