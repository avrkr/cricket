# Cricket Auction & Tournament App — User Manual

Three kinds of users: **Admin (organizer)**, **Team owner**, **Player**. Anyone (even signed-out) can watch live auctions and live scores.

Replace `<site>` with your deployed URL (or `http://localhost:3000` locally), and `<id>` with the tournament id.

---

## 1. Admin / Organizer

### Sign in & create a tournament
1. Open `<site>/login` and sign in with your admin email + password (role must be `organizer` or `super_admin`).
2. Go to `<site>/tournaments/new`, fill name, format, location, dates, purse (budget), squad min/max, overseas limit, retentions, banner → **Create**.
3. The tournament appears on the home page and at `<site>/t/<id>`.

### Manage registrations
- Players and teams register themselves from the tournament page. They show up in the lists on `/t/<id>`.
- Admin panel (top of the tournament page, visible only to you) shows **Team bidding links** — click **Copy bidding link** and send each link **privately** to its team owner. Never share one team's link with another.

### Run the auction
1. In the admin panel, **Configure auction**: name, date/time, base price, minimum bid increment, timer (s), reset-on-bid (s) → **Create auction**.
2. *(Optional)* **Retain a player** before the auction starts (if retentions are enabled).
3. Under **Auctions**, click **Control room** (`/t/<id>/auction/control?a=<auctionId>`). Controls:
   | Button | What it does |
   |---|---|
   | ▶ Start auction | Brings up the first player |
   | Place bid | Bid on behalf of a team (if needed) |
   | ⏸ Pause / ▶ Resume | Freeze / continue the clock |
   | +10s | Add time to the timer |
   | Mark sold / Mark unsold | Close the current player |
   | Skip | Move on without a result |
   | Cancel player | Withdraw the current player |
   | Close auction | End the whole auction |
4. Click **Public screen** to get the projector/TV view to show the room.

### Matches, scoring & awards
- **Schedule match**: pick Team A / Team B, date, venue, umpires.
- Under **Fixtures & results** click **Score match** (`/score/<matchId>`) to score ball by ball.
- **Publish award** to add awards (e.g. Player of the Tournament).
- The **Points table** updates automatically from results.

---

## 2. Team owner

1. Open `<site>/t/<id>/register-team`, enter team name, short name, owner email etc. → submit.
2. Check approval anytime: `/t/<id>/status` → **Team lookup** (team short name + owner email).
3. The organizer sends you a **private bidding link**: `<site>/t/<id>/auction/bid?code=XXXX`. Keep it secret — it *is* your login for bidding.
4. On auction day open that link. You'll see the current player, current price, your purse and squad. Press **Place bid** to bid (the price rises by the increment; the timer resets on each bid). You cannot bid if you lack purse or your squad is full.
5. Follow your squad and remaining purse live on the same page.

---

## 3. Player

1. Open `<site>/t/<id>/register-player`, fill in profile and stats → submit.
2. **Save your Registration ID** (`PL-…`) — shown after registering.
3. Check status anytime: `<site>/t/<id>/status` → **Player lookup** (Registration ID + mobile). It shows Registration ✔, auction status (available / sold / unsold) and, if sold, the winning team and price.
4. Your public profile is at `/t/<id>/players/<playerId>`; tournament leaderboards are at `/t/<id>/stats` (searchable by name).

---

## 4. Watching live (no login needed)

### Live auction & bidding
- On the tournament page, when an auction is running a pulsing **🔴 Watch live auction** button appears → `<site>/t/<id>/auction?a=<auctionId>`.
- You see: current player, current highest bid & bidding team, countdown timer, bid history, each team's remaining purse and squad. It updates in real time — no refresh needed.
- Past/upcoming auctions are listed as buttons on the tournament page.

### Live score
- On the tournament page, under **Fixtures & results**, press **Live score** next to a match (`<site>/score/<matchId>`). Completed matches show **Scorecard**.
- The **Points table** on the tournament page shows standings; **📊 Statistics** shows player stats.

---

## 5. Troubleshooting
| Problem | Fix |
|---|---|
| No admin panel | Sign in; your role must be organizer/super_admin and you must own the tournament |
| Bidding link says invalid | Re-copy it from the admin panel; the code is per team |
| Live page not updating | Refresh once; check internet (uses realtime connection) |
| Can't find my registration | Use exact Registration ID + same mobile (players) or short name + same email (teams) |

## 6. Deploy / run (for the developer)
```bash
cd cricket-app
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```
Needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`; SQL migrations are in `supabase/`. Deploy easily on Vercel by importing the GitHub repo and adding those two env vars.
