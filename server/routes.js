// API route handlers. Every value from the request reaches MySQL as a bound
// parameter (the `?` placeholders), never as part of the SQL text.

const { pool } = require('./db');

// ---------------------------------------------------------------- helpers

class BadRequest extends Error {}

/** A whole-number id from the URL, or a 400. */
function id(value) {
  if (!/^\d{1,12}$/.test(String(value))) throw new BadRequest(`Invalid id: ${value}`);
  return Number(value);
}

/** An optional number from the query string, or `fallback` when it is missing or not a number. */
function num(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function page(req) {
  return Math.max(1, Math.floor(num(req.query.page, 1)));
}

/** Run a query and send its rows: `emptyPayload` when there are none. */
function sendRows(sql, params, emptyPayload = []) {
  return async (req, res) => {
    const [rows] = await pool.query(sql, typeof params === 'function' ? params(req) : params);
    res.json(rows.length ? rows : emptyPayload);
  };
}

/** Wrap an async handler so a thrown BadRequest is a 400 and anything else a 500. */
function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
      console.error(err);
      // A failure may be temporary (e.g. the database was unreachable), so
      // don't let the CDN keep serving it for a day.
      res.removeHeader('Vercel-CDN-Cache-Control');
      res.set('Cache-Control', 'no-store');
      res.status(500).json({ error: 'Database query failed.' });
    }
  };
}

// ---------------------------------------------------------------- games

// GET /game/:game_id — both teams' rows, home team first.
const game = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT *
     FROM game_data G
     JOIN teams T ON G.team_id = T.team_id
     WHERE G.game_id = ?`,
    [id(req.params.game_id)],
  );
  if (rows.length < 2) return res.status(404).json({});
  if (rows[0].is_home === 'f') rows.reverse();
  res.json(rows);
};

// GET /game/:game_id/players — [home players, road players], most minutes first.
const game_players = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT P.display_first_last, G.is_home, PS.*
     FROM players P
     JOIN player_stats PS ON P.person_id = PS.player_id
     JOIN game_data G ON PS.game_id = G.game_id AND PS.team_id = G.team_id
     WHERE PS.game_id = ?
     ORDER BY PS.min DESC, PS.player_id`,
    [id(req.params.game_id)],
  );
  const output = [[], []];
  for (const row of rows) output[row.is_home === 't' ? 0 : 1].push(row);
  res.json(output);
};

// GET /game/:game_id/betting — every sportsbook's lines for the game.
const game_betting = (req, res) =>
  sendRows(`SELECT * FROM betting_data WHERE game_id = ? ORDER BY book_name`, [id(req.params.game_id)])(req, res);

