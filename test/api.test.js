// node --test
// The input-validation tests run anywhere. The route tests also need a loaded
// database: set DATABASE_URL (and DB_SSL=false for a local MySQL).
const { test, before, after } = require('node:test');
const assert = require('node:assert');

const hasDatabase = Boolean(process.env.DATABASE_URL);
process.env.DATABASE_URL ??= 'mysql://nobody:none@127.0.0.1:1/sports_betting'; // never connected to
const app = require('../server/app');
const { pool } = require('../server/db');

let base, server;
before(async () => {
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.close();
  await pool.end();
});

const get = async path => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};

test('ids that are not whole numbers are rejected before any SQL runs', async () => {
  for (const path of [
    '/player/1%20OR%201=1',
    '/game/1;DROP%20TABLE%20players',
    "/team/1'",
    '/game/-5/players',
    '/player/12abc/games',
  ]) {
    const { status, body } = await get(path);
    assert.strictEqual(status, 400, path);
    assert.match(body.error, /Invalid id/);
  }
});

test('unknown API paths are a JSON 404', async () => {
  const { status } = await get('/nothing/here');
  assert.strictEqual(status, 404);
});

const routes = [
  '/game/41700404', '/game/41700404/players', '/game/41700404/betting',
  '/game/41700404/matchup_stats', '/game/41700404/matchup_top_pairs', '/game/search',
  '/player/search', '/player/search?name=curry', '/player/2544', '/player/2544/games',
  '/player/2544/average_stats', '/player/2544/spread_performance', '/player/2544/player_underdog',
  '/team/search?name-or-abbreviation=war', '/team/1610612744', '/team/1610612744/games',
  '/team/1610612744/betting', '/team/1610612744/underdog_wins', '/team/1610612744/underdog_money',
  '/team/1610612744/top_players?num_players=15', '/team/1610612744/spread_cover',
  '/trivia/middling_total?threshold=2', '/trivia/middling_spread?threshold=2', '/trivia/arbitrage',
  '/trivia/top_matchups?minimum_games=5', '/trivia/spread_players?minimum_games=50',
  '/trivia/underdog_players?minimum_games=20',
];

test('every route returns rows', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  for (const path of routes) {
    const { status, body } = await get(path);
    assert.strictEqual(status, 200, path);
    assert.ok(Array.isArray(body) && body.length > 0, `${path} returned no rows`);
  }
});

test('search text is matched literally, not run as SQL', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  const { body } = await get(`/team/search?name-or-abbreviation=${encodeURIComponent("x%') OR 1=1 -- ")}`);
  assert.deepStrictEqual(body, []);
  const curry = await get('/player/search?name=CURRY');
  assert.ok(curry.body.some(p => p.display_first_last === 'Stephen Curry'), 'search is case-insensitive');
});

test('the game route puts the home team first and dates are plain', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  // 2018 Finals, game 4: Golden State won 108-85 in Cleveland.
  const { body } = await get('/game/41700404');
  assert.strictEqual(body[0].abbreviation, 'CLE');
  assert.strictEqual(body[0].is_home, 't');
  assert.deepStrictEqual([body[0].pts, body[1].pts], [85, 108]);
  assert.strictEqual(body[0].game_date, '2018-06-08');
});
