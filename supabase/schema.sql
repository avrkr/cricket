-- Run once in Supabase SQL editor. Money = whole currency units (bigint).
create type user_role as enum ('super_admin','organizer','team_owner','player','scorer','spectator');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text, role user_role not null default 'spectator', created_at timestamptz default now());

create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id, full_name, role) values (new.id, new.raw_user_meta_data->>'full_name',
    case when new.raw_user_meta_data->>'role' in ('team_owner','player','spectator')
         then (new.raw_user_meta_data->>'role')::user_role else 'spectator' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function my_role() returns user_role language sql stable security definer set search_path=public as
$$ select role from profiles where id = auth.uid() $$;

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references profiles(id),
  name text not null, description text, location text,
  start_date date, end_date date,
  format text not null default 'T20' check (format in ('T10','T20','ODI','Test','Custom')),
  num_teams int not null default 8, budget bigint not null default 100000000,
  min_squad int not null default 11, max_squad int not null default 18,
  status text not null default 'registration' check (status in ('draft','registration','auction','live','completed')),
  logo_url text, banner_url text, created_at timestamptz default now());

create function can_manage(t uuid) returns boolean language sql stable security definer set search_path=public as
$$ select coalesce(my_role()='super_admin', false)
       or exists(select 1 from tournaments where id=t and organizer_id=auth.uid()) $$;

create table teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete cascade,
  owner_id uuid not null references profiles(id),
  name text not null, short_name text not null, owner_name text, owner_email text, owner_phone text,
  city text, description text, color text default '#16a34a', logo_url text, docs_url text,
  initial_purse bigint not null default 0, purse bigint not null default 0 check (purse >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  unique (tournament_id, owner_id), unique (tournament_id, short_name));

create table players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete cascade,
  user_id uuid not null references profiles(id),
  reg_code text unique, full_name text not null, dob date not null, photo_url text,
  phone text not null, email text, city text, state text,
  role text not null check (role in ('Batsman','Bowler','All-rounder','Wicketkeeper')),
  batting_style text, bowling_style text, jersey_no int, previous_teams text, experience text,
  bat_stats text, bowl_stats text, keeper_exp text,
  base_price bigint not null default 0, available boolean not null default true, category text default 'General',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  auction_status text not null default 'available' check (auction_status in ('available','sold','unsold','cancelled')),
  team_id uuid references teams, sold_price bigint, skipped_at timestamptz, created_at timestamptz default now(),
  unique (tournament_id, user_id), unique (tournament_id, phone));

-- Guard: only organizers may touch workflow/money columns. RPCs set app.bypass.
create function guard_row() returns trigger language plpgsql security definer set search_path=public as $$
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
      if not mgr then new.status:='pending'; new.auction_status:='available'; new.team_id:=null; new.sold_price:=null; new.category:='General'; end if;
    elsif not mgr then
      new.status:=old.status; new.auction_status:=old.auction_status; new.team_id:=old.team_id; new.sold_price:=old.sold_price;
      new.category:=old.category; new.reg_code:=old.reg_code; new.user_id:=old.user_id; new.skipped_at:=old.skipped_at;
    end if;
  end if;
  return new;
end $$;
create trigger teams_guard before insert or update on teams for each row execute function guard_row();
create trigger players_guard before insert or update on players for each row execute function guard_row();

create function guard_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin if coalesce(my_role()<>'super_admin', true) and auth.uid() is not null then new.role := old.role; end if; return new; end $$;
create trigger profiles_guard before update on profiles for each row execute function guard_profile();

create table auctions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete cascade,
  name text not null, starts_at timestamptz,
  base_price bigint not null default 0, increment bigint not null default 100000,
  timer_secs int not null default 30, reset_secs int not null default 15,
  status text not null default 'scheduled' check (status in ('scheduled','live','paused','closed')),
  round int not null default 1,
  current_player_id uuid references players, current_team_id uuid references teams,
  current_bid bigint, ends_at timestamptz, paused_left int, created_at timestamptz default now());

create table bids (
  id bigserial primary key, auction_id uuid not null references auctions on delete cascade,
  player_id uuid not null references players, team_id uuid not null references teams,
  amount bigint not null, created_at timestamptz default now());

create table auction_events (
  id bigserial primary key, auction_id uuid not null references auctions on delete cascade,
  type text not null, payload jsonb default '{}', created_at timestamptz default now());
create function immutable() returns trigger language plpgsql as $$ begin raise exception 'auction_events is append-only'; end $$;
create trigger events_immutable before update or delete on auction_events for each row execute function immutable();

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete cascade,
  team_a uuid not null references teams, team_b uuid not null references teams check (team_a <> team_b),
  scheduled_at timestamptz, venue text, umpires text, scorer_id uuid references profiles,
  status text not null default 'scheduled' check (status in ('scheduled','live','completed')),
  winner_id uuid references teams, result text);

