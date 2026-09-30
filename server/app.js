// The HTTP API. Every route is under /api, so the React app's own pages
// (/game/:id, /team, /trivia) never collide with it.
const express = require('express');
const routes = require('./routes');

const app = express();
app.disable('x-powered-by');
const api = express.Router();

// The data only changes when it is reloaded, so browsers may reuse a response
// for an hour and Vercel's CDN for a week, serving a stale copy for another day
// while it refreshes. A new deployment starts with an empty CDN cache.
api.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('Vercel-CDN-Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  next();
});

api.get('/game/search', routes.game_search);
api.get('/game/:game_id', routes.game);
api.get('/game/:game_id/players', routes.game_players);
api.get('/game/:game_id/betting', routes.game_betting);

// Head to head depends only on the two teams, so it is keyed by the pair: every
// game between them shares one cached response.
api.get('/matchup/:team_a/:team_b', routes.matchup_stats);
api.get('/matchup/:team_a/:team_b/pairs', routes.matchup_top_pairs);

api.get('/player/search', routes.player_search);
api.get('/player/:player_id', routes.player_information);
api.get('/player/:player_id/games', routes.games_for_player);
api.get('/player/:player_id/average_stats', routes.player_average_stats);
api.get('/player/:player_id/spread_performance', routes.player_spread_performance);
api.get('/player/:player_id/player_underdog', routes.player_underdog);

api.get('/team/search', routes.team_search);
api.get('/team/:team_id', routes.team);
api.get('/team/:team_id/games', routes.games_for_team);
api.get('/team/:team_id/betting', routes.team_game_betting_data);
api.get('/team/:team_id/underdog_wins', routes.team_underdog_wins);
api.get('/team/:team_id/underdog_money', routes.team_underdog_money);
api.get('/team/:team_id/top_players', routes.team_top_players);
api.get('/team/:team_id/spread_cover', routes.team_spread_covering_percentage);

api.get('/trivia/middling_total', routes.middling_total_betting);
api.get('/trivia/middling_spread', routes.middling_spread_betting);
api.get('/trivia/arbitrage', routes.trivia_arbitrage);
api.get('/trivia/top_matchups', routes.trivia_top_matchups);
api.get('/trivia/spread_players', routes.trivia_spread_players);
api.get('/trivia/underdog_players', routes.trivia_underdog_players);

api.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use('/api', api);

module.exports = app;
