-- Run after migration_3.sql. Registrations are accepted automatically (no approve/reject step).
create or replace function guard_row() returns trigger language plpgsql security definer set search_path=public as $$
declare mgr boolean := current_setting('app.bypass', true) = '1' or can_manage(new.tournament_id);
begin
  if tg_table_name = 'teams' then
    if tg_op = 'INSERT' then
      new.status := 'approved';
      select budget into new.initial_purse from tournaments where id = new.tournament_id;
      new.purse := new.initial_purse;
    elsif not mgr then
      new.status := old.status; new.purse := old.purse; new.initial_purse := old.initial_purse; new.owner_id := old.owner_id;
    end if;
  else
    if tg_op = 'INSERT' then
      new.reg_code := 'PL-' || upper(substr(replace(new.id::text,'-',''),1,8));
      if not mgr then new.status:='approved'; new.auction_status:='available'; new.team_id:=null; new.sold_price:=null; new.category:='General'; new.is_retained:=false; end if;
    elsif not mgr then
      new.status:=old.status; new.auction_status:=old.auction_status; new.team_id:=old.team_id; new.sold_price:=old.sold_price;
      new.category:=old.category; new.reg_code:=old.reg_code; new.user_id:=old.user_id; new.skipped_at:=old.skipped_at; new.is_retained:=old.is_retained;
    end if;
  end if;
  return new;
end $$;

drop policy tm_ins on teams; drop policy pl_ins on players;
create policy tm_ins on teams for insert to anon, authenticated with check (status='approved');
create policy pl_ins on players for insert to anon, authenticated with check (status='approved' and auction_status='available');

alter table teams alter column status set default 'approved';
alter table players alter column status set default 'approved';
update teams set status='approved' where status='pending';
update players set status='approved' where status='pending';
