"use client";
/* eslint-disable react-hooks/refs */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { tournamentSchema, teamSchema, playerSchema, type FieldDef } from "@/lib/schemas";

// Zod schemas are class instances and cannot cross the server→client boundary, so pages pass a name.
const schemas = { tournament: tournamentSchema, team: teamSchema, player: playerSchema };

type Result = { error?: string; to?: string };
/* eslint-disable @typescript-eslint/no-explicit-any */

export default function RhfForm({ title, schema, fields, defaults, action, submitLabel }: {
  title: string; schema: keyof typeof schemas; fields: FieldDef[]; defaults?: Record<string, unknown>;
  action: (f: FormData) => Promise<Result>; submitLabel: string;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<any>({ resolver: zodResolver(schemas[schema] as any), defaultValues: defaults });
  const ref = useRef<HTMLFormElement>(null);
  const [err, setErr] = useState("");
  const router = useRouter();

  // RHF validates; the DOM FormData (incl. files) is what we send, and the server re-validates with the same schema.
  const onValid = async () => {
    setErr("");
    const r = await action(new FormData(ref.current!));
    if (r.error) setErr(r.error); else if (r.to) { router.push(r.to); router.refresh(); }
  };

  return (
    <form ref={ref} onSubmit={handleSubmit(onValid)} className="mx-auto grid max-w-2xl gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:grid-cols-2 sm:p-8">
      <h1 className="border-b pb-3 text-2xl font-extrabold tracking-tight sm:col-span-2">{title}</h1>
      {fields.map((f) => {
        const msg = errors[f.name]?.message as string | undefined;
        const common = { id: f.name, ...register(f.name) };
        return (
          <div key={f.name} className={f.span === 2 ? "sm:col-span-2" : ""}>
            {f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...common} /> {f.label}</label>
            ) : (<>
              <Label htmlFor={f.name} className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{f.label}</Label>
              {f.type === "textarea" ? <Textarea rows={3} {...common} />
                : f.type === "select" ? <select {...common} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm">{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                : <Input type={f.type ?? "text"} placeholder={f.placeholder} {...common} className={f.type === "color" ? "h-10" : undefined} />}
            </>)}
            {msg && <p className="mt-1 text-xs text-red-600">{msg}</p>}
          </div>
        );
      })}
      {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 sm:col-span-2">{isSubmitting ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