// GET /game/:game_id/matchup_stats — aggregates over every meeting of the two teams.
const matchup_stats = (req, res) => {
  const g = id(req.params.game_id);
  return sendRows(
    `WITH win_loss AS (
        SELECT SUM(IF(G.wl = 'W', 1, 0)) AS team1_wins, SUM(IF(G.wl = 'L', 1, 0)) AS team2_wins,
               AVG(G.pts) AS avg_pts_team1, AVG(G2.pts) AS avg_pts_team2, COUNT(DISTINCT G.game_id) AS total_games
        FROM game_data G JOIN game_data G2 ON G.game_id = G2.game_id AND G.a_team_id = G2.team_id
        JOIN game_data GX ON G.team_id = GX.team_id AND G.a_team_id = GX.a_team_id
        WHERE GX.game_id = ? AND GX.team_id < GX.a_team_id
    ),
    betting_averages AS (
        SELECT AVG(IF(B.team_id = GX.team_id, B.spread1, B.spread2)) AS avg_spread_team1,
               AVG(IF(B.team_id = GX.a_team_id, B.spread1, B.spread2)) AS avg_spread_team2,
               AVG(B.total1) AS average_total,
               AVG(IF(B.team_id = GX.team_id, B.moneyline_price1, B.moneyline_price2)) AS avg_moneyline_price_team1,
               AVG(IF(B.team_id = GX.a_team_id, B.moneyline_price1, B.moneyline_price2)) AS avg_moneyline_price_team2
        FROM betting_data B
        JOIN game_data GX ON (B.team_id = GX.team_id AND B.a_team_id = GX.a_team_id)
            OR (B.team_id = GX.a_team_id AND B.a_team_id = GX.team_id)
        WHERE GX.game_id = ? AND GX.team_id < GX.a_team_id
    ),
    advanced_betting_stats AS (
        SELECT SUM(IF(B.team_id = G.team_id, IF((G.pts - G2.pts) > -1 * B.spread1, 1, 0),
                    IF((G2.pts - G.pts) > -1 * B.spread2, 1, 0))) AS spread_success_team1,
               SUM(IF(B.team_id = G.team_id, IF((G.pts - G2.pts) > -1 * B.spread1, 0, 1),
                    IF((G2.pts - G.pts) > -1 * B.spread2, 0, 1))) AS spread_success_team2,
               SUM(IF(B.team_id = G.team_id, IF(B.moneyline_price1 > 0 AND G.wl = 'W', 1, 0),
                    IF(B.moneyline_price2 > 0 AND G.wl = 'L', 1, 0))) AS underdog_wins_team1,
               SUM(IF(B.team_id = G2.team_id, IF(B.moneyline_price1 > 0 AND G2.wl = 'W', 1, 0),
                    IF(B.moneyline_price2 > 0 AND G2.wl = 'L', 1, 0))) AS underdog_wins_team2,
               SUM(IF(B.team_id = G.team_id, IF(G.wl = 'W',
                        IF(B.moneyline_price1 > 0, B.moneyline_price1, 10000 / B.moneyline_price1 * -1), -100),
                    IF(G.wl = 'L',
                        IF(B.moneyline_price2 > 0, B.moneyline_price2, 10000 / B.moneyline_price2 * -1), -100)))
                    AS total_money_team1,
               SUM(IF(B.team_id = G2.team_id, IF(G2.wl = 'W',
                        IF(B.moneyline_price1 > 0, B.moneyline_price1, 10000 / B.moneyline_price1 * -1), -100),
                    IF(G2.wl = 'L',
                        IF(B.moneyline_price2 > 0, B.moneyline_price2, 10000 / B.moneyline_price2 * -1), -100)))
                    AS total_money_team2,
               AVG(ABS((G2.pts - G.pts) - B.spread1)) AS average_spread_error
        FROM game_data G, game_data G2, betting_data B, game_data GX
        WHERE GX.game_id = ? AND GX.team_id < GX.a_team_id
            AND G.team_id = GX.team_id AND G.a_team_id = GX.a_team_id
            AND G.game_id = G2.game_id AND G.a_team_id = G2.team_id
            AND B.game_id = G.game_id
            AND ((B.team_id = G.team_id AND B.a_team_id = G.a_team_id)
                OR (B.team_id = G.a_team_id AND B.a_team_id = G.team_id))
            AND B.book_name = '5Dimes'
    )
    SELECT * FROM win_loss, betting_averages, advanced_betting_stats`,
    [g, g, g],
  )(req, res);
};

