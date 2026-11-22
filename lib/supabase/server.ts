import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} // server components can't set
      },
    },
  });
}

export type Role = "super_admin" | "organizer" | "team_owner" | "player" | "scorer" | "spectator";

export async function session() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, role").eq("id", user.id).single()
    : { data: null };
  return { supabase, user, role: (profile?.role ?? null) as Role | null, name: profile?.full_name as string | null };
}

export const canManage = (role: Role | null) => role === "organizer" || role === "super_admin";
