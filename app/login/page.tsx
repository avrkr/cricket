"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabaseBrowser } from "@/lib/supabase/client";
import { signInSchema } from "@/lib/schemas";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Login() {
  const [err, setErr] = useState("");
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<any>({ resolver: zodResolver(signInSchema as any) });

  async function submit(v: any) {
    setErr("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) return setErr(error.message);
    router.push("/"); router.refresh();
  }

  return (
    <div className="mx-auto mt-10 grid max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
      <div className="hidden flex-col justify-end bg-gradient-to-br from-emerald-700 via-emerald-900 to-slate-950 p-8 text-white md:flex">
        <div className="mb-auto text-5xl">🏏</div>
        <h2 className="text-2xl font-extrabold">Run the show.</h2>
        <p className="mt-1 text-sm text-emerald-100">Create tournaments, approve registrations and run the live auction from one control room.</p>
      </div>
      <form onSubmit={handleSubmit(submit)} className="space-y-4 p-8">
        <h1 className="text-xl font-bold">Admin sign in</h1>
        <div><label className="label">Email</label><input type="email" className="input" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message as string}</p>}</div>
        <div><label className="label">Password</label><input type="password" className="input" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message as string}</p>}</div>
        {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        <button type="submit" className="btn w-full" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</button>
        <p className="text-xs text-slate-500">Players and team owners don&apos;t need an account — use the registration buttons on a tournament page.</p>
      </form>
    </div>
  );
}