// GET /game/:game_id/matchup_top_pairs — opposing player pairs who score the
// biggest share of the points when these two teams meet (at least 3 meetings).
const matchup_top_pairs = (req, res) => {
  const g = id(req.params.game_id);
  return sendRows(
    `WITH total_games AS (
        SELECT PS1.player_id AS id1, PS2.player_id AS id2, COUNT(DISTINCT PS1.game_id) AS total_games
        FROM player_stats PS1 JOIN player_stats PS2 ON PS1.game_id = PS2.game_id AND PS1.team_id <> PS2.team_id
            JOIN game_data GX ON PS1.team_id = GX.team_id AND PS2.team_id = GX.a_team_id
        WHERE GX.game_id = ? AND GX.team_id < GX.a_team_id
            AND PS1.team_id = GX.team_id AND PS2.team_id = GX.a_team_id
        GROUP BY PS1.player_id, PS2.player_id
    )
    SELECT ANY_VALUE(P1.display_first_last) AS name1, ANY_VALUE(P2.display_first_last) AS name2,
           ANY_VALUE(TG.total_games) AS total_games, AVG((PS1.pts + PS2.pts) / (G1.pts + G2.pts)) AS avg_pct_pts
    FROM player_stats PS1 JOIN player_stats PS2 ON PS1.game_id = PS2.game_id AND PS1.team_id <> PS2.team_id
        JOIN game_data G1 ON PS1.game_id = G1.game_id AND PS1.team_id = G1.team_id
        JOIN game_data G2 ON PS1.game_id = G2.game_id AND PS2.team_id = G2.team_id
        JOIN players P1 ON PS1.player_id = P1.person_id
        JOIN players P2 ON PS2.player_id = P2.person_id
        JOIN total_games TG ON PS1.player_id = TG.id1 AND PS2.player_id = TG.id2
        JOIN game_data GX ON G1.team_id = GX.team_id AND G1.a_team_id = GX.a_team_id
    WHERE GX.game_id = ? AND GX.team_id < GX.a_team_id
        AND PS1.team_id = GX.team_id AND PS2.team_id = GX.a_team_id AND TG.total_games >= 3
    GROUP BY PS1.player_id, PS2.player_id
    ORDER BY avg_pct_pts DESC, PS1.player_id, PS2.player_id
    LIMIT 25`,
    [g, g],
  )(req, res);
};

// GET /game/search — games filtered by home team, away team (name or
// abbreviation), total points and season; 20 per page, newest first.
const game_search = async (req, res) => {
  const home = req.query['name-or-abbreviation1'] ? String(req.query['name-or-abbreviation1']) : null;
  const away = req.query['name-or-abbreviation2'] ? String(req.query['name-or-abbreviation2']) : null;
  const minPts = num(req.query['min-pts']);
  const minYear = num(req.query['min-year']);
  const maxYear = num(req.query['max-year']);
  const perPage = 20;
  const like = s => `%${s}%`;
  const [rows] = await pool.query(
    `SELECT g1.game_id, g1.team_id AS home_team_id, g1.a_team_id AS away_team_id,
            t.name AS home_team_name, t2.name AS away_team_name,
            t.abbreviation AS home_team_abbreviation, t2.abbreviation AS away_team_abbreviation,
            g1.pts AS home_team_pts, g2.pts AS away_team_pts, g1.season_year AS season_year, g1.game_date
     FROM game_data g1
     JOIN game_data g2 ON g1.a_team_id = g2.team_id AND g1.game_id = g2.game_id
     JOIN teams t ON g1.team_id = t.team_id
     JOIN teams t2 ON g2.team_id = t2.team_id
     WHERE g1.is_home = 't'
       AND (? IS NULL OR t.name LIKE ? OR t.abbreviation LIKE ?)
       AND (? IS NULL OR t2.name LIKE ? OR t2.abbreviation LIKE ?)
       AND (g1.pts + g2.pts) >= COALESCE(?, 0)
       AND (? IS NULL OR g1.season_year >= ?)
       AND (? IS NULL OR g1.season_year <= ?)
     ORDER BY g1.game_date DESC, g1.game_id DESC
     LIMIT ? OFFSET ?`,
    [
      home, like(home), like(home),
      away, like(away), like(away),
      minPts,
      minYear, minYear,
      maxYear, maxYear,
      perPage, (page(req) - 1) * perPage,
    ],
  );
  if (rows.length === 0) return res.status(404).json({ message: 'No results found' });
  res.json(rows);
};

// ---------------------------------------------------------------- players

