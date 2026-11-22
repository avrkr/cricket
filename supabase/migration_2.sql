-- Run after schema.sql. Adds overseas limit, retention, notifications, plans, NRR, player stats, per-match scorers.

-- ===== Overseas + retention =====
alter table tournaments add column overseas_limit int, add column max_retentions int not null default 0;
alter table players add column is_overseas boolean not null default false, add column is_retained boolean not null default false;

create or replace function guard_row() returns trigger language plpgsql security definer set search_path=public as $$
declare mgr boolean := current_setting('app.bypass', true) = '1' or can_manage(new.tournament_id);
begin
  if tg_table_name = 'teams' then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      select budget into new.initial_purse from tournaments where id = new.tournament_id;
      new.purse := new.initial_purse;
    elsif not mgr then
      new.status := old.status; new.purse := old.purse; new.initial_purse := old.initial_purse; new.owner_id := old.owner_id;
    end if;
  else
    if tg_op = 'INSERT' then
      new.reg_code := 'PL-' || upper(substr(replace(new.id::text,'-',''),1,8));
      if not mgr then new.status:='pending'; new.auction_status:='available'; new.team_id:=null; new.sold_price:=null; new.category:='General'; new.is_retained:=false; end if;
    elsif not mgr then
      new.status:=old.status; new.auction_status:=old.auction_status; new.team_id:=old.team_id; new.sold_price:=old.sold_price;
      new.category:=old.category; new.reg_code:=old.reg_code; new.user_id:=old.user_id; new.skipped_at:=old.skipped_at; new.is_retained:=old.is_retained;
    end if;
  end if;
  return new;
end $$;

create or replace function place_bid(p_auction uuid, p_team uuid, p_amount bigint) returns void
language plpgsql security definer set search_path=public as $$
declare a auctions; t teams; tr tournaments; cnt int; need int; pl players; os int;
begin
  select * into a from auctions where id=p_auction for update;
  if not found or a.status<>'live' or a.current_player_id is null then raise exception 'Bidding is not open'; end if;
  if a.ends_at <= now() then raise exception 'Time is up'; end if;
  select * into t from teams where id=p_team for update;
  if not found or t.owner_id<>auth.uid() or t.tournament_id<>a.tournament_id or t.status<>'approved'
    then raise exception 'Not your team'; end if;
  if a.current_team_id = p_team then raise exception 'You already hold the highest bid'; end if;
  if a.current_team_id is null and p_amount < a.current_bid then raise exception 'Bid too low'; end if;
  if a.current_team_id is not null and p_amount < a.current_bid + a.increment then raise exception 'Bid too low'; end if;
  if p_amount > t.purse then raise exception 'Insufficient purse'; end if;
  select * into tr from tournaments where id=a.tournament_id;
  select count(*) into cnt from players where team_id=p_team;
  if cnt >= tr.max_squad then raise exception 'Squad is full'; end if;
  select * into pl from players where id=a.current_player_id;
  if pl.is_overseas and tr.overseas_limit is not null then
    select count(*) into os from players where team_id=p_team and is_overseas;
    if os >= tr.overseas_limit then raise exception 'Overseas player limit reached'; end if;
  end if;
  need := greatest(tr.min_squad - cnt - 1, 0);
  if t.purse - p_amount < need * a.base_price then raise exception 'Must keep purse for remaining squad slots'; end if;
  insert into bids(auction_id,player_id,team_id,amount) values (p_auction,a.current_player_id,p_team,p_amount);
  update auctions set current_bid=p_amount, current_team_id=p_team,
    ends_at = greatest(ends_at, now() + make_interval(secs => reset_secs)) where id=p_auction;
  perform auction_ev(p_auction,'bid',jsonb_build_object('team',p_team,'amount',p_amount,'player',a.current_player_id));
end $$;

create function retain_player(p_player uuid, p_team uuid, p_price bigint) returns void
language plpgsql security definer set search_path=public as $$
declare pl players; t teams; tr tournaments; n int;
begin
  select * into pl from players where id=p_player for update;
  if not found or not can_manage(pl.tournament_id) then raise exception 'Forbidden'; end if;
  select * into t from teams where id=p_team for update;
  if t.tournament_id<>pl.tournament_id or t.status<>'approved' then raise exception 'Invalid team'; end if;
  if pl.status<>'approved' or pl.auction_status<>'available' then raise exception 'Player not available'; end if;
  select * into tr from tournaments where id=pl.tournament_id;
  select count(*) into n from players where team_id=p_team and is_retained;
  if n >= tr.max_retentions then raise exception 'Retention limit reached'; end if;
  if p_price > t.purse then raise exception 'Insufficient purse'; end if;
  perform set_config('app.bypass','1',true);
  update teams set purse=purse-p_price where id=p_team;
  update players set auction_status='sold', team_id=p_team, sold_price=p_price, is_retained=true where id=p_player;
end $$;

-- ===== Scorer is per match: do not change the user's global role =====
create or replace function assign_scorer(p_match uuid, p_email text) returns void language plpgsql security definer set search_path=public as $$
declare m matches; u uuid;
begin
  select * into m from matches where id=p_match;
  if not can_manage(m.tournament_id) then raise exception 'Forbidden'; end if;
  select id into u from auth.users where lower(email)=lower(p_email);
  if u is null then raise exception 'No user with that email'; end if;
  update matches set scorer_id=u where id=p_match;
end $$;

-- ===== Notifications =====
create table notifications (
  id bigserial primary key, user_id uuid not null references profiles(id) on delete cascade,
  title text not null, body text, link text, read boolean not null default false, created_at timestamptz default now());
