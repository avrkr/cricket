"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { session, supabaseServer } from "@/lib/supabase/server";
import { tournamentSchema, teamSchema, playerSchema } from "@/lib/schemas";

type Result = { error?: string; to?: string };
// Form actions return {error}/{to} (thrown errors are masked in production builds).
async function run(fn: () => Promise<string>): Promise<Result> {
  try { return { to: await fn() }; }
  catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    const m = e instanceof Error ? e.message : "Something went wrong";
    return { error: m.includes("duplicate key") ? "Already registered: that phone, email or team short name is taken for this tournament." : m };
  }
}
const fields = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

const s = (f: FormData, k: string) => (String(f.get(k) ?? "").trim() || null);
const n = (f: FormData, k: string) => (f.get(k) ? Number(f.get(k)) : null);

async function upload(f: FormData, key: string, uid: string) {
  const file = f.get(key);
  if (!(file instanceof File) || !file.size) return null;
  const sb = await supabaseServer();
  const path = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await sb.storage.from("media").upload(path, file);
  if (error) throw new Error(error.message);
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

async function need() {
  const ctx = await session();
  if (!ctx.user) redirect("/login");
  return { ...ctx, user: ctx.user };
}
const check = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };

export async function signOut() {
  await (await supabaseServer()).auth.signOut();
  redirect("/login");
}

export async function createTournament(f: FormData) {
  return run(async () => {
    const { supabase, user } = await need();
    const v = tournamentSchema.parse(fields(f));
    const { data, error } = await supabase.from("tournaments").insert({
      name: v.name, format: v.format, num_teams: +v.num_teams, budget: +v.budget, min_squad: +v.min_squad, max_squad: +v.max_squad,
      overseas_limit: v.overseas_limit ? +v.overseas_limit : null, max_retentions: +v.max_retentions,
      organizer_id: user.id, description: s(f, "description"), location: s(f, "location"),
      start_date: s(f, "start_date"), end_date: s(f, "end_date"),
      logo_url: await upload(f, "logo", user.id), banner_url: await upload(f, "banner", user.id),
    }).select("id").single();
    if (error) throw new Error(error.message);
    return `/t/${data.id}`;
  });
}

export async function registerTeam(tid: string, f: FormData) {
  return run(async () => {
    const supabase = await supabaseServer(); // public form: no login
    const v = teamSchema.parse({ ...fields(f), short_name: (s(f, "short_name") ?? "").toUpperCase() });
    check(await supabase.from("teams").insert({
      ...v, tournament_id: tid, city: s(f, "city"), description: s(f, "description"), color: s(f, "color"),
      logo_url: await upload(f, "logo", "reg"), docs_url: await upload(f, "docs", "reg"),
    }));
    return `/t/${tid}/status?${new URLSearchParams({ team: v.short_name, email: v.owner_email })}`;
  });
}

export async function registerPlayer(tid: string, f: FormData) {
  return run(async () => {
    const supabase = await supabaseServer(); // public form: no login
    const v = playerSchema.parse(fields(f));
    const id = crypto.randomUUID(); // anon cannot read the new row back, so derive the reg code here (same rule as the DB trigger)
    const photo = await upload(f, "photo", "reg");
    check(await supabase.from("players").insert({
      id, full_name: v.full_name, dob: v.dob, phone: v.phone, role: v.role, tournament_id: tid,
      email: s(f, "email"), city: s(f, "city"), state: s(f, "state"),
      batting_style: s(f, "batting_style"), bowling_style: s(f, "bowling_style"), jersey_no: v.jersey_no ? +v.jersey_no : null,
      previous_teams: s(f, "previous_teams"), experience: s(f, "experience"), bat_stats: s(f, "bat_stats"),
      bowl_stats: s(f, "bowl_stats"), keeper_exp: s(f, "keeper_exp"), base_price: v.base_price ? +v.base_price : 0,
      available: f.get("available") === "on", is_overseas: f.get("is_overseas") === "on", photo_url: photo,
    }));
    const code = "PL-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
    return `/t/${tid}/status?${new URLSearchParams({ code, phone: v.phone })}`;
  });
}

export async function setCategory(id: string, tid: string, f: FormData) {
  const { supabase } = await need();
  check(await supabase.from("players").update({ category: s(f, "category") ?? "General" }).eq("id", id));
  revalidatePath(`/t/${tid}`);
}

export async function createAuction(tid: string, f: FormData) {
  const { supabase } = await need();
  check(await supabase.from("auctions").insert({
    tournament_id: tid, name: s(f, "name"), starts_at: s(f, "starts_at"), base_price: n(f, "base_price") ?? 0,
    increment: n(f, "increment") ?? 0, timer_secs: n(f, "timer_secs") ?? 30, reset_secs: n(f, "reset_secs") ?? 15,
  }));
  revalidatePath(`/t/${tid}`);
}

export async function createMatch(tid: string, f: FormData) {
  const { supabase } = await need();
  check(await supabase.from("matches").insert({
    tournament_id: tid, team_a: s(f, "team_a"), team_b: s(f, "team_b"), scheduled_at: s(f, "scheduled_at"),
    venue: s(f, "venue"), umpires: s(f, "umpires"),
  }));
  revalidatePath(`/t/${tid}`);
}

export async function addAward(tid: string, f: FormData) {
  const { supabase } = await need();
  check(await supabase.from("awards").insert({ tournament_id: tid, title: s(f, "title"), player_id: s(f, "player_id") }));
  revalidatePath(`/t/${tid}`);
}

export async function retain(tid: string, f: FormData) {
  const { supabase } = await need();
  check(await supabase.rpc("retain_player", { p_player: s(f, "player_id"), p_team: s(f, "team_id"), p_price: n(f, "price") ?? 0 }));
  revalidatePath(`/t/${tid}`);
}

export async function markRead() {
  const { supabase, user } = await need();
  check(await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false));
  revalidatePath("/notifications");
}