// GET /player/search — players with career averages, 20 per page. With a
// name (2+ characters): matching names alphabetically; otherwise the players
// with the most games. Averages come from player_averages, precomputed when
// the data is loaded (db/derived.sql), instead of averaging 670k rows per request.
const player_search = async (req, res) => {
  const name = String(req.query.name || '').trim();
  const filter = name.length >= 2;
  const perPage = 20;
  const [rows] = await pool.query(
    `SELECT p.person_id, p.display_first_last, p.from_year, p.to_year, p.draft_year,
            p.height_feet, p.height_inches, p.weight, p.team_id AS team_id, p.jersey, p.school, p.country,
            a.fgm, a.fga, a.fg_pct, a.fg3m, a.fg3a, a.fg3_pct, a.ftm, a.fta, a.ft_pct,
            a.oreb, a.dreb, a.reb, a.ast, a.stl, a.blk, a.tov, a.pf, a.pts, a.min, a.games_played
     FROM player_averages a
     JOIN players p ON a.player_id = p.person_id
     ${filter ? 'WHERE p.display_first_last LIKE ?' : ''}
     ORDER BY ${filter ? 'p.display_first_last, p.person_id' : 'a.games_played DESC, p.person_id'}
     LIMIT ? OFFSET ?`,
    [...(filter ? [`%${name}%`] : []), perPage, (page(req) - 1) * perPage],
  );
  res.json(rows);
};

// GET /player/:player_id
const player_information = (req, res) =>
  sendRows(`SELECT * FROM players WHERE person_id = ?`, [id(req.params.player_id)])(req, res);

// GET /player/:player_id/games — the player's games, oldest first.
const games_for_player = (req, res) =>
  sendRows(
    `SELECT G.matchup, G.game_date, PS.*
     FROM game_data G JOIN player_stats PS ON G.game_id = PS.game_id AND G.team_id = PS.team_id
     WHERE PS.player_id = ?
     ORDER BY G.game_date, PS.game_id`,
    [id(req.params.player_id)],
  )(req, res);

// GET /player/:player_id/average_stats
const player_average_stats = (req, res) =>
  sendRows(
    `SELECT AVG(min) AS min, AVG(fgm) AS fgm, AVG(fga) AS fga, AVG(fg_pct) AS fg_pct, AVG(fg3m) AS fg3m,
            AVG(fg3a) AS fg3a, AVG(fg3_pct) AS fg3_pct, AVG(ftm) AS ftm, AVG(fta) AS fta, AVG(ft_pct) AS ft_pct,
            AVG(oreb) AS oreb, AVG(dreb) AS dreb, AVG(reb) AS reb, AVG(ast) AS ast, AVG(stl) AS stl,
            AVG(blk) AS blk, AVG(tov) AS tov, AVG(pf) AS pf, AVG(pts) AS pts, AVG(plus_minus) AS plus_minus
     FROM player_stats
     WHERE player_id = ?`,
    [id(req.params.player_id)],
  )(req, res);

// GET /player/:player_id/player_underdog — the player's record and returns
// when their team was the moneyline underdog (5Dimes lines, $100 stakes).
const player_underdog = (req, res) =>
  sendRows(
    `SELECT P.player_id, P2.display_first_last, P.total_games, P.total_money,
            P.total_money / P.total_games AS money_per_game, P.underdog_wins
     FROM players P2
     JOIN (
         SELECT P.player_id, COUNT(P.game_id) AS total_games,
                SUM(IF(G.wl = 'W', IF(P.moneyline_price1 > 0, P.moneyline_price1, P.moneyline_price2), -100)) AS total_money,
                SUM(IF(G.wl = 'W', 1, 0)) AS underdog_wins
         FROM game_data G
         JOIN (
             SELECT PS.team_id, PS.game_id, PS.player_id, B.moneyline_price1, B.moneyline_price2
             FROM player_stats PS
             JOIN betting_data B ON PS.game_id = B.game_id
                 AND ((PS.team_id = B.team_id AND B.moneyline_price1 > 0) OR (PS.team_id = B.a_team_id AND B.moneyline_price2 > 0))
             WHERE PS.player_id = ? AND B.book_name = '5Dimes'
         ) P ON P.team_id = G.team_id AND P.game_id = G.game_id
         GROUP BY P.player_id
     ) P ON P.player_id = P2.person_id`,
    [id(req.params.player_id)],
  )(req, res);