create table ball_events (
  id bigserial primary key, match_id uuid not null references matches on delete cascade,
  innings int not null default 1, batting_team uuid references teams,
  runs int not null default 0, extra_type text check (extra_type in ('wide','noball','bye','legbye')),
  extra_runs int not null default 0, is_wicket boolean not null default false,
  batter text, bowler text, note text, created_at timestamptz default now());

create table awards (
  id uuid primary key default gen_random_uuid(), tournament_id uuid not null references tournaments on delete cascade,
  title text not null, player_id uuid references players, created_at timestamptz default now());

create view points_table with (security_invoker=true) as
select t.id team_id, t.tournament_id, t.name, t.short_name,
  count(m.id) played,
  count(m.id) filter (where m.winner_id = t.id) won,
  count(m.id) filter (where m.winner_id is not null and m.winner_id <> t.id) lost,
  count(m.id) filter (where m.winner_id is null) no_result,
  2*count(m.id) filter (where m.winner_id = t.id) + count(m.id) filter (where m.winner_id is null) points
from teams t left join matches m on m.status='completed' and t.id in (m.team_a, m.team_b)
where t.status='approved' group by t.id;

create function can_score(m uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from matches where id=m and (scorer_id=auth.uid() or can_manage(tournament_id))) $$;

-- ===== RLS =====
alter table profiles enable row level security; alter table tournaments enable row level security;
alter table teams enable row level security; alter table players enable row level security;
alter table auctions enable row level security; alter table bids enable row level security;
alter table auction_events enable row level security; alter table matches enable row level security;
alter table ball_events enable row level security; alter table awards enable row level security;

create policy p_sel on profiles for select using (id = auth.uid() or my_role()='super_admin');
create policy p_upd on profiles for update using (id = auth.uid() or my_role()='super_admin');

create policy t_sel on tournaments for select using (true);
create policy t_ins on tournaments for insert with check (my_role() in ('organizer','super_admin') and organizer_id = auth.uid());
create policy t_upd on tournaments for update using (can_manage(id));
create policy t_del on tournaments for delete using (can_manage(id));

create policy tm_sel on teams for select using (status='approved' or owner_id=auth.uid() or can_manage(tournament_id));
create policy tm_ins on teams for insert with check (owner_id=auth.uid() and my_role()='team_owner');
create policy tm_upd on teams for update using (owner_id=auth.uid() or can_manage(tournament_id));

create policy pl_sel on players for select using (status='approved' or user_id=auth.uid() or can_manage(tournament_id));
create policy pl_ins on players for insert with check (user_id=auth.uid() and my_role()='player');
create policy pl_upd on players for update using (user_id=auth.uid() or can_manage(tournament_id));

create policy a_sel on auctions for select using (true);
create policy a_ins on auctions for insert with check (can_manage(tournament_id) and status='scheduled');
create policy b_sel on bids for select using (true);
create policy e_sel on auction_events for select using (true);   -- writes only via RPC

create policy m_sel on matches for select using (true);
create policy m_ins on matches for insert with check (can_manage(tournament_id));
create policy m_upd on matches for update using (can_manage(tournament_id));
create policy be_sel on ball_events for select using (true);
create policy be_ins on ball_events for insert with check (can_score(match_id));
create policy be_del on ball_events for delete using (can_score(match_id));
create policy aw_sel on awards for select using (true);
create policy aw_all on awards for all using (can_manage(tournament_id)) with check (can_manage(tournament_id));

-- ===== Auction RPCs (all validation server-side) =====
create function server_now() returns timestamptz language sql stable as $$ select now() $$;

create function auction_ev(a uuid, t text, p jsonb default '{}') returns void language sql as
$$ insert into auction_events(auction_id,type,payload) values (a,t,p) $$;

create function place_bid(p_auction uuid, p_team uuid, p_amount bigint) returns void
language plpgsql security definer set search_path=public as $$
declare a auctions; t teams; tr tournaments; cnt int; need int;
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
  need := greatest(tr.min_squad - cnt - 1, 0);
  if t.purse - p_amount < need * a.base_price then raise exception 'Must keep purse for remaining squad slots'; end if;
  insert into bids(auction_id,player_id,team_id,amount) values (p_auction,a.current_player_id,p_team,p_amount);
  update auctions set current_bid=p_amount, current_team_id=p_team,
    ends_at = greatest(ends_at, now() + make_interval(secs => reset_secs)) where id=p_auction;
  perform auction_ev(p_auction,'bid',jsonb_build_object('team',p_team,'amount',p_amount,'player',a.current_player_id));
end $$;

-- Anyone may call once the timer expired (idempotent, row-locked); managers may force.
create function auction_resolve(p_auction uuid) returns void language plpgsql security definer set search_path=public as $$
declare a auctions;
begin
  select * into a from auctions where id=p_auction for update;
  if not found or a.status<>'live' or a.current_player_id is null then return; end if;
  if a.ends_at > now() and not can_manage(a.tournament_id) then return; end if;
  perform set_config('app.bypass','1',true);
  if a.current_team_id is not null then
    update teams set purse = purse - a.current_bid where id=a.current_team_id;
    update players set auction_status='sold', team_id=a.current_team_id, sold_price=a.current_bid where id=a.current_player_id;
    perform auction_ev(p_auction,'sold',jsonb_build_object('player',a.current_player_id,'team',a.current_team_id,'amount',a.current_bid));
  else
    update players set auction_status='unsold' where id=a.current_player_id;
    perform auction_ev(p_auction,'unsold',jsonb_build_object('player',a.current_player_id));
  end if;
  update auctions set current_player_id=null,current_team_id=null,current_bid=null,ends_at=null where id=p_auction;
