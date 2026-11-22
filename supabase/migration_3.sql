-- Run after migration_2.sql. Only the super admin has an account; players/teams register publicly,
-- and each approved team gets a secret bidding link (code).
alter table teams alter column owner_id drop not null;
alter table players alter column user_id drop not null;
alter table teams add constraint teams_email_uniq unique (tournament_id, owner_email);

create table team_secrets (team_id uuid primary key references teams on delete cascade,
  code text not null unique default replace(gen_random_uuid()::text,'-',''));
alter table team_secrets enable row level security;
create policy secrets_admin on team_secrets for select using (my_role()='super_admin');
create function trg_team_secret() returns trigger language plpgsql security definer set search_path=public as
$$ begin insert into team_secrets(team_id) values (new.id); return new; end $$;
create trigger teams_secret after insert on teams for each row execute function trg_team_secret();
insert into team_secrets(team_id) select id from teams on conflict do nothing;

drop policy tm_ins on teams; drop policy pl_ins on players;
create policy tm_ins on teams for insert to anon, authenticated with check (status='pending');
create policy pl_ins on players for insert to anon, authenticated with check (status='pending' and auction_status='available');

-- public uploads only into reg/ (5MB cap)
create policy media_reg on storage.objects for insert to anon with check (bucket_id='media' and (storage.foldername(name))[1]='reg');
update storage.buckets set file_size_limit=5242880 where id='media';

create or replace function trg_notify() returns trigger language plpgsql security definer set search_path=public as $$
declare org uuid; label text; link text := '/t/' || new.tournament_id;
begin
  if tg_table_name='teams' then label:=new.name; else label:=new.full_name; end if;
  select organizer_id into org from tournaments where id=new.tournament_id;
  if tg_op='INSERT' then perform notify(org, 'New '||rtrim(tg_table_name,'s')||' registration', label, link); end if;
  return new;
end $$;

drop function place_bid(uuid, uuid, bigint);
create function place_bid(p_auction uuid, p_code text, p_amount bigint) returns void
language plpgsql security definer set search_path=public as $$
declare a auctions; t teams; tr tournaments; cnt int; need int; pl players; os int; tid uuid;
begin
  select team_id into tid from team_secrets where code=p_code;
  if tid is null then raise exception 'Invalid team link'; end if;
  select * into a from auctions where id=p_auction for update;
  if not found or a.status<>'live' or a.current_player_id is null then raise exception 'Bidding is not open'; end if;
  if a.ends_at <= now() then raise exception 'Time is up'; end if;
  select * into t from teams where id=tid for update;
  if t.tournament_id<>a.tournament_id or t.status<>'approved' then raise exception 'Not your team'; end if;
  if a.current_team_id = tid then raise exception 'You already hold the highest bid'; end if;
  if a.current_team_id is null and p_amount < a.current_bid then raise exception 'Bid too low'; end if;
  if a.current_team_id is not null and p_amount < a.current_bid + a.increment then raise exception 'Bid too low'; end if;
  if p_amount > t.purse then raise exception 'Insufficient purse'; end if;
  select * into tr from tournaments where id=a.tournament_id;
  select count(*) into cnt from players where team_id=tid;
  if cnt >= tr.max_squad then raise exception 'Squad is full'; end if;
  select * into pl from players where id=a.current_player_id;
  if pl.is_overseas and tr.overseas_limit is not null then
    select count(*) into os from players where team_id=tid and is_overseas;
    if os >= tr.overseas_limit then raise exception 'Overseas player limit reached'; end if;
  end if;
  need := greatest(tr.min_squad - cnt - 1, 0);
  if t.purse - p_amount < need * a.base_price then raise exception 'Must keep purse for remaining squad slots'; end if;
  insert into bids(auction_id,player_id,team_id,amount) values (p_auction,a.current_player_id,tid,p_amount);
  update auctions set current_bid=p_amount, current_team_id=tid,
    ends_at = greatest(ends_at, now() + make_interval(secs => reset_secs)) where id=p_auction;
  perform auction_ev(p_auction,'bid',jsonb_build_object('team',tid,'amount',p_amount,'player',a.current_player_id));
end $$;

create function team_by_code(p_code text) returns table(id uuid, tournament_id uuid, name text, color text)
language sql stable security definer set search_path=public as
$$ select t.id, t.tournament_id, t.name, t.color from teams t join team_secrets s on s.team_id=t.id where s.code=p_code and t.status='approved' $$;

create function player_status(p_tid uuid, p_phone text, p_code text)
returns table(full_name text, reg_code text, status text, auction_status text, team text, sold_price bigint)
language sql stable security definer set search_path=public as
$$ select p.full_name, p.reg_code, p.status, p.auction_status, t.name, p.sold_price
   from players p left join teams t on t.id=p.team_id
   where p.tournament_id=p_tid and p.phone=p_phone and upper(p.reg_code)=upper(p_code) $$;

create function team_status(p_tid uuid, p_email text, p_short text) returns table(name text, status text)
language sql stable security definer set search_path=public as
$$ select name, status from teams where tournament_id=p_tid and lower(owner_email)=lower(p_email) and lower(short_name)=lower(p_short) $$;