// GET /player/:player_id/spread_performance — how often the player's team
// covered the 5Dimes spread.
const player_spread_performance = (req, res) => {
  const p = id(req.params.player_id);
  return sendRows(
    `WITH player_spread_results AS (
        SELECT ps.player_id,
               CASE
                 WHEN ps.team_id = b.team_id THEN IF((g_home.pts + b.spread1) > g_away.pts, 1, 0)
                 WHEN ps.team_id = b.a_team_id THEN IF((g_away.pts + b.spread2) > g_home.pts, 1, 0)
                 ELSE 0
               END AS covered
        FROM player_stats ps
        JOIN betting_data b ON ps.game_id = b.game_id
        JOIN game_data g_home ON b.game_id = g_home.game_id AND b.team_id = g_home.team_id
        JOIN game_data g_away ON b.game_id = g_away.game_id AND b.a_team_id = g_away.team_id
        WHERE b.book_name = '5Dimes' AND ps.player_id = ?
    ), player_cover_totals AS (
        SELECT player_id, COUNT(*) AS total_games, SUM(covered) AS spread_covers
        FROM player_spread_results
        GROUP BY player_id
    )
    SELECT P.person_id, P.display_first_last,
           COALESCE(PCT.spread_covers, 0) AS count,
           COALESCE(PCT.total_games, 0) AS total_games,
           CASE WHEN COALESCE(PCT.total_games, 0) > 0 THEN COALESCE(PCT.spread_covers, 0) / PCT.total_games ELSE 0 END
             AS spread_percentage
    FROM players P
    LEFT JOIN player_cover_totals PCT ON P.person_id = PCT.player_id
    WHERE P.person_id = ?`,
    [p, p],
  )(req, res);
};

// ---------------------------------------------------------------- teams

// GET /team/search?name-or-abbreviation=
const team_search = (req, res) => {
  const like = `%${String(req.query['name-or-abbreviation'] ?? '')}%`;
  return sendRows(
    `SELECT * FROM teams WHERE UPPER(name) LIKE UPPER(?) OR UPPER(abbreviation) LIKE UPPER(?) ORDER BY name`,
    [like, like],
  )(req, res);
};

// GET /team/:team_id — record and averages.
const team = (req, res) =>
  sendRows(
    `WITH unique_games_avg AS (
        SELECT team_id, SUM(IF(wl = 'W', 1, 0)) AS number_wins, SUM(IF(wl = 'L', 1, 0)) AS number_losses,
               AVG(pts) AS avg_points, AVG(reb) AS avg_rebounds, AVG(ast) AS avg_assists
        FROM game_data
        WHERE team_id = ?
        GROUP BY team_id
    )
    SELECT name, abbreviation, teams.team_id, number_wins, number_losses, avg_points, avg_rebounds, avg_assists,
           min_year, max_year
    FROM unique_games_avg JOIN teams ON unique_games_avg.team_id = teams.team_id`,
    [id(req.params.team_id)],
  )(req, res);

// GET /team/:team_id/games — oldest first.
const games_for_team = (req, res) =>
  sendRows(
    `SELECT G.game_id, G.matchup, G.game_date, G.team_id, G.a_team_id
     FROM game_data G
     WHERE G.team_id = ?
     ORDER BY G.game_date, G.game_id`,
    [id(req.params.team_id)],
  )(req, res);

// GET /team/:team_id/betting — the team's average lines, per sportsbook.
const team_game_betting_data = (req, res) => {
  const t = id(req.params.team_id);
  return sendRows(
    `SELECT book_name, AVG(moneyline) AS avg_moneyline_price, AVG(spread) AS avg_spread, AVG(total1) AS avg_total
     FROM (
         SELECT book_name, moneyline_price1 AS moneyline, spread1 AS spread, total1 FROM betting_data WHERE team_id = ?
         UNION
         SELECT book_name, moneyline_price2 AS moneyline, spread2 AS spread, total1 FROM betting_data WHERE a_team_id = ?
     ) T
     GROUP BY book_name
     ORDER BY book_name`,
    [t, t],
  )(req, res);
};

