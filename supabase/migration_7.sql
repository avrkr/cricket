-- Migration 7: no email / phone collected for teams and players.
-- Run once in the Supabase SQL editor.
alter table players alter column phone drop not null;
drop function if exists player_status(uuid, text, text);
drop function if exists team_status(uuid, text, text);

create function player_status(p_tid uuid, p_code text)
returns table(full_name text, reg_code text, status text, auction_status text, team text, sold_price bigint)
language sql stable security definer set search_path=public as
$$ select p.full_name, p.reg_code, p.status, p.auction_status, t.name, p.sold_price
   from players p left join teams t on t.id=p.team_id
   where p.tournament_id=p_tid and upper(p.reg_code)=upper(p_code) $$;

create function team_status(p_tid uuid, p_short text) returns table(name text, status text)
language sql stable security definer set search_path=public as
$$ select name, status from teams where tournament_id=p_tid and lower(short_name)=lower(p_short) $$;
grant execute on function player_status(uuid, text), team_status(uuid, text) to anon, authenticated;
