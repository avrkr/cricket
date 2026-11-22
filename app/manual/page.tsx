import Link from "next/link";

export const metadata = { title: "User Manual — CricAuction" };

type Guide = { id: string; icon: string; title: string; tone: string; steps: [string, string][] };

const guides: Guide[] = [
  { id: "admin", icon: "👑", title: "Admin / Organizer", tone: "from-slate-800 to-slate-950", steps: [
    ["Sign in", "Use Admin login in the top bar. Your role must be organizer or super admin."],
    ["Create a tournament", "+ New tournament → name, format, dates, purse, squad size, overseas limit, retentions, banner."],
    ["Share bidding links", "On the tournament page, Admin panel → Team bidding links → Copy bidding link. Send each one privately to its team owner."],
    ["Configure the auction", "Name, date/time, base price, minimum increment, timer and reset-on-bid seconds → Create auction."],
    ["Run it from the Control room", "Start, Pause/Resume, +10s, Mark sold, Mark unsold, Skip, Cancel player, Close auction."],
    ["Show the room", "Open Public screen on a projector or TV for everyone to watch."],
    ["Matches & awards", "Schedule match, then Score match ball by ball. Publish awards. The points table updates itself."],
  ] },
  { id: "team", icon: "🛡️", title: "Team owner", tone: "from-emerald-600 to-teal-800", steps: [
    ["Register your team", "Home → Register your team. Enter team name, short name and owner email."],
    ["Check approval", "Check my status → Team lookup (team short name + owner email)."],
    ["Get your private link", "The organizer sends you …/auction/bid?code=XXXX. Keep it secret: it is your bidding login."],
    ["Bid on auction day", "Open the link, watch the current player and price, press Place bid. The timer resets on every bid."],
    ["Your team page", "Home → Teams → your team (or the team name on the tournament page) lists your squad automatically, with top run-scorer and top wicket-taker. No lookup needed."],
    ["Watch your purse", "Remaining purse and squad update live. You cannot bid without enough purse or if your squad is full."],
  ] },
  { id: "player", icon: "🏏", title: "Player", tone: "from-amber-400 to-orange-500", steps: [
    ["Register", "Home → Register as player. Fill in your profile and stats."],
    ["Save your Registration ID", "It looks like PL-… and is shown after you register."],
    ["Track your status", "Check my status → Player lookup (Registration ID + mobile). Shows available, sold or unsold, and the winning team and price."],
    ["Profile & stats", "Your public profile shows runs, balls, strike rate, average, fours, sixes, wickets and economy. Find it from your team page or 📊 Statistics."],
  ] },
  { id: "live", icon: "🔴", title: "Watch live score & bidding", tone: "from-red-600 to-rose-800", steps: [
    ["Live auction", "On the tournament page press 🔴 Watch live auction. Current player, highest bid, countdown, bid history and team purses update in real time. No login needed."],
    ["Live score", "Tournament page → Fixtures & results → Live score. Finished matches show Scorecard."],
    ["Standings", "The Points table on the tournament page updates after every result."],
    ["Browse teams", "Home → Teams. Tap a team to see its players, top run-scorer and top wicket-taker; tap any player for their full stats."],
    ["Statistics", "📊 Statistics shows top performers; search players by name."],
  ] },
];

export default function Manual() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-950 to-slate-950 p-8 text-white shadow-xl sm:p-12">
        <div className="absolute -right-4 -top-4 text-[12rem] leading-none opacity-15">📖</div>
        <span className="pill bg-amber-400 text-slate-900">USER MANUAL</span>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">How CricAuction works</h1>
        <p className="mt-2 max-w-xl text-emerald-100">Step-by-step guides for admins, team owners and players, plus how to follow the live score and bidding.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {guides.map((g) => <a key={g.id} href={`#${g.id}`} className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold transition hover:bg-white/25">{g.icon} {g.title}</a>)}
        </div>
      </section>

      {guides.map((g) => (
        <section key={g.id} id={g.id} className="scroll-mt-20 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className={`bg-gradient-to-br ${g.tone} px-6 py-5 text-white`}>
            <h2 className="flex items-center gap-3 text-2xl font-black tracking-tight"><span className="text-3xl">{g.icon}</span>{g.title}</h2>
          </div>
          <ol className="divide-y">
            {g.steps.map(([t, d], i) => (
              <li key={t} className="flex gap-4 p-5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-400 text-sm font-black text-slate-900">{i + 1}</span>
                <div><div className="font-bold">{t}</div><p className="text-sm text-slate-600">{d}</p></div>
              </li>))}
          </ol>
        </section>))}

      <div className="text-center"><Link href="/" className="btn">← Back to home</Link></div>
    </div>
  );
}