alter table notifications enable row level security;
create policy n_sel on notifications for select using (user_id = auth.uid());
create policy n_upd on notifications for update using (user_id = auth.uid());
alter publication supabase_realtime add table notifications;

create function notify(u uuid, t text, b text, l text) returns void language sql security definer set search_path=public as
$$ insert into notifications(user_id,title,body,link) values (u,t,b,l) $$;
revoke execute on function notify from public, anon, authenticated;

create function trg_notify() returns trigger language plpgsql security definer set search_path=public as $$
declare org uuid; who uuid; label text; link text := '/t/' || new.tournament_id;
begin
  if tg_table_name='teams' then who:=new.owner_id; label:=new.name; else who:=new.user_id; label:=new.full_name; end if;
  select organizer_id into org from tournaments where id=new.tournament_id;
  if tg_op='INSERT' then
    perform notify(org, 'New '||rtrim(tg_table_name,'s')||' registration', label, link);
  else
    if old.status<>new.status then perform notify(who, rtrim(initcap(tg_table_name),'s')||' registration '||new.status, label, link); end if;
    if tg_table_name='players' and old.auction_status<>new.auction_status and new.auction_status in ('sold','unsold') then
      perform notify(who, 'Auction result: '||new.auction_status, label||coalesce(' · '||new.sold_price,''), link);
    end if;
  end if;
  return new;
end $$;
create trigger teams_notify after insert or update on teams for each row execute function trg_notify();
create trigger players_notify after insert or update on players for each row execute function trg_notify();

create function trg_notify_scorer() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.scorer_id is not null and new.scorer_id is distinct from old.scorer_id then
    perform notify(new.scorer_id, 'You were assigned to score a match', null, '/score/'||new.id);
  end if; return new;
end $$;
create trigger matches_notify after update on matches for each row execute function trg_notify_scorer();

-- ===== Subscription plans (no plan = unlimited) =====
create table plans (id uuid primary key default gen_random_uuid(), name text not null, price bigint not null default 0, max_tournaments int not null);
alter table plans enable row level security;
create policy plans_sel on plans for select using (true);
create policy plans_all on plans for all using (my_role()='super_admin') with check (my_role()='super_admin');
alter table profiles add column plan_id uuid references plans;

create function enforce_plan() returns trigger language plpgsql security definer set search_path=public as $$
declare cap int;
begin
  select p.max_tournaments into cap from profiles u join plans p on p.id=u.plan_id where u.id=new.organizer_id;
  if cap is not null and (select count(*) from tournaments where organizer_id=new.organizer_id) >= cap then
    raise exception 'Your plan allows % tournaments', cap; end if;
  return new;
end $$;
create trigger tournaments_plan before insert on tournaments for each row execute function enforce_plan();

-- ===== Scoring detail, NRR, player stats =====
alter table ball_events add column batter_id uuid references players, add column bowler_id uuid references players, add column wicket_kind text;

create view innings_totals with (security_invoker=true) as
select match_id, batting_team team_id, innings, sum(runs+extra_runs) runs,
  count(*) filter (where extra_type is null or extra_type in ('bye','legbye')) balls
from ball_events where batting_team is not null group by match_id, batting_team, innings;

drop view points_table;
-- shortcut: NRR ignores the "all out = full quota of overs" rule; upgrade if the league needs it.
create view points_table with (security_invoker=true) as
with f as (
  select i.team_id, i.runs rf, i.balls bf, o.runs ra, o.balls bb
  from matches m join innings_totals i on i.match_id=m.id join innings_totals o on o.match_id=m.id and o.team_id<>i.team_id
  where m.status='completed'),
n as (select team_id, sum(rf) rf, sum(bf) bf, sum(ra) ra, sum(bb) bb from f group by team_id)
select t.id team_id, t.tournament_id, t.name, t.short_name,
  count(m.id) played,
  count(m.id) filter (where m.winner_id = t.id) won,
  count(m.id) filter (where m.winner_id is not null and m.winner_id <> t.id) lost,
  count(m.id) filter (where m.winner_id is null) no_result,
  2*count(m.id) filter (where m.winner_id = t.id) + count(m.id) filter (where m.winner_id is null) points,
  round(coalesce(n.rf*6.0/nullif(n.bf,0) - n.ra*6.0/nullif(n.bb,0), 0), 3) nrr
from teams t left join matches m on m.status='completed' and t.id in (m.team_a, m.team_b)
left join n on n.team_id=t.id
where t.status='approved' group by t.id, n.rf, n.bf, n.ra, n.bb;

create view player_stats with (security_invoker=true) as
select p.id player_id, p.tournament_id, p.full_name, p.team_id,
  coalesce(b.runs,0) runs, coalesce(b.balls,0) balls_faced, coalesce(b.fours,0) fours, coalesce(b.sixes,0) sixes, coalesce(b.outs,0) dismissals,
  coalesce(w.wkts,0) wickets, coalesce(w.runs,0) runs_conceded, coalesce(w.balls,0) balls_bowled
from players p
left join (select batter_id, sum(runs) runs, count(*) filter (where extra_type is distinct from 'wide') balls,
    count(*) filter (where runs=4 and extra_type is null) fours, count(*) filter (where runs=6 and extra_type is null) sixes,
    count(*) filter (where is_wicket) outs from ball_events where batter_id is not null group by batter_id) b on b.batter_id=p.id
left join (select bowler_id, sum(runs + case when extra_type in ('wide','noball') then extra_runs else 0 end) runs,
    count(*) filter (where extra_type is null or extra_type in ('bye','legbye')) balls,
    count(*) filter (where is_wicket and coalesce(wicket_kind,'')<>'run out') wkts from ball_events where bowler_id is not null group by bowler_id) w on w.bowler_id=p.id
where p.status='approved';