// GET /team/:team_id/underdog_wins — wins when the moneyline underdog, any book.
const team_underdog_wins = (req, res) => {
  const t = id(req.params.team_id);
  return sendRows(
    `WITH total_underdog_games AS (
        SELECT G.team_id, COUNT(DISTINCT B.game_id) AS total_games
        FROM betting_data B JOIN game_data G ON B.game_id = G.game_id
        WHERE G.team_id = ?
          AND ((B.team_id = G.team_id AND B.moneyline_price1 > 0) OR (B.a_team_id = G.team_id AND B.moneyline_price2 > 0))
        GROUP BY G.team_id
    )
    SELECT T.team_id, ANY_VALUE(T.name) AS name, COUNT(DISTINCT B.game_id) AS count, ANY_VALUE(T2.total_games) AS total_games,
           COUNT(DISTINCT B.game_id) / ANY_VALUE(T2.total_games) AS percentage
    FROM betting_data B, game_data G, teams T, total_underdog_games T2
    WHERE B.game_id = G.game_id
        AND ((B.team_id = G.team_id AND B.moneyline_price1 > 0) OR (B.a_team_id = G.team_id AND B.moneyline_price2 > 0))
        AND G.wl = 'W'
        AND T.team_id = G.team_id
        AND T2.team_id = T.team_id
        AND T.team_id = ?
    GROUP BY T.team_id`,
    [t, t],
  )(req, res);
};

// GET /team/:team_id/underdog_money — returns on $100 underdog bets at 5Dimes.
const team_underdog_money = (req, res) => {
  const t = id(req.params.team_id);
  return sendRows(
    `WITH total_underdog_games AS (
        SELECT G.team_id, COUNT(DISTINCT B.game_id) AS total_games
        FROM betting_data B JOIN game_data G ON B.game_id = G.game_id
        WHERE G.team_id = ? AND B.book_name = '5Dimes'
          AND ((B.team_id = G.team_id AND B.moneyline_price1 > 0) OR (B.a_team_id = G.team_id AND B.moneyline_price2 > 0))
        GROUP BY G.team_id
    )
    SELECT T.team_id, ANY_VALUE(T.name) AS name, ANY_VALUE(T2.total_games) AS total_games,
           SUM(IF(G.wl = 'W', IF(B.moneyline_price1 > 0, B.moneyline_price1, B.moneyline_price2), -100)) AS money,
           SUM(IF(G.wl = 'W', IF(B.moneyline_price1 > 0, B.moneyline_price1, B.moneyline_price2), -100))
             / ANY_VALUE(T2.total_games) AS money_per_game
    FROM betting_data B, game_data G, teams T, total_underdog_games T2
    WHERE B.game_id = G.game_id
        AND ((B.team_id = G.team_id AND B.moneyline_price1 > 0) OR (B.a_team_id = G.team_id AND B.moneyline_price2 > 0))
        AND T.team_id = G.team_id
        AND T2.team_id = T.team_id
        AND T.team_id = ?
        AND B.book_name = '5Dimes'
    GROUP BY T.team_id`,
    [t, t],
  )(req, res);
};

// GET /team/:team_id/top_players?num_players= — highest average points + rebounds + assists.
const team_top_players = (req, res) => {
  const t = id(req.params.team_id);
  const limit = Math.min(100, Math.max(1, Math.floor(num(req.query.num_players, 15))));
  return sendRows(
    `WITH player_stats_avg AS (
        SELECT player_id, team_id, AVG(pts) AS avg_pts, AVG(ast) AS avg_ast, AVG(reb) AS avg_reb,
               AVG(stl) AS avg_stl, AVG(blk) AS avg_blk, AVG(min) AS avg_min
        FROM player_stats
        WHERE team_id = ?
        GROUP BY player_id, team_id
    )
    SELECT player_id, display_first_last, avg_pts, avg_ast, avg_reb, avg_pts + avg_ast + avg_reb AS avg_PRA,
           avg_stl, avg_blk, avg_min
    FROM players P JOIN player_stats_avg PSA ON P.person_id = PSA.player_id
    ORDER BY avg_PRA DESC, player_id
    LIMIT ?`,
    [t, limit],
  )(req, res);
};

