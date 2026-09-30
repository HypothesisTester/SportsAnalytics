# SportsAnalytics

NBA betting analytics: how teams and players performed against the betting lines, and which betting strategies would have paid off.

**Live site: https://sports-analytics-ten.vercel.app**

## What it shows

- **Strategy tester**: pick a rule (spread, moneyline or total; home or away; favourite or underdog; a line range, seasons, a team, a sportsbook) and see what $100 on every matching bet would have returned, with a running total drawn over the range a bettor with no edge would land in.
- **Games**: search 14,906 games (2006–07 to 2017–18) by team, season and total points. Each game shows who covered the spread and the total, the lines from 10 sportsbooks, the box score, and the two teams' record against each other.
- **Teams and players**: records and career averages, season-by-season charts, how often they covered the spread, and what $100 on them as the underdog would have returned.
- **Strategies and leaderboards**: "middling" between two books' lines, genuine arbitrage between books' prices on the same spread, and the players with the best records against the spread and as underdogs.

Every rate and return comes with a 95% interval (Wilson for rates, Student's t for returns) and a plain verdict on whether it could be luck; the leaderboards are ranked by the bottom of the interval, and say how many players luck alone would put there. The formulas are checked against scipy and statsmodels, and the strategy tester's totals against a recomputation from the raw CSVs with pandas. Preseason games and games a player sat out are left out of every figure.

## Architecture

```mermaid
flowchart LR
    subgraph Offline["Prepared once"]
        Kaggle["7 Kaggle CSVs"] --> Pandas["pandas notebooks<br/>clean, merge, dedupe"] --> CSV["data/*.csv"]
        CSV --> Load["db/load.js<br/>schema, bulk insert,<br/>derived tables"]
    end
    Load --> DB[("TiDB Cloud<br/>MySQL-compatible")]
    Browser --> Static["Vercel CDN<br/>React app"]
    Browser -->|"/api/*"| API["Vercel function<br/>Express, 29 routes"]
    API -->|"read-only user,<br/>bound parameters"| DB
```

The React app is served as static files, with no UI library: plain CSS, one self-hosted variable font, and about 76 kB of gzipped JavaScript and CSS. Every game, team and player has its own URL. The API is one Express app running as a Vercel serverless function, and Vercel's CDN caches its responses for a day, since the data only changes when it is reloaded.

## Data

| Table | Rows | Contents |
|---|---|---|
| `game_data` | 29,812 | One row per team per game: result and team box score |
| `player_stats` | 668,628 | One row per player per game: box score |
| `betting_data` | 125,286 | One row per game per sportsbook: moneyline, spread and total, with prices |
| `players` | 4,171 | Player details |
| `teams` | 30 | Team names and abbreviations |
| `topmatchups` | 495,472 | Precomputed: opposing player pairs and their share of the points |

`db/schema.sql` defines the tables and indexes. `db/derived.sql` builds three summary tables from them (career averages, and per-player spread and underdog totals), so the pages that used to aggregate all 668,628 player rows on every request read a few thousand rows instead:

| Request (local MySQL 8) | Before | After |
|---|---|---|
| Player search, first page | 9.4 s | 25 ms |
| Players against the spread | 1.7 s | 11 ms |
| Players as underdogs | 1.5 s | 8 ms |

The CSVs are the cleaned output of the notebooks in `data_cleaning/`: team names standardised across sources, duplicate players resolved by birthdate and jersey, the three betting markets merged into one table, and games kept only when every source has them.

## Running locally

Needs Node 20+ and MySQL 8 (or a TiDB Cloud cluster).

```bash
npm install
DATABASE_URL='mysql://user:password@localhost:3306/sports_betting' DB_SSL=false npm run load-data
npm run build
DATABASE_URL='mysql://user:password@localhost:3306/sports_betting' DB_SSL=false npm start
```

Then open http://localhost:6100. For frontend development, run `npm start` in `client/` as well; it forwards `/api` to port 6100.

`npm test` checks input validation; with `DATABASE_URL` set it also calls every route.

## Deploying

1. Create a TiDB Cloud Starter cluster (free) and load it: `DATABASE_URL='mysql://<user>:<password>@<host>:4000/sports_betting' APP_DB_PASSWORD='<new password>' npm run load-data`. This also creates the read-only user the site connects as.
2. Import the repo into Vercel and set `DATABASE_URL` to that read-only user's connection string. `vercel.json` does the rest.

After a change to `db/derived.sql`, `npm run rebuild-derived` (with the admin `DATABASE_URL`) rebuilds only the three summary tables, in a few seconds.
