const mysql = require("mysql");
const config = require("./config.json");
const { query } = require("express");

// Creates MySQL connection using database credential provided in config.json
// Do not edit. If the connection fails, make sure to check that config.json is filled out correctly
const connection = mysql.createConnection({
  host: config.rds_host,
  user: config.rds_user,
  password: config.rds_password,
  port: config.rds_port,
  database: config.rds_db,
});
connection.connect((err) => err && console.log(err));

// game page routes

// GET /game/:game_id
// list of 2 outputs: home team first, road team second
const game = async function (req, res) {
  connection.query(
    `
        SELECT *
        FROM game_data G
        JOIN teams T ON G.team_id = T.team_id
        WHERE G.game_id=${req.params.game_id}
    `,
    (err, data) => {
      if (err || data.length < 2) {
        console.log(err);
        res.json({});
      } else {
        if (data[0].is_home === "f") {
          temp = data[0];
          data[0] = data[1];
          data[1] = temp;
        }
        return res.json(data);
      }
    }
  );
};

// GET /game_players/:game_id
// list of 2 lists: home players first, road players second
const game_players = async function (req, res) {
  connection.query(
    `
        SELECT P.display_first_last, G.is_home, PS.*
        FROM players P JOIN player_stats PS on P.person_id = PS.player_id
            JOIN game_data G ON PS.game_id = G.game_id AND PS.team_id = G.team_id
        WHERE PS.game_id = ${req.params.game_id}
        ORDER BY PS.min DESC;
    `,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        output = [[], []];
        for (i = 0; i < data.length; i++) {
          if (data[i].is_home === "t") {
            output[0].push(data[i]);
          } else {
            output[1].push(data[i]);
          }
        }
        res.json(output);
      }
    }
  );
};