// GET /team/:team_id/spread_cover — share of games the team covered the spread.
const team_spread_covering_percentage = (req, res) => {
  const t = id(req.params.team_id);
  return sendRows(
    `WITH total_games AS (
        SELECT team_id, COUNT(*) AS total_games FROM game_data WHERE team_id = ? GROUP BY team_id
    )
    SELECT ANY_VALUE(T.name) AS name, T.team_id, COUNT(DISTINCT B.game_id) AS count, ANY_VALUE(TG.total_games) AS total_games,
           COUNT(DISTINCT B.game_id) / ANY_VALUE(TG.total_games) AS spread_percentage
    FROM betting_data B, game_data G, game_data G2, teams T, total_games TG
    WHERE B.game_id = G.game_id AND B.team_id = G.team_id
        AND B.game_id = G2.game_id AND B.a_team_id = G2.team_id
        AND TG.team_id = T.team_id
        AND ((T.team_id = B.team_id AND (G.pts - G2.pts) > -1 * B.spread1)
            OR (T.team_id = B.a_team_id AND (G2.pts - G.pts) > -1 * B.spread2))
        AND T.team_id = ?
    GROUP BY T.team_id`,
    [t, t],
  )(req, res);
};

// ---------------------------------------------------------------- trivia

// GET /trivia/middling_total?threshold= — "middling" the totals market: over
// at one book and under at another whose line is at least `threshold` higher.
const middling_total_betting = (req, res) =>
  sendRows(
    `SELECT SUM(IF(G1.pts + G2.pts > B1.total1, 10000 / ABS(B1.total_price1), IF(G1.pts + G2.pts = B1.total1, 0, -100)))
            + SUM(IF(G1.pts + G2.pts < B2.total1, 10000 / ABS(B2.total_price1), IF(G1.pts + G2.pts = B2.total1, 0, -100)))
              AS middle_total_money,
            SUM(IF(G1.pts + G2.pts > B1.total1 AND G1.pts + G2.pts < B2.total1, 1, 0)) AS middles_total_won,
            SUM(IF(G1.pts + G2.pts > B1.total1 AND G1.pts + G2.pts < B2.total1, 0, 1)) AS middles_total_lost
     FROM betting_data B1 JOIN betting_data B2 ON B1.game_id = B2.game_id
     JOIN game_data G1 ON B1.game_id = G1.game_id AND B1.team_id = G1.team_id
     JOIN game_data G2 ON B1.game_id = G2.game_id AND B1.a_team_id = G2.team_id
     WHERE B1.book_name <> B2.book_name AND B1.total1 <= B2.total1 - ?`,
    req => [num(req.query.threshold, 2)],
    [],
  )(req, res);

// GET /trivia/middling_spread?threshold= — the same for point spreads.
const middling_spread_betting = (req, res) =>
  sendRows(
    `SELECT SUM(IF(G1.pts - G2.pts < -1 * B1.spread1, 10000 / ABS(B1.spread_price1), IF(G1.pts - G2.pts = -1 * B1.spread1, 0, -100)))
            + SUM(IF(G1.pts - G2.pts > -1 * B2.spread1, 10000 / ABS(B2.spread_price1), IF(G1.pts - G2.pts = -1 * B2.spread1, 0, -100)))
              AS middle_total_money,
            SUM(IF(G1.pts - G2.pts < -1 * B1.spread1 AND G1.pts - G2.pts > -1 * B2.spread1, 1, 0)) AS middles_total_won,
            SUM(IF(G1.pts - G2.pts < -1 * B1.spread1 AND G1.pts - G2.pts > -1 * B2.spread1, 0, 1)) AS middles_total_lost
     FROM betting_data B1 JOIN betting_data B2 ON B1.game_id = B2.game_id
     JOIN game_data G1 ON B1.game_id = G1.game_id AND B1.team_id = G1.team_id
     JOIN game_data G2 ON B1.game_id = G2.game_id AND B1.a_team_id = G2.team_id
     WHERE B1.book_name <> B2.book_name AND B1.spread1 <= B2.spread1 - ?`,
    req => [num(req.query.threshold, 2)],
    [],
  )(req, res);