end $$;

create function auction_next(p_auction uuid) returns void language plpgsql security definer set search_path=public as $$
declare a auctions; p players;
begin
  select * into a from auctions where id=p_auction for update;
  if not can_manage(a.tournament_id) then raise exception 'Forbidden'; end if;
  if a.status<>'live' then raise exception 'Auction is not live'; end if;
  if a.current_player_id is not null then raise exception 'Resolve the current player first'; end if;
  select * into p from players where tournament_id=a.tournament_id and status='approved' and available
    and auction_status='available' order by skipped_at nulls first, created_at limit 1 for update skip locked;
  if not found then raise exception 'No eligible players left'; end if;
  update auctions set current_player_id=p.id, current_team_id=null, current_bid=greatest(p.base_price,a.base_price),
    ends_at=now()+make_interval(secs=>timer_secs) where id=p_auction;
  perform auction_ev(p_auction,'player_up',jsonb_build_object('player',p.id));
end $$;

create function auction_control(p_auction uuid, p_action text, p_secs int default 0) returns void
language plpgsql security definer set search_path=public as $$
declare a auctions;
begin
  select * into a from auctions where id=p_auction for update;
  if not found or not can_manage(a.tournament_id) then raise exception 'Forbidden'; end if;
  perform set_config('app.bypass','1',true);
  case p_action
    when 'start' then
      if a.status<>'scheduled' then raise exception 'Already started'; end if;
      update auctions set status='live' where id=p_auction;
      update tournaments set status='auction' where id=a.tournament_id;
    when 'pause' then
      if a.status<>'live' then raise exception 'Not live'; end if;
      update auctions set status='paused', paused_left=greatest(extract(epoch from ends_at-now())::int,0) where id=p_auction;
    when 'resume' then
      if a.status<>'paused' then raise exception 'Not paused'; end if;
      update auctions set status='live', ends_at=case when current_player_id is null then null else now()+make_interval(secs=>coalesce(paused_left,0)) end,
        paused_left=null where id=p_auction;
    when 'extend' then
      if a.status<>'live' or a.current_player_id is null then raise exception 'No player on the block'; end if;
      update auctions set ends_at=ends_at+make_interval(secs=>p_secs) where id=p_auction;
    when 'skip' then
      update players set skipped_at=now() where id=a.current_player_id;
      update auctions set current_player_id=null,current_team_id=null,current_bid=null,ends_at=null where id=p_auction;
    when 'cancel' then
      update players set auction_status='cancelled' where id=a.current_player_id;
      update auctions set current_player_id=null,current_team_id=null,current_bid=null,ends_at=null where id=p_auction;
    when 'sold' then
      if a.current_team_id is null then raise exception 'No bids to sell to'; end if;
      perform auction_resolve(p_auction);
    when 'unsold' then
      update auctions set current_team_id=null where id=p_auction; perform auction_resolve(p_auction);
    when 'round2' then
      update players set auction_status='available', skipped_at=null where tournament_id=a.tournament_id and auction_status='unsold';
      update auctions set round=round+1 where id=p_auction;
    when 'close' then
      update auctions set status='closed',current_player_id=null,current_team_id=null,current_bid=null,ends_at=null where id=p_auction;
    else raise exception 'Unknown action';
  end case;
  perform auction_ev(p_auction,'control_'||p_action,jsonb_build_object('secs',p_secs));
end $$;

-- ===== Matches =====
create function assign_scorer(p_match uuid, p_email text) returns void language plpgsql security definer set search_path=public as $$
declare m matches; u uuid;
begin
  select * into m from matches where id=p_match;
  if not can_manage(m.tournament_id) then raise exception 'Forbidden'; end if;
  select id into u from auth.users where lower(email)=lower(p_email);
  if u is null then raise exception 'No user with that email'; end if;
  update profiles set role='scorer' where id=u and role in ('spectator','player');
  update matches set scorer_id=u where id=p_match;
end $$;

create function match_finish(p_match uuid, p_winner uuid, p_result text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not can_score(p_match) then raise exception 'Forbidden'; end if;
  update matches set status='completed', winner_id=p_winner, result=p_result where id=p_match;
end $$;

-- ===== Realtime + storage =====
alter publication supabase_realtime add table auctions, bids, auction_events, teams, players, ball_events, matches;
insert into storage.buckets(id,name,public) values ('media','media',true) on conflict do nothing;
create policy media_read on storage.objects for select using (bucket_id='media');
create policy media_write on storage.objects for insert to authenticated
  with check (bucket_id='media' and (storage.foldername(name))[1] = auth.uid()::text);
