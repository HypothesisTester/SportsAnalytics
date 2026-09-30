-- Schema for the sports_betting database. Works on MySQL 8 and TiDB.
-- Load the data with `node db/load.js` (see README).
--
-- Tables use a case-insensitive collation, so name searches match any case
-- (TiDB's default, utf8mb4_bin, is case-sensitive).
--
-- Columns follow the CSVs in data/ one to one. Counting stats that the CSVs
-- store as decimals ("16.0") are DOUBLE, as MySQL Workbench's import made
-- them originally, so averages come back as numbers.

CREATE TABLE IF NOT EXISTS teams (
  team_id       INT          NOT NULL,
  name          VARCHAR(32)  NOT NULL,
  abbreviation  CHAR(3)      NOT NULL,
  min_year      INT,
  max_year      INT,
  PRIMARY KEY (team_id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS players (
  person_id           INT          NOT NULL,
  display_first_last  VARCHAR(64)  NOT NULL,
  from_year           INT,
  to_year             INT,
  draft_year          INT,
  height_feet         INT,
  height_inches       INT,
  weight              INT,
  team_id             INT,
  jersey              VARCHAR(8),
  school              VARCHAR(64),
  country             VARCHAR(64),
  PRIMARY KEY (person_id),
  KEY players_name (display_first_last)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- One row per team per game: every game appears twice, once from each side.
CREATE TABLE IF NOT EXISTS game_data (
  game_id      INT          NOT NULL,
  game_date    DATE         NOT NULL,
  matchup      VARCHAR(16)  NOT NULL,
  team_id      INT          NOT NULL,
  is_home      CHAR(1)      NOT NULL,  -- 't' or 'f'
  wl           CHAR(1),
  w            DOUBLE,
  l            DOUBLE,
  w_pct        DOUBLE,
  min          INT,
  fgm          DOUBLE,
  fga          DOUBLE,
  fg_pct       DOUBLE,
  fg3m         DOUBLE,
  fg3a         DOUBLE,
  fg3_pct      DOUBLE,
  ftm          DOUBLE,
  fta          DOUBLE,
  ft_pct       DOUBLE,
  oreb         DOUBLE,
  dreb         DOUBLE,
  reb          INT,
  ast          DOUBLE,
  stl          DOUBLE,
  blk          DOUBLE,
  tov          DOUBLE,
  pf           DOUBLE,
  pts          INT,
  a_team_id    INT          NOT NULL,
  season_year  INT,
  season_type  VARCHAR(16),
  season       VARCHAR(8),
  PRIMARY KEY (game_id, team_id),
  KEY game_data_team (team_id, a_team_id),
  KEY game_data_date (game_date)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- One row per player per game. The source has a few hundred repeated
-- (game, player) rows, so rows get their own id.
CREATE TABLE IF NOT EXISTS player_stats (
  id              INT          NOT NULL AUTO_INCREMENT,
  game_id         INT          NOT NULL,
  team_id         INT          NOT NULL,
  player_id       INT          NOT NULL,
  start_position  CHAR(1),
  min             DOUBLE,
  fgm             DOUBLE,
  fga             DOUBLE,
  fg_pct          DOUBLE,
  fg3m            DOUBLE,
  fg3a            DOUBLE,
  fg3_pct         DOUBLE,
  ftm             DOUBLE,
  fta             DOUBLE,
  ft_pct          DOUBLE,
  oreb            DOUBLE,
  dreb            DOUBLE,
  reb             DOUBLE,
  ast             DOUBLE,
  stl             DOUBLE,
  blk             DOUBLE,
  tov             DOUBLE,
  pf              DOUBLE,
  pts             DOUBLE,
  plus_minus      DOUBLE,
  season_type     VARCHAR(16),
  season_year     INT,
  season          VARCHAR(8),
  PRIMARY KEY (id),
  KEY player_stats_player (player_id, game_id),
  KEY player_stats_game (game_id, team_id),
  KEY player_stats_team (team_id, player_id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Betting lines: one row per game per sportsbook. team_id is the home side.
CREATE TABLE IF NOT EXISTS betting_data (
  game_id           INT          NOT NULL,
  book_name         VARCHAR(32)  NOT NULL,
  book_id           INT,
  team_id           INT          NOT NULL,
  a_team_id         INT          NOT NULL,
  moneyline_price1  DOUBLE,
  moneyline_price2  DOUBLE,
  spread1           DOUBLE,
  spread2           DOUBLE,
  spread_price1     DOUBLE,
  spread_price2     DOUBLE,
  total1            DOUBLE,
  total2            DOUBLE,
  total_price1      DOUBLE,
  total_price2      DOUBLE,
  PRIMARY KEY (game_id, book_name),
  KEY betting_book (book_name, game_id),
  KEY betting_team (team_id),
  KEY betting_away_team (a_team_id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Precomputed: pairs of opposing players and the share of their games'
-- points they scored between them.
CREATE TABLE IF NOT EXISTS topmatchups (
  id           INT          NOT NULL AUTO_INCREMENT,
  player1      VARCHAR(64)  NOT NULL,
  player2      VARCHAR(64)  NOT NULL,
  total_games  INT          NOT NULL,
  avg_pct_pts  DOUBLE       NOT NULL,
  PRIMARY KEY (id),
  KEY topmatchups_games (total_games, avg_pct_pts)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Derived tables, filled from the ones above by db/derived.sql. They replace
-- aggregates over every row of player_stats that pages ran on each request.

-- Career averages per player, for player search.
CREATE TABLE IF NOT EXISTS player_averages (
  player_id     INT     NOT NULL,
  fgm DOUBLE, fga DOUBLE, fg_pct DOUBLE, fg3m DOUBLE, fg3a DOUBLE, fg3_pct DOUBLE,
  ftm DOUBLE, fta DOUBLE, ft_pct DOUBLE, oreb DOUBLE, dreb DOUBLE, reb DOUBLE,
  ast DOUBLE, stl DOUBLE, blk DOUBLE, tov DOUBLE, pf DOUBLE, pts DOUBLE, min DOUBLE,
  games_played  INT     NOT NULL,
  PRIMARY KEY (player_id),
  KEY player_averages_games (games_played)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- How often each player's team covered the 5Dimes spread.
CREATE TABLE IF NOT EXISTS player_spread_totals (
  player_id      INT  NOT NULL,
  spread_covers  INT  NOT NULL,
  total_games    INT  NOT NULL,
  PRIMARY KEY (player_id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Each player's record and $100-stake returns when their team was the 5Dimes moneyline underdog.
CREATE TABLE IF NOT EXISTS player_underdog_totals (
  player_id      INT     NOT NULL,
  total_games    INT     NOT NULL,
  total_money    DOUBLE  NOT NULL,
  underdog_wins  INT     NOT NULL,
  PRIMARY KEY (player_id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
