-- Run after migration_4.sql. The event log stays append-only for direct edits/deletes,
-- but may be removed when its auction/tournament is deleted (FK cascade runs at trigger depth > 1).
create or replace function immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'auction_events is append-only';
end $$;

-- scorer inserts into ball_events directly, so signed-in users need the id sequence
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;

-- remove the leftover end-to-end test tournament, if present
delete from tournaments where name = 'ZZ TEST';