// GET /trivia/arbitrage — pairs of books whose spread prices sum to under 100%
// implied probability, 20 per page. Prices outside ±100..300 are data errors in
// the source (e.g. +856 on a spread) and are left out.
const trivia_arbitrage = (req, res) =>
  sendRows(
    `SELECT B1.book_name AS book1, B2.book_name AS book2, B1.spread_price1, B2.spread_price2, G.matchup, G.game_date,
            1 / IF(B1.spread_price1 < 0, 1 + 100 / ABS(B1.spread_price1), B1.spread_price1 / 100 + 1)
            + 1 / IF(B2.spread_price2 < 0, 1 + 100 / ABS(B2.spread_price2), B2.spread_price2 / 100 + 1) AS arbitrage_percentage
     FROM betting_data B1 JOIN betting_data B2 ON B1.game_id = B2.game_id
     JOIN game_data G ON B1.game_id = G.game_id AND B1.team_id = G.team_id
     WHERE B1.book_name <> B2.book_name
       AND ABS(B1.spread_price1) BETWEEN 100 AND 300
       AND ABS(B2.spread_price2) BETWEEN 100 AND 300
       AND 1 / IF(B1.spread_price1 < 0, 1 + 100 / ABS(B1.spread_price1), B1.spread_price1 / 100 + 1)
         + 1 / IF(B2.spread_price2 < 0, 1 + 100 / ABS(B2.spread_price2), B2.spread_price2 / 100 + 1) < 1
     ORDER BY arbitrage_percentage, B1.game_id, B1.book_name, B2.book_name
     LIMIT ? OFFSET ?`,
    req => [20, (page(req) - 1) * 20],
  )(req, res);

// GET /trivia/top_matchups?minimum_games= — from the precomputed topmatchups table.
const trivia_top_matchups = (req, res) =>
  sendRows(
    `SELECT player1 AS name1, player2 AS name2, total_games, avg_pct_pts
     FROM topmatchups
     WHERE total_games >= ?
     ORDER BY avg_pct_pts DESC, id
     LIMIT 15`,
    req => [num(req.query.minimum_games, 0)],
  )(req, res);

// GET /trivia/spread_players?minimum_games= — players whose teams covered the
// 5Dimes spread most often. Totals precomputed in player_spread_totals.
const trivia_spread_players = (req, res) =>
  sendRows(
    `SELECT P.person_id, P.display_first_last, T.spread_covers AS count, T.total_games,
            CASE WHEN T.total_games > 0 THEN T.spread_covers / T.total_games ELSE 0 END AS spread_percentage
     FROM player_spread_totals T
     JOIN players P ON T.player_id = P.person_id
     WHERE T.total_games >= ?
     ORDER BY spread_percentage DESC, P.person_id
     LIMIT 15`,
    req => [num(req.query.minimum_games, 0)],
  )(req, res);

// GET /trivia/underdog_players?minimum_games= — best returns per game when the
// player's team was the underdog. Totals precomputed in player_underdog_totals.
const trivia_underdog_players = (req, res) =>
  sendRows(
    `SELECT T.player_id, P.display_first_last, T.total_games, T.total_money,
            T.total_money / T.total_games AS money_per_game, T.underdog_wins
     FROM player_underdog_totals T
     JOIN players P ON T.player_id = P.person_id
     WHERE T.total_games >= ?
     ORDER BY money_per_game DESC, T.player_id
     LIMIT 15`,
    req => [num(req.query.minimum_games, 0)],
  )(req, res);

const handlers = {
  game, game_players, game_betting, matchup_stats, matchup_top_pairs, game_search,
  player_search, player_information, games_for_player, player_average_stats, player_underdog, player_spread_performance,
  team_search, team, games_for_team, team_game_betting_data, team_underdog_wins, team_underdog_money,
  team_top_players, team_spread_covering_percentage,
  middling_total_betting, middling_spread_betting, trivia_arbitrage, trivia_top_matchups,
  trivia_spread_players, trivia_underdog_players,
};

module.exports = Object.fromEntries(Object.entries(handlers).map(([name, fn]) => [name, handle(fn)]));
