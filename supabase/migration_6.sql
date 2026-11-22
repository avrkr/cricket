-- Run after migration_5.sql (already applied to the live project). Makes tournament deletion cascade cleanly.
alter table ball_events drop constraint ball_events_batting_team_fkey, add constraint ball_events_batting_team_fkey foreign key (batting_team) references teams on delete cascade;
alter table ball_events drop constraint ball_events_batter_id_fkey, add constraint ball_events_batter_id_fkey foreign key (batter_id) references players on delete set null;
alter table ball_events drop constraint ball_events_bowler_id_fkey, add constraint ball_events_bowler_id_fkey foreign key (bowler_id) references players on delete set null;
alter table matches drop constraint matches_team_a_fkey, add constraint matches_team_a_fkey foreign key (team_a) references teams on delete cascade;
alter table matches drop constraint matches_team_b_fkey, add constraint matches_team_b_fkey foreign key (team_b) references teams on delete cascade;
alter table matches drop constraint matches_winner_id_fkey, add constraint matches_winner_id_fkey foreign key (winner_id) references teams on delete set null;
alter table awards drop constraint awards_player_id_fkey, add constraint awards_player_id_fkey foreign key (player_id) references players on delete set null;
alter table players drop constraint players_team_id_fkey, add constraint players_team_id_fkey foreign key (team_id) references teams on delete set null;
