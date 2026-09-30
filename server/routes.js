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

/** A LIKE pattern matching `text` anywhere, with % and _ in it taken literally. */
function contains(text) {
  return `%${String(text).replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * SQL for the profit on a winning $100 bet at American odds `price`
 * (+150 wins $150; -150 wins $66.67).
 */
const payout = price => `IF(${price} > 0, ${price}, 10000 / -${price})`;

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

// GET /matchup/:team_a/:team_b — the two teams' record in all their meetings,
// one row per team (ordered by team id). Spread covers, pushes and underdog
// results use 5Dimes lines; the average spread and total use every book.
// "Underdog money" is the return from $100 on the team each time it was the
// moneyline underdog.
const matchup_stats = (req, res) => {
  const a = id(req.params.team_a);
  const b = id(req.params.team_b);
  return sendRows(
    `WITH meetings AS (
        SELECT g.game_id, g.team_id, g.pts, o.pts AS opp_pts, g.wl
        FROM game_data g JOIN game_data o ON o.game_id = g.game_id AND o.team_id = g.a_team_id
        WHERE (g.team_id = ? AND g.a_team_id = ?) OR (g.team_id = ? AND g.a_team_id = ?)
    ),
    dimes AS (
        SELECT m.game_id, m.team_id,
               IF(bd.team_id = m.team_id, bd.spread1, bd.spread2) AS spread,
               IF(bd.team_id = m.team_id, bd.moneyline_price1, bd.moneyline_price2) AS moneyline
        FROM meetings m JOIN betting_data bd ON bd.game_id = m.game_id AND bd.book_name = '5Dimes'
    ),
    books AS (
        SELECT m.team_id, AVG(IF(bd.team_id = m.team_id, bd.spread1, bd.spread2)) AS avg_spread,
               AVG(bd.total1) AS average_total
        FROM meetings m JOIN betting_data bd ON bd.game_id = m.game_id
        GROUP BY m.team_id
    )
    SELECT m.team_id, COUNT(*) AS total_games, SUM(m.wl = 'W') AS wins, AVG(m.pts) AS avg_pts,
           ANY_VALUE(bk.avg_spread) AS avg_spread, ANY_VALUE(bk.average_total) AS average_total,
           COUNT(d.spread) AS spread_games,
           SUM(m.pts - m.opp_pts + d.spread > 0) AS covers,
           SUM(m.pts - m.opp_pts + d.spread = 0) AS pushes,
           SUM(d.moneyline > 0) AS underdog_games,
           SUM(d.moneyline > 0 AND m.wl = 'W') AS underdog_wins,
           SUM(IF(d.moneyline > 0, IF(m.wl = 'W', d.moneyline, -100), 0)) AS underdog_money
    FROM meetings m
    LEFT JOIN dimes d ON d.game_id = m.game_id AND d.team_id = m.team_id
    LEFT JOIN books bk ON bk.team_id = m.team_id
    GROUP BY m.team_id
    ORDER BY m.team_id`,
    [a, b, b, a],
  )(req, res);
};

// GET /matchup/:team_a/:team_b/pairs — pairs of opposing players (a player of
// the first team, one of the second) who met at least 3 times, by the average
// share of each game's points the two of them scored.
const matchup_top_pairs = (req, res) => {
  const a = id(req.params.team_a);
  const b = id(req.params.team_b);
  return sendRows(
    `SELECT ANY_VALUE(P1.display_first_last) AS name1, ANY_VALUE(P2.display_first_last) AS name2,
            PS1.player_id AS player1_id, PS2.player_id AS player2_id,
            COUNT(DISTINCT G1.game_id) AS total_games, AVG((PS1.pts + PS2.pts) / (G1.pts + G2.pts)) AS avg_pct_pts
     FROM game_data G1
     JOIN game_data G2 ON G2.game_id = G1.game_id AND G2.team_id = G1.a_team_id
     JOIN player_stats PS1 ON PS1.game_id = G1.game_id AND PS1.team_id = G1.team_id
     JOIN player_stats PS2 ON PS2.game_id = G1.game_id AND PS2.team_id = G2.team_id
     JOIN players P1 ON P1.person_id = PS1.player_id
     JOIN players P2 ON P2.person_id = PS2.player_id
     WHERE G1.team_id = ? AND G1.a_team_id = ? AND PS1.pts IS NOT NULL AND PS2.pts IS NOT NULL
     GROUP BY PS1.player_id, PS2.player_id
     HAVING total_games >= 3
     ORDER BY avg_pct_pts DESC, PS1.player_id, PS2.player_id
     LIMIT 25`,
    [a, b],
  )(req, res);
};

// GET /game/search — games filtered by home team, away team (name or
// abbreviation), total points and season; 20 per page, newest first. home_spread
// is the home team's spread averaged over the sportsbooks.
const game_search = async (req, res) => {
  const home = req.query['name-or-abbreviation1'] ? String(req.query['name-or-abbreviation1']) : null;
  const away = req.query['name-or-abbreviation2'] ? String(req.query['name-or-abbreviation2']) : null;
  const minPts = num(req.query['min-pts']);
  const minYear = num(req.query['min-year']);
  const maxYear = num(req.query['max-year']);
  const perPage = 20;
  const like = contains;
  const [rows] = await pool.query(
    `SELECT g1.game_id, g1.team_id AS home_team_id, g1.a_team_id AS away_team_id,
            t.name AS home_team_name, t2.name AS away_team_name,
            t.abbreviation AS home_team_abbreviation, t2.abbreviation AS away_team_abbreviation,
            g1.pts AS home_team_pts, g2.pts AS away_team_pts, g1.season_year AS season_year, g1.game_date,
            (SELECT AVG(b.spread2) FROM betting_data b WHERE b.game_id = g1.game_id) AS home_spread
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
    [...(filter ? [contains(name)] : []), perPage, (page(req) - 1) * perPage],
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
            AVG(blk) AS blk, AVG(tov) AS tov, AVG(pf) AS pf, AVG(pts) AS pts, AVG(plus_minus) AS plus_minus,
            COUNT(*) AS games_played
     FROM player_stats
     WHERE player_id = ?`,
    [id(req.params.player_id)],
  )(req, res);

// GET /player/:player_id/player_underdog — the player's record and returns
// when his team was the 5Dimes moneyline underdog ($100 stakes).
const player_underdog = (req, res) =>
  sendRows(
    `SELECT P.person_id AS player_id, P.display_first_last, COUNT(*) AS total_games,
            SUM(IF(r.wl = 'W', r.moneyline, -100)) AS total_money,
            SUM(IF(r.wl = 'W', r.moneyline, -100)) / COUNT(*) AS money_per_game,
            SUM(r.wl = 'W') AS underdog_wins
     FROM players P JOIN (
         SELECT ps.player_id, g.wl, IF(bd.team_id = ps.team_id, bd.moneyline_price1, bd.moneyline_price2) AS moneyline
         FROM player_stats ps
         JOIN game_data g ON g.game_id = ps.game_id AND g.team_id = ps.team_id
         JOIN betting_data bd ON bd.game_id = ps.game_id AND bd.book_name = '5Dimes'
         WHERE ps.player_id = ?
     ) r ON r.player_id = P.person_id
     WHERE r.moneyline > 0
     GROUP BY P.person_id, P.display_first_last`,
    [id(req.params.player_id)],
  )(req, res);

// GET /player/:player_id/spread_performance — how often the player's team
// covered the 5Dimes spread in his games; pushes are left out of the rate, as
// for teams.
const player_spread_performance = (req, res) => {
  const p = id(req.params.player_id);
  return sendRows(
    `SELECT P.person_id, P.display_first_last,
            COALESCE(SUM(r.margin > 0), 0) AS count, COALESCE(SUM(r.margin = 0), 0) AS pushes,
            COUNT(r.margin) AS total_games,
            SUM(r.margin > 0) / NULLIF(COUNT(r.margin) - SUM(r.margin = 0), 0) AS spread_percentage
     FROM players P LEFT JOIN (
         SELECT ps.player_id, g.pts - o.pts + IF(bd.team_id = ps.team_id, bd.spread1, bd.spread2) AS margin
         FROM player_stats ps
         JOIN game_data g ON g.game_id = ps.game_id AND g.team_id = ps.team_id
         JOIN game_data o ON o.game_id = ps.game_id AND o.team_id = g.a_team_id
         JOIN betting_data bd ON bd.game_id = ps.game_id AND bd.book_name = '5Dimes'
         WHERE ps.player_id = ?
     ) r ON r.player_id = P.person_id
     WHERE P.person_id = ?
     GROUP BY P.person_id, P.display_first_last`,
    [p, p],
  )(req, res);
};

// ---------------------------------------------------------------- teams

// GET /team/search?name-or-abbreviation=
const team_search = (req, res) => {
  const like = contains(req.query['name-or-abbreviation'] ?? '');
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

// GET /team/:team_id/underdog_wins and /underdog_money — the team's record as
// the 5Dimes moneyline underdog, and the return from $100 on it each time.
const team_underdog = (req, res) =>
  sendRows(
    `SELECT T.team_id, T.name, COUNT(*) AS total_games, SUM(r.wl = 'W') AS count,
            SUM(r.wl = 'W') / COUNT(*) AS percentage,
            SUM(IF(r.wl = 'W', r.moneyline, -100)) AS money,
            SUM(IF(r.wl = 'W', r.moneyline, -100)) / COUNT(*) AS money_per_game
     FROM teams T JOIN (
         SELECT g.team_id, g.wl, IF(bd.team_id = g.team_id, bd.moneyline_price1, bd.moneyline_price2) AS moneyline
         FROM game_data g JOIN betting_data bd ON bd.game_id = g.game_id AND bd.book_name = '5Dimes'
         WHERE g.team_id = ?
     ) r ON r.team_id = T.team_id
     WHERE r.moneyline > 0
     GROUP BY T.team_id, T.name`,
    [id(req.params.team_id)],
  )(req, res);
const team_underdog_wins = team_underdog;
const team_underdog_money = team_underdog;


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

// GET /team/:team_id/spread_cover — how often the team covered the 5Dimes
// spread. A push (the margin equal to the line) is neither a cover nor a miss,
// so the rate is covers / (games - pushes), comparable to the 52.4% needed to
// profit at -110.
const team_spread_covering_percentage = (req, res) =>
  sendRows(
    `SELECT T.name, T.team_id, SUM(r.margin > 0) AS count, SUM(r.margin = 0) AS pushes, COUNT(r.margin) AS total_games,
            SUM(r.margin > 0) / NULLIF(COUNT(r.margin) - SUM(r.margin = 0), 0) AS spread_percentage
     FROM teams T JOIN (
         SELECT g.team_id, g.pts - o.pts + IF(bd.team_id = g.team_id, bd.spread1, bd.spread2) AS margin
         FROM game_data g
         JOIN game_data o ON o.game_id = g.game_id AND o.team_id = g.a_team_id
         JOIN betting_data bd ON bd.game_id = g.game_id AND bd.book_name = '5Dimes'
         WHERE g.team_id = ?
     ) r ON r.team_id = T.team_id
     GROUP BY T.team_id, T.name`,
    [id(req.params.team_id)],
  )(req, res);

// ---------------------------------------------------------------- trivia

// GET /trivia/middling_total?threshold= — for every game and pair of books whose
// totals differ by at least `threshold`: $100 on the over at the lower total and
// $100 on the under at the higher one, each at its own price. A middle is a
// final total strictly between the two lines; a total equal to a line pushes.
const middling_total_betting = (req, res) =>
  sendRows(
    `SELECT SUM(IF(pts > lo, ${payout('over_price')}, IF(pts = lo, 0, -100))
              + IF(pts < hi, ${payout('under_price')}, IF(pts = hi, 0, -100))) AS middle_total_money,
            SUM(pts > lo AND pts < hi) AS middles_total_won,
            SUM(NOT (pts > lo AND pts < hi)) AS middles_total_lost
     FROM (
         SELECT G1.pts + G2.pts AS pts, B1.total1 AS lo, B1.total_price1 AS over_price,
                B2.total1 AS hi, B2.total_price2 AS under_price
         FROM betting_data B1 JOIN betting_data B2 ON B1.game_id = B2.game_id AND B1.book_name <> B2.book_name
         JOIN game_data G1 ON B1.game_id = G1.game_id AND B1.team_id = G1.team_id
         JOIN game_data G2 ON B1.game_id = G2.game_id AND B1.a_team_id = G2.team_id
         WHERE B1.total1 <= B2.total1 - ?
     ) m`,
    req => [num(req.query.threshold, 2)],
    [],
  )(req, res);

// GET /trivia/middling_spread?threshold= — the same for point spreads: $100 on
// the home team at the book giving it more points and $100 on the away team at
// the book giving the away team more, each at its own price.
const middling_spread_betting = (req, res) =>
  sendRows(
    `SELECT SUM(IF(margin < -lo, ${payout('home_price')}, IF(margin = -lo, 0, -100))
              + IF(margin > -hi, ${payout('away_price')}, IF(margin = -hi, 0, -100))) AS middle_total_money,
            SUM(margin < -lo AND margin > -hi) AS middles_total_won,
            SUM(NOT (margin < -lo AND margin > -hi)) AS middles_total_lost
     FROM (
         SELECT G1.pts - G2.pts AS margin, B1.spread1 AS lo, B1.spread_price2 AS home_price,
                B2.spread1 AS hi, B2.spread_price1 AS away_price
         FROM betting_data B1 JOIN betting_data B2 ON B1.game_id = B2.game_id AND B1.book_name <> B2.book_name
         JOIN game_data G1 ON B1.game_id = G1.game_id AND B1.team_id = G1.team_id
         JOIN game_data G2 ON B1.game_id = G2.game_id AND B1.a_team_id = G2.team_id
         WHERE B1.spread1 <= B2.spread1 - ?
     ) m`,
    req => [num(req.query.threshold, 2)],
    [],
  )(req, res);

// GET /trivia/arbitrage — the away side at one book and the home side at
// another, on the same spread, priced so that the two implied probabilities sum
// to under 100%: betting both is a guaranteed profit. 20 per page, best first.
// Prices outside ±100..300 are data errors in the source (e.g. +856 on a
// spread) and are left out.
const trivia_arbitrage = (req, res) =>
  sendRows(
    `SELECT B1.game_id, G.game_date, TA.abbreviation AS away, TH.abbreviation AS home, B1.spread1 AS away_spread,
            B1.book_name AS book1, B1.spread_price1, B2.book_name AS book2, B2.spread_price2,
            IF(B1.spread_price1 < 0, -B1.spread_price1 / (100 - B1.spread_price1), 100 / (100 + B1.spread_price1)) + IF(B2.spread_price2 < 0, -B2.spread_price2 / (100 - B2.spread_price2), 100 / (100 + B2.spread_price2)) AS arbitrage_percentage
     FROM betting_data B1
     JOIN betting_data B2 ON B1.game_id = B2.game_id AND B1.book_name <> B2.book_name AND B1.spread1 = B2.spread1
     JOIN game_data G ON B1.game_id = G.game_id AND B1.team_id = G.team_id
     JOIN teams TA ON TA.team_id = B1.team_id
     JOIN teams TH ON TH.team_id = B1.a_team_id
     WHERE ABS(B1.spread_price1) BETWEEN 100 AND 300
       AND ABS(B2.spread_price2) BETWEEN 100 AND 300
       AND IF(B1.spread_price1 < 0, -B1.spread_price1 / (100 - B1.spread_price1), 100 / (100 + B1.spread_price1)) + IF(B2.spread_price2 < 0, -B2.spread_price2 / (100 - B2.spread_price2), 100 / (100 + B2.spread_price2)) < 1
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
    `SELECT P.person_id, P.display_first_last, T.spread_covers AS count, T.pushes, T.total_games,
            T.spread_covers / NULLIF(T.total_games - T.pushes, 0) AS spread_percentage
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