// GET /game_betting/:game_id
// list of all betting/books data for specific game_id
const game_betting = async function (req, res) {
  connection.query(
    `
        SELECT *
        FROM betting_data
        WHERE game_id = ${req.params.game_id};
    `,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// GET /games_for_team/:team_id
// Fetches game_id, matchup, and game_date for specific team_id
// Ordered by game_date
const games_for_team = async function (req, res) {
  connection.query(
    `
        SELECT G.game_id, G.matchup, G.game_date, G.team_id, G.a_team_id
        FROM game_data G
        WHERE team_id = ${req.params.team_id}
        ORDER BY G.game_date;
    `,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// GET /games_for_player/:player_id
// Fetches game_id, matchup, game date, and stats for specific player_id
// Ordered by game_date
const games_for_player = async function (req, res) {
  connection.query(
    `
        SELECT G.matchup, G.game_date, PS.*
        FROM game_data G JOIN player_stats PS on G.game_id = PS.game_id and G.team_id = PS.team_id
        WHERE player_id = ${req.params.player_id}
        ORDER BY G.game_date;
    `,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

/*
    GET /player/:player_id
    Returns player information for specific player_id
*/
const player_information = async function (req, res) {
  connection.query(
    `
        SELECT *
        FROM players
        WHERE person_id = ${req.params.player_id};
    `,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

/*
    GET /player/:player_id/average_stats
    Returns average stats for specific player_id
*/
const player_average_stats = async function (req, res) {
  connection.query(
    `
        SELECT AVG(min) as min, AVG(fgm) as fgm, AVG(fga) as fga, AVG(fg_pct) as fg_pct, AVG(fg3m) as fg3m, AVG(fg3a) as fg3a, AVG(fg3_pct) as fg3_pct, AVG(ftm) as ftm, AVG(fta) as fta, AVG(ft_pct) as ft_pct, AVG(oreb) as oreb, AVG(dreb) as dreb, AVG(reb) as reb, AVG(ast) as ast, AVG(stl) as stl, AVG(blk) as blk, AVG(tov) as tov, AVG(pf) as pf, AVG(pts) as pts, AVG(plus_minus) as plus_minus
        FROM player_stats
        WHERE player_id = ${req.params.player_id};
    `,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

/*
  Returns the specified underdog player's betting statistics and underdog wins
 */
const player_underdog = async function (req, res) {
  connection.query(
    `
    SELECT P.player_id, P2.display_first_last, P.total_games, P.total_money, P.total_money / P.total_games AS money_per_game, P.underdog_wins
    FROM (
        SELECT person_id, display_first_last
        FROM players
    ) P2 JOIN (
        SELECT P.player_id, COUNT(P.game_id) AS total_games,
               SUM(IF(G.wl = 'W', IF(P.moneyline_price1 > 0, P.moneyline_price1, P.moneyline_price2), -100)) AS total_money,
               SUM(IF(G.wl = 'W', 1, 0)) AS underdog_wins
        FROM (
            SELECT game_id, team_id,  wl
            FROM game_data
        ) G JOIN (
            SELECT P.team_id, P.game_id, P.player_id, B.moneyline_price1, B.moneyline_price2
            FROM (
                SELECT team_id, game_id, player_id
                FROM player_stats
                WHERE player_id=${req.params.player_id}
            ) P JOIN (
                SELECT game_id, team_id, a_team_id, moneyline_price1, moneyline_price2
                FROM betting_data
                WHERE (moneyline_price1 > 0 OR moneyline_price2 > 0) AND book_name = '5Dimes'
            ) B ON P.game_id = B.game_id AND
                   ((P.team_id = B.team_id AND B.moneyline_price1 > 0) OR (P.team_id = B.a_team_id AND B.moneyline_price2 > 0))
        ) P ON P.team_id = G.team_id AND P.game_id = G.game_id
        GROUP BY P.player_id
    ) P ON P.player_id = P2.person_id
`,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

/*
    GET /player/:player_id/spread_performance
    Returns num games the player covered the spread, total games, and percentage of games the player covered the spread
 */
const player_spread_performance = async function (req, res) {
  connection.query(
    `
    WITH total_games AS (
      SELECT P.player_id, COUNT(*) AS total_games
      FROM player_stats P
      WHERE P.player_id = ${req.params.player_id}
      GROUP BY P.player_id
  ), pts_difference AS (
      SELECT G1.pts - G2.pts AS pts_difference, G2.pts - G1.pts AS pts_difference2, G1.game_id
      FROM game_data G1 JOIN game_data G2 on G1.game_id = G2.game_id AND G1.a_team_id = G2.team_id
      WHERE G1.is_home = 'f'
  ), spread_covers1 AS (
      SELECT COUNT(B.game_id) AS count, PS.player_id
      FROM player_stats PS JOIN (
          SELECT DISTINCT B.game_id, B.team_id
          FROM betting_data B JOIN pts_difference G ON B.game_id = G.game_id AND pts_difference2 < B.spread1
      ) B ON PS.team_id = B.team_id AND PS.game_id = B.game_id
      WHERE PS.player_id = ${req.params.player_id}
      GROUP BY PS.player_id
  ), spread_covers2 AS (
      SELECT COUNT(B.game_id) AS count, PS.player_id
      FROM player_stats PS JOIN (
          SELECT DISTINCT B.game_id, B.a_team_id
          FROM betting_data B JOIN pts_difference G ON B.game_id = G.game_id AND pts_difference < B.spread2
      ) B ON PS.team_id = B.a_team_id AND PS.game_id = B.game_id
      WHERE PS.player_id = ${req.params.player_id}
      GROUP BY PS.player_id
  )
  SELECT P.person_id, P.display_first_last, S1.count + S2.count AS count, TG.total_games,
         (S1.count + S2.count) / TG.total_games AS spread_percentage
  FROM total_games TG JOIN spread_covers1 S1 ON TG.player_id = S1.player_id
      JOIN spread_covers2 S2 ON TG.player_id = S2.player_id
      JOIN players P ON TG.player_id = P.person_id;
`,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// Fetches aggregate data for all games played between 2 teams.
const matchup_stats = async function (req, res) {
  connection.query(
    `WITH win_loss AS (
            SELECT SUM(IF(G.wl = 'W', 1, 0)) AS team1_wins, SUM(IF(G.wl = 'L', 1, 0)) AS team2_wins,
                   AVG(G.pts) AS avg_pts_team1, AVG(G2.pts) AS avg_pts_team2, COUNT(DISTINCT G.game_id) AS total_games
            FROM game_data G JOIN game_data G2 ON G.game_id = G2.game_id AND G.a_team_id = G2.team_id
            JOIN game_data GX ON G.team_id = GX.team_id AND G.a_team_id = GX.a_team_id
            WHERE GX.game_id = ${req.params.game_id} AND GX.team_id < GX.a_team_id
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
            WHERE GX.game_id = ${req.params.game_id} AND GX.team_id < GX.a_team_id
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
            WHERE GX.game_id = ${req.params.game_id} AND GX.team_id < GX.a_team_id
                AND G.team_id = GX.team_id AND G.a_team_id = GX.a_team_id
                AND G.game_id = G2.game_id AND G.a_team_id = G2.team_id
                AND B.game_id = G.game_id
                AND ((B.team_id = G.team_id AND B.a_team_id = G.a_team_id)
                    OR (B.team_id = G.a_team_id AND B.a_team_id = G.team_id))
                AND B.book_name = '5Dimes'
        )
        SELECT *
        FROM win_loss, betting_averages, advanced_betting_stats;`,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// Returns the top specific player matchups for a given game
const matchup_top_pairs = async function (req, res) {
  connection.query(
    `
    WITH total_games AS (
        SELECT PS1.player_id AS id1, PS2.player_id AS id2, COUNT(DISTINCT PS1.game_id) AS total_games
        FROM player_stats PS1 JOIN player_stats PS2 ON PS1.game_id = PS2.game_id AND PS1.team_id <> PS2.team_id
            JOIN game_data GX ON PS1.team_id = GX.team_id AND PS2.team_id = GX.a_team_id
        WHERE GX.game_id = ${req.params.game_id} AND GX.team_id < GX.a_team_id AND
              PS1.team_id = GX.team_id AND PS2.team_id = GX.a_team_id
        GROUP BY PS1.player_id, PS2.player_id
    )
    SELECT P1.display_first_last AS player1, P2.display_first_last AS player2, TG.total_games, AVG((PS1.pts + PS2.pts) / (G1.pts + G2.pts)) AS avg_pct_pts
    FROM player_stats PS1 JOIN player_stats PS2 ON PS1.game_id = PS2.game_id AND PS1.team_id <> PS2.team_id
        JOIN game_data G1 ON PS1.game_id = G1.game_id AND PS1.team_id = G1.team_id
        JOIN game_data G2 ON PS1.game_id = G2.game_id AND PS2.team_id = G2.team_id
        JOIN players P1 ON PS1.player_id = P1.person_id
        JOIN players P2 ON PS2.player_id = P2.person_id
        JOIN total_games TG ON PS1.player_id = TG.id1 AND PS2.player_id = TG.id2
        JOIN game_data GX ON G1.team_id = GX.team_id AND G1.a_team_id = GX.a_team_id
    WHERE GX.game_id = ${req.params.game_id} AND GX.team_id < GX.a_team_id
        AND PS1.team_id = GX.team_id AND PS2.team_id = GX.a_team_id AND TG.total_games >= 3
    GROUP BY PS1.player_id, PS2.player_id
    ORDER BY AVG((PS1.pts + PS2.pts) / (G1.pts + G2.pts)) DESC
    LIMIT 25;
    `,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// Returns all information about a team, including average stats and win/loss record
const team = async function (req, res) {
  let team1ID = req.params.team_id;
  connection.query(
    `WITH unique_games_avg AS (
            SELECT team_id, SUM(IF(wl = 'W', 1, 0)) as number_wins, SUM(IF(wl = 'L', 1, 0)) as number_losses, AVG(pts) as avg_points, AVG(reb) as avg_rebounds, AVG(ast) as avg_assists
            FROM game_data GROUP BY team_id
        ) SELECT name, abbreviation, teams.team_id, number_wins, number_losses, avg_points, avg_rebounds, avg_assists, min_year, max_year
        FROM unique_games_avg JOIN teams ON unique_games_avg.team_id = teams.team_id WHERE teams.team_id = ${team1ID};`,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// Returns the betting data about a particular team by averaging data over games and presenting results per book
const team_game_betting_data = async function (req, res) {
  let team1ID = req.params.team_id;
  connection.query(
    `SELECT book_name, AVG(moneyline) AS avg_moneyline_price, AVG(spread) AS avg_spread, AVG(total1) AS avg_total
        FROM (
        SELECT book_name, moneyline_price1 AS moneyline, spread1 AS spread, total1
        FROM betting_data
        WHERE team_id = ${team1ID}
        UNION
        SELECT book_name, moneyline_price2 AS moneyline, spread2 AS spread, total1
        FROM betting_data
        WHERE a_team_id = ${team1ID}
        ) T
        GROUP BY book_name;`,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// Return a team’s specific underdog data, including wins, total games, and percentage underdog win rate
const team_underdog_wins = async function (req, res) {
  let team1ID = req.params.team_id;
  connection.query(
    `WITH total_underdog_games AS (
            SELECT G.team_id, COUNT(DISTINCT B.game_id) AS total_games
            FROM betting_data B JOIN game_data G on B.game_id = G.game_id
            WHERE (B.team_id = G.team_id AND B.moneyline_price1 > 0)
               OR (B.a_team_id = G.team_id AND B.moneyline_price2 > 0)
            GROUP BY G.team_id
        )
        SELECT T.team_id, T.name, COUNT(DISTINCT B.game_id) AS count, T2.total_games,
               COUNT(DISTINCT B.game_id) / T2.total_games AS percentage
        FROM betting_data B, game_data G, teams T, total_underdog_games T2
        WHERE B.game_id = G.game_id
            AND ((B.team_id = G.team_id AND B.moneyline_price1 > 0)
               OR (B.a_team_id = G.team_id AND B.moneyline_price2 > 0))
            AND G.wl = 'W'
            AND T.team_id = G.team_id
            AND T2.team_id = T.team_id
            AND T.team_id = ${team1ID}
        GROUP BY T.team_id;`,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// Returns the underdog team's betting data information for when they are underdogs
const team_underdog_money = async function (req, res) {
  let team1ID = req.params.team_id;
  connection.query(
    `WITH total_underdog_games AS (
            SELECT G.team_id, COUNT(DISTINCT B.game_id) AS total_games
            FROM betting_data B JOIN game_data G on B.game_id = G.game_id
            WHERE ((B.team_id = G.team_id AND B.moneyline_price1 > 0)
               OR (B.a_team_id = G.team_id AND B.moneyline_price2 > 0)) AND B.book_name = '5Dimes'
            GROUP BY G.team_id
        )
        SELECT T.team_id, T.name, T2.total_games,
               SUM(IF(G.wl = 'W', IF (B.moneyline_price1 > 0, B.moneyline_price1, B.moneyline_price2), -100)) AS money,
               SUM(IF(G.wl = 'W', IF (B.moneyline_price1 > 0, B.moneyline_price1, B.moneyline_price2), -100)) / T2.total_games AS money_per_game
        FROM betting_data B, game_data G, teams T, total_underdog_games T2
        WHERE B.game_id = G.game_id
            AND ((B.team_id = G.team_id AND B.moneyline_price1 > 0)
               OR (B.a_team_id = G.team_id AND B.moneyline_price2 > 0))
            AND T.team_id = G.team_id
            AND T2.team_id = T.team_id
            AND T.team_id = ${team1ID}
            AND B.book_name = '5Dimes'
        GROUP BY T.team_id`,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// Return a team's top players by average PRA
const team_top_players = async function (req, res) {
  let team_id = req.params.team_id;
  let num_players = req.query.num_players;
  connection.query(
    `
        WITH player_stats_avg AS (
    SELECT player_id, team_id, AVG(pts) as avg_pts, AVG(ast) as avg_ast, AVG(reb) as avg_reb, AVG(stl) as avg_stl, AVG(blk) as avg_blk, AVG(min) as avg_min
    FROM player_stats
    WHERE team_id = ${team_id}
    GROUP BY player_id
)
SELECT player_id, display_first_last, avg_pts, avg_ast, avg_reb, avg_pts + avg_ast + avg_reb AS avg_PRA, avg_stl, avg_blk, avg_min
FROM players P JOIN player_stats_avg PSA on P.person_id = PSA.player_id
WHERE team_id = ${team_id}
ORDER BY avg_PRA DESC
LIMIT ${num_players}`,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// Return a team's percentage of hitting their spread
const team_spread_covering_percentage = async function (req, res) {
  let team_id = req.params.team_id;
  connection.query(
    `
        WITH total_games AS (
            SELECT team_id, COUNT(*) AS total_games
            FROM game_data
            GROUP BY team_id
        )
        SELECT T.name, T.team_id, COUNT(DISTINCT B.game_id) AS count, TG.total_games, COUNT(DISTINCT B.game_id) / TG.total_games AS spread_percentage
        FROM betting_data B, game_data G, game_data G2, teams T, total_games TG
        WHERE B.game_id = G.game_id AND B.team_id = G.team_id
            AND B.game_id = G2.game_id AND B.a_team_id = G2.team_id
            AND TG.team_id = T.team_id
            AND ((T.team_id = B.team_id AND (G.pts - G2.pts) > -1 * B.spread1)
                OR (T.team_id = B.a_team_id AND (G2.pts - G.pts) > -1 * B.spread2))
            AND T.team_id = ${team_id}
        GROUP BY T.team_id
        ORDER BY COUNT(DISTINCT B.game_id) / TG.total_games DESC;
    `,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
        res.json({});
      } else {
        res.json(data);
      }
    }
  );
};

// trivia page

// return the middling betting returns (for total points) aggregated across all games and books
const middling_total_betting = async function (req, res) {
  let threshold = req.query.threshold;
  connection.query(
    `SELECT SUM(IF(G1.pts + G2.pts > B1.total1, 10000 / ABS(B1.total_price1), IF(G1.pts + G2.pts = B1.total1, 0, -100)))
        + SUM(IF(G1.pts + G2.pts < B2.total1, 10000 / ABS(B2.total_price1), IF(G1.pts + G2.pts = B2.total1, 0, -100))) AS middle_total_money,
        SUM(IF(G1.pts + G2.pts > B1.total1 AND G1.pts + G2.pts < B2.total1, 1, 0)) AS middles_total_won,
        SUM(IF(G1.pts + G2.pts > B1.total1 AND G1.pts + G2.pts < B2.total1, 0, 1)) AS middles_total_lost
        FROM betting_data B1 JOIN betting_data B2 on B1.game_id = B2.game_id
        JOIN game_data G1 ON B1.game_id = G1.game_id AND B1.team_id = G1.team_id
        JOIN game_data G2 ON B1.game_id = G2.game_id AND B1.a_team_id = G2.team_id
        WHERE B1.total1 <= B2.total1 - ${threshold};`,
    (err, data) => {
      if (err) {
        console.log(err);
      } else {
        res.json(data);
      }
    }
  );
};

// return the middling betting returns (for point spread) aggregated across all games and books
const middling_spread_betting = async function (req, res) {
  let threshold = req.query.threshold;
  connection.query(
    `SELECT SUM(IF(G1.pts - G2.pts < -1 * B1.spread1, 10000 / ABS(B1.spread_price1), IF(G1.pts - G2.pts = -1 * B1.spread1, 0, -100)))
    + SUM(IF(G1.pts - G2.pts > -1 * B2.spread1, 10000 / ABS(B2.spread_price1), IF(G1.pts - G2.pts = -1 * B2.spread1, 0, -100))) AS middle_total_money,
SUM(IF(G1.pts - G2.pts < -1 * B1.spread1 AND G1.pts - G2.pts > -1 * B2.spread1, 1, 0)) AS middles_total_won,
SUM(IF(G1.pts - G2.pts < -1 * B1.spread1 AND G1.pts - G2.pts > -1 * B2.spread1, 0, 1)) AS middles_total_lost
FROM betting_data B1 JOIN betting_data B2 ON B1.game_id = B2.game_id
JOIN game_data G1 ON B1.game_id = G1.game_id AND B1.team_id = G1.team_id
JOIN game_data G2 ON B1.game_id = G2.game_id AND B1.a_team_id = G2.team_id
WHERE B1.spread1 <= B2.spread1 - ${threshold};`,
    (err, data) => {
      if (err) {
        console.log(err);
      } else {
        res.json(data);
      }
    }
  );
};

// Search for players (with optional parameters for filtering)
const player_search = async function (req, res) {
  let name_substring = req.query.name;
  let page = parseInt(req.query["page"]) || 1;
  let resultsPerPage = 20;
  let offset = (page - 1) * resultsPerPage;
  connection.query(
    `SELECT person_id, display_first_last, from_year, to_year, draft_year, height_feet, height_inches, weight, team_id, jersey, school, country, AVG(fgm) as fgm, AVG(fga) as fga, avg(fg_pct) as fg_pct, avg(fg3m) as fg3m, avg(fg3a) as fg3a, avg(fg_pct) as fg3_pct, avg(ftm) as ftm, AVG(fta) as fta, avg(ft_pct) as ft_pct, avg(oreb) as oreb, avg(dreb) as dreb, avg(reb) as reb, avg(ast) as ast, avg(stl) as stl, avg(blk) as blk, avg(tov) as tov, avg(pf) as pf, avg(pts) as pts, AVG(min) as min
FROM player_stats ps
    JOIN players p on ps.player_id = p.person_id
WHERE LOWER(p.display_first_last) LIKE LOWER('%${name_substring}%')
GROUP BY p.person_id
LIMIT ? OFFSET ?;`,
[resultsPerPage, offset],
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
      } else {
        res.json(data);
      }
    }
  );
};

// Search for teams (with optional parameters for filtering)
const team_search = async function (req, res) {
  let substring = req.query["name-or-abbreviation"];
  connection.query(
    `SELECT * FROM teams
         WHERE UPPER(name) LIKE UPPER('%${substring}%')
            OR UPPER(abbreviation) LIKE UPPER('%${substring}%');`,
    (err, data) => {
      if (err || data.length === 0) {
        console.log(err);
      } else {
        res.json(data);
      }
    }
  );
};

// Search for games (with optional parameters for filtering around team names, years, and minimum points)
const game_search = async function (req, res) {
  let team1_substring = req.query["name-or-abbreviation1"]
    ? String(req.query["name-or-abbreviation1"])
    : null;
  let team2_substring = req.query["name-or-abbreviation2"]
    ? String(req.query["name-or-abbreviation2"])
    : null;
  let min_pts = req.query["min-pts"];
  let min_year = req.query["min-year"];
  let max_year = req.query["max-year"];
  let page = parseInt(req.query["page"]) || 1;
  let resultsPerPage = 20;
  let offset = (page - 1) * resultsPerPage;

  let whereClauseTeam1 = team1_substring
    ? `WHERE (name LIKE '%${team1_substring}%') OR (abbreviation LIKE '%${team1_substring}%')`
    : "";
  let whereClauseTeam2 = team2_substring
    ? `WHERE (name LIKE '%${team2_substring}%') OR (abbreviation LIKE '%${team2_substring}%')`
    : "";

  connection.query(
    `WITH potential_team1_by_name AS (
    SELECT team_id
    FROM teams
    ${whereClauseTeam1}
), potential_team2_by_name AS (
    SELECT team_id
    FROM teams
    ${whereClauseTeam2}
)
SELECT g1.game_id, g1.team_id as home_team_id, g1.a_team_id as away_team_id, t.name as home_team_name, t2.name as away_team_name,
       t.abbreviation as home_team_abbreviation, t2.abbreviation as away_team_abbreviation, g1.pts as home_team_pts,
       g2.pts as away_team_pts, g1.season_year as season_year, g1.game_date
FROM game_data g1
JOIN game_data g2 ON g1.a_team_id = g2.team_id AND g1.game_id = g2.game_id
JOIN teams t on g1.team_id = t.team_id
JOIN teams t2 on g2.team_id = t2.team_id
WHERE g1.team_id IN (SELECT * FROM potential_team1_by_name) AND g2.team_id IN (SELECT * FROM potential_team2_by_name)
  AND ((g1.pts + g2.pts) >= COALESCE(?, 0))
  AND ((g1.season_year >= COALESCE(?, 0)) OR (? IS NULL))
  AND ((g1.season_year <= COALESCE(?, g1.season_year)) OR (? IS NULL)) GROUP BY g1.game_id
ORDER BY g1.game_date DESC
LIMIT ? OFFSET ?;`,
    [min_pts, min_year, min_year, max_year, max_year, resultsPerPage, offset],
    (err, data) => {
      if (err) {
        console.error("Error executing query:", err);
        res.status(500).json({ error: "Internal server error" });
      } else if (data.length === 0) {
        res.status(404).json({ message: "No results found" });
      } else {
        res.json(data);
      }
    }
  );
};

// Fetches the top matchups of players based on % of total points scored by these two players in games with both of them playing
const trivia_top_matchups = async function(req, res) {
  connection.query(
`
  SELECT * FROM topmatchups
  WHERE total_games >= ${req.query.minimum_games}
 ORDER BY avg_pct_pts DESC
 LIMIT 15;
  `, (err, data) => {
    if (err || data.length == 0) {
      console.log(err);
      res.json({});
    } else {
      res.json(data);
    }
  }
  );
}

//This query returns arbitrage opportunity across historical books/games
const trivia_arbitrage = async function(req, res) {
    let page = parseInt(req.query["page"]) || 1;
    let resultsPerPage = 20;
    let offset = (page - 1) * resultsPerPage;

  connection.query(`SELECT B1.book_name AS book1, B2.book_name AS book2, B1.spread_price1, B2.spread_price2, G.matchup, G.game_date, 1 / IF(B1.spread_price1 < 0, 1 + 100 / ABS(B1.spread_price1), B1.spread_price1 / 100 + 1)
  + 1 / IF(B2.spread_price2 < 0, 1 + 100 / ABS(B2.spread_price2), B2.spread_price2 / 100 + 1) AS arbitrage_percentage
FROM betting_data B1 JOIN betting_data B2 ON B1.game_id = B2.game_id
  JOIN game_data G ON B1.game_id = G.game_id AND B1.team_id = G.team_id
WHERE 1 / IF(B1.spread_price1 < 0, 1 + 100 / ABS(B1.spread_price1), B1.spread_price1 / 100 + 1)
  + 1 / IF(B2.spread_price2 < 0, 1 + 100 / ABS(B2.spread_price2), B2.spread_price2 / 100 + 1) < 1
  ORDER BY arbitrage_percentage
  LIMIT ? OFFSET ?;`, [resultsPerPage, offset],
  (err, data) => {
    if (err || data.length == 0) {
      console.log(err);
      res.json({});
    } else {
      res.json(data);
    }
  })
} 

// Return the top players in terms of meeting their spreads, with a filter of the minimum number of games to consider when finding this (for consistency measurement)
const trivia_spread_players = async function(req, res) {
  connection.query(`WITH total_games AS (
    SELECT P.player_id, COUNT(*) AS total_games
    FROM player_stats P
    GROUP BY P.player_id
    HAVING total_games >= ${req.query.minimum_games}
 ), pts_difference AS (
    SELECT G1.pts - G2.pts AS pts_difference, G2.pts - G1.pts AS pts_difference2, G1.game_id
    FROM game_data G1 JOIN game_data G2 on G1.game_id = G2.game_id AND G1.a_team_id = G2.team_id
    WHERE G1.is_home = 'f'
 ), spread_covers1 AS (
    SELECT COUNT(B.game_id) AS count, PS.player_id
    FROM player_stats PS JOIN (
        SELECT DISTINCT B.game_id, B.team_id
        FROM betting_data B JOIN pts_difference G ON B.game_id = G.game_id AND pts_difference2 < B.spread1
    ) B ON PS.team_id = B.team_id AND PS.game_id = B.game_id
    GROUP BY PS.player_id
 ), spread_covers2 AS (
    SELECT COUNT(B.game_id) AS count, PS.player_id
    FROM player_stats PS JOIN (
        SELECT DISTINCT B.game_id, B.a_team_id
        FROM betting_data B JOIN pts_difference G ON B.game_id = G.game_id AND pts_difference < B.spread2
    ) B ON PS.team_id = B.a_team_id AND PS.game_id = B.game_id
    GROUP BY PS.player_id
 )
 SELECT P.person_id, P.display_first_last, S1.count + S2.count AS count, TG.total_games,
       (S1.count + S2.count) / TG.total_games AS spread_percentage
 FROM total_games TG JOIN spread_covers1 S1 ON TG.player_id = S1.player_id
    JOIN spread_covers2 S2 ON TG.player_id = S2.player_id
    JOIN players P ON TG.player_id = P.person_id
 ORDER BY spread_percentage DESC
 LIMIT 15`, 
  (err, data) => {
    if (err || data.length == 0) {
      console.log(err);
      res.json({});
    } else {
      res.json(data);
    }
  })
}

// Return the top players in terms of their money opportunity per game where they are underdogs (essentially, underdog returns for players)
const trivia_underdog_players = async function(req, res) {
  connection.query(`SELECT P.player_id, P2.display_first_last, P.total_games, P.total_money, P.total_money / P.total_games AS money_per_game, P.underdog_wins
  FROM (
     SELECT person_id, display_first_last
     FROM players
  ) P2 JOIN (
     SELECT P.player_id, COUNT(P.game_id) AS total_games,
            SUM(IF(G.wl = 'W', IF(P.moneyline_price1 > 0, P.moneyline_price1, P.moneyline_price2), -100)) AS total_money,
            SUM(IF(G.wl = 'W', 1, 0)) AS underdog_wins
     FROM (
         SELECT game_id, team_id,  wl
         FROM game_data
     ) G JOIN (
         SELECT P.team_id, P.game_id, P.player_id, B.moneyline_price1, B.moneyline_price2
         FROM (
             SELECT team_id, game_id, player_id
             FROM player_stats
         ) P JOIN (
             SELECT game_id, team_id, a_team_id, moneyline_price1, moneyline_price2
             FROM betting_data
             WHERE (moneyline_price1 > 0 OR moneyline_price2 > 0) AND book_name = '5Dimes'
         ) B ON P.game_id = B.game_id AND
                ((P.team_id = B.team_id AND B.moneyline_price1 > 0) OR (P.team_id = B.a_team_id AND B.moneyline_price2 > 0))
     ) P ON P.team_id = G.team_id AND P.game_id = G.game_id
     GROUP BY P.player_id
     HAVING total_games >= ${req.query.minimum_games}
  ) P ON P.player_id = P2.person_id
  ORDER BY money_per_game DESC
  LIMIT 15;
  `, 
  (err, data) => {
    if (err || data.length == 0) {
      console.log(err);
      res.json({});
    } else {
      res.json(data);
    }
  })
}

module.exports = {
  game,
  game_players,
  game_betting,
  games_for_team,
  games_for_player,
  player_information,
  player_average_stats,
  player_spread_performance,
  player_underdog,
  matchup_stats,
  matchup_top_pairs,
  team,
  team_top_players,
  team_spread_covering_percentage,
  team_game_betting_data,
  team_underdog_wins,
  team_underdog_money,
  middling_total_betting,
  middling_spread_betting,
  player_search,
  team_search,
  game_search,
  trivia_top_matchups,
  trivia_arbitrage,
  trivia_spread_players,
  trivia_underdog_players,
};
