# Sports Betting Analytics

A streamlined web app that blends betting markets with on-court performance to surface actionable NBA insights.

## Application Stack
- MySQL on AWS RDS hosts the curated dataset.
- Node.js with Express powers the REST API defined in `server.js` and `routes.js`.
- React with Chakra UI delivers the client experience in `client/`.
- Production runs on Heroku: https://sports-analytics-0875f07019b5.herokuapp.com/

## Data Pipeline
- Collects seven Kaggle CSVs spanning betting lines, team results, and player box scores.
- Cleans and harmonizes the feeds before loading a five-table MySQL warehouse.
- Models the schema to Third Normal Form, isolating lookup tables for players and teams to avoid redundant attributes.

## Data Cleaning
- Synced season coverage across files and appended the official team names missing from the raw exports.
- Folded separate moneyline, spread, and totals feeds into a single betting fact table.
- Filtered to games present in every source, trimming noisy columns such as `book_id` when the information already lived in `book_name`.
- Automations live in the Pandas/NumPy notebooks under `data_cleaning/`.

## Entity Resolution
- Standardized team names and IDs, reconciling aliases into canonical entries.
- Resolved player duplicates with birthdates, jersey numbers, and roster context.
- Normalized date formats, backfilled sparse attributes, and dropped duplicates to protect downstream joins.

## Complex Queries
`routes.js` carries the heavier analytical endpoints. The `player_spread_performance` route (`routes.js:214`) layers CTEs to pre-aggregate coverage results, while `matchup_stats` (`routes.js:255`) stitches head-to-head splits, betting lines, and bankroll outcomes. Breaking the logic into CTE blocks reduced repetition, clarified intent, and simplified tuning.

### Query Optimization
Our focus stayed on projections and filters rather than indexing gains.

| Query | Purpose | Original Runtime* | Optimized Runtime* |
| --- | --- | --- | --- |
| `player_spread_performance` | Measure how often a player covers the spread with pre-aggregated CTEs | ~3.1 s | ~0.7 s |
| `matchup_stats` | Surface head-to-head trends, spreads, and bankroll swings via chained CTEs | ~4.4 s | ~1.2 s |

\*Timings observed on the AWS RDS dataset after moving heavy filters into CTEs and trimming projections.

## Pre-processing Code
`csv_creation3.ipynb` captures the end-to-end creation of the CSVs consumed by the app.

## Run Locally
1. Run `npm install` to install the server dependencies.
2. Run `npm start` to boot the server.
3. `cd client` and run `npm install` for the frontend dependencies.
4. Run `npm start` inside `client/` to launch the React app.
5. Visit `http://localhost:3000` in your browser.

Or visit the deployed app at https://sports-analytics-0875f07019b5.herokuapp.com/.
