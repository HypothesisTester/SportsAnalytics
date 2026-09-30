-- Fill the derived tables (see the end of schema.sql). Run by db/load.js after
-- the CSVs are loaded; the aggregates are the ones the pages used to compute
-- on every request.

TRUNCATE TABLE player_averages;
INSERT INTO player_averages
SELECT ps.player_id,
       AVG(ps.fgm), AVG(ps.fga), AVG(ps.fg_pct), AVG(ps.fg3m), AVG(ps.fg3a), AVG(ps.fg3_pct),
       AVG(ps.ftm), AVG(ps.fta), AVG(ps.ft_pct), AVG(ps.oreb), AVG(ps.dreb), AVG(ps.reb),
       AVG(ps.ast), AVG(ps.stl), AVG(ps.blk), AVG(ps.tov), AVG(ps.pf), AVG(ps.pts), AVG(ps.min),
       COUNT(ps.game_id)
FROM player_stats ps
JOIN players p ON ps.player_id = p.person_id
GROUP BY ps.player_id;

TRUNCATE TABLE player_spread_totals;
INSERT INTO player_spread_totals
SELECT ps.player_id,
       SUM(CASE
             WHEN ps.team_id = b.team_id THEN IF((g_home.pts + b.spread1) > g_away.pts, 1, 0)
             WHEN ps.team_id = b.a_team_id THEN IF((g_away.pts + b.spread2) > g_home.pts, 1, 0)
             ELSE 0
           END),
       COUNT(*)
FROM player_stats ps
JOIN betting_data b ON ps.game_id = b.game_id
JOIN game_data g_home ON b.game_id = g_home.game_id AND b.team_id = g_home.team_id
JOIN game_data g_away ON b.game_id = g_away.game_id AND b.a_team_id = g_away.team_id
WHERE b.book_name = '5Dimes'
GROUP BY ps.player_id;

TRUNCATE TABLE player_underdog_totals;
INSERT INTO player_underdog_totals
SELECT P.player_id,
       COUNT(P.game_id),
       SUM(IF(G.wl = 'W', IF(P.moneyline_price1 > 0, P.moneyline_price1, P.moneyline_price2), -100)),
       SUM(IF(G.wl = 'W', 1, 0))
FROM game_data G
JOIN (
    SELECT PS.team_id, PS.game_id, PS.player_id, B.moneyline_price1, B.moneyline_price2
    FROM player_stats PS
    JOIN betting_data B ON PS.game_id = B.game_id
        AND ((PS.team_id = B.team_id AND B.moneyline_price1 > 0) OR (PS.team_id = B.a_team_id AND B.moneyline_price2 > 0))
    WHERE B.book_name = '5Dimes'
) P ON P.team_id = G.team_id AND P.game_id = G.game_id
GROUP BY P.player_id;
