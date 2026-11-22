import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { session } from "@/lib/supabase/server";
import { markRead } from "@/app/actions";

export default async function Notifications() {
  const { supabase, user } = await session();
  if (!user) redirect("/login");
  const { data } = await supabase.from("notifications").select("*").order("id", { ascending: false }).limit(50);
  return (
    <div className="mx-auto max-w-xl space-y-2">
      <div className="flex items-center"><h1 className="flex-1 text-xl font-bold">Notifications</h1><form action={markRead}><SubmitButton className="btn-alt">Mark all read</SubmitButton></form></div>
      {!data?.length && <p className="text-slate-500">Nothing yet.</p>}
      {data?.map((n) => (
        <Link key={n.id} href={n.link ?? "#"} className={`card block text-sm ${n.read ? "" : "border-emerald-500"}`}>
          <b>{n.title}</b> <span className="text-slate-500">{n.body}</span>
          <div className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</div>
        </Link>))}
    </div>
  );
}
