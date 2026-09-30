-- Fill the derived tables (see the end of schema.sql). Run by db/load.js after
-- the CSVs are loaded; the aggregates are the ones the pages used to compute
-- on every request. A box-score row with no minutes is a game the player was
-- listed for but didn't play: it counts nowhere below. Game ids from 20000000 up are regular
-- season, playoff and play-in games; preseason (1xxxxxxx) is left out.

TRUNCATE TABLE player_averages;
INSERT INTO player_averages
SELECT ps.player_id,
       AVG(ps.fgm), AVG(ps.fga), AVG(ps.fg_pct), AVG(ps.fg3m), AVG(ps.fg3a), AVG(ps.fg3_pct),
       AVG(ps.ftm), AVG(ps.fta), AVG(ps.ft_pct), AVG(ps.oreb), AVG(ps.dreb), AVG(ps.reb),
       AVG(ps.ast), AVG(ps.stl), AVG(ps.blk), AVG(ps.tov), AVG(ps.pf), AVG(ps.pts), AVG(ps.min),
       COUNT(ps.min)
FROM player_stats ps
JOIN players p ON ps.player_id = p.person_id
WHERE ps.game_id >= 20000000
GROUP BY ps.player_id;

TRUNCATE TABLE player_spread_totals;
INSERT INTO player_spread_totals
SELECT r.player_id, SUM(r.margin > 0), SUM(r.margin = 0), COUNT(*)
FROM (
    SELECT ps.player_id, g.pts - o.pts + IF(b.team_id = ps.team_id, b.spread1, b.spread2) AS margin
    FROM player_stats ps
    JOIN game_data g ON g.game_id = ps.game_id AND g.team_id = ps.team_id
    JOIN game_data o ON o.game_id = ps.game_id AND o.team_id = g.a_team_id
    JOIN betting_data b ON b.game_id = ps.game_id AND b.book_name = '5Dimes'
    WHERE ps.min IS NOT NULL AND ps.game_id >= 20000000
) r
WHERE r.margin IS NOT NULL
GROUP BY r.player_id;

-- The player's team's own moneyline decides whether it was the underdog and
-- what a winning $100 bet paid.
TRUNCATE TABLE player_underdog_totals;
INSERT INTO player_underdog_totals
SELECT r.player_id, COUNT(*), SUM(IF(r.wl = 'W', r.moneyline, -100)), SUM(r.wl = 'W'),
       SUM(POW(IF(r.wl = 'W', r.moneyline, -100), 2))
FROM (
    SELECT ps.player_id, g.wl, IF(b.team_id = ps.team_id, b.moneyline_price1, b.moneyline_price2) AS moneyline
    FROM player_stats ps
    JOIN game_data g ON g.game_id = ps.game_id AND g.team_id = ps.team_id
    JOIN betting_data b ON b.game_id = ps.game_id AND b.book_name = '5Dimes'
    WHERE ps.min IS NOT NULL AND ps.game_id >= 20000000
) r
WHERE r.moneyline > 0
GROUP BY r.player_id;
