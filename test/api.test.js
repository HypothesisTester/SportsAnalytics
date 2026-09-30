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

test('a failed query is a 500 that the CDN will not cache', { skip: hasDatabase }, async () => {
  const res = await fetch(base + '/team/search');
  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  assert.strictEqual(res.headers.get('vercel-cdn-cache-control'), null);
});

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
  '/matchup/1610612739/1610612744', '/matchup/1610612739/1610612744/pairs', '/game/search',
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

test('game search filters the home and away teams as labelled', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  // 2018 Finals: games 1-2 in Oakland, 3-4 in Cleveland.
  const { body } = await get('/game/search?name-or-abbreviation1=Warriors&name-or-abbreviation2=Cavaliers&min-year=2017&max-year=2017');
  const finals = body.filter(g => String(g.game_id).startsWith('4170040'));
  assert.deepStrictEqual(finals.map(g => g.game_id).sort(), [41700401, 41700402]);
  assert.ok(body.every(g => g.home_team_name === 'Warriors' && g.away_team_name === 'Cavaliers'));
});

// Worked out directly from the raw tables: the 45 Cavaliers–Warriors meetings,
// 5Dimes lines, each team's own spread and moneyline.
test('head to head counts each team against its own line', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  const { body } = await get('/matchup/1610612739/1610612744');
  const [cle, gsw] = body;
  assert.deepStrictEqual([cle.team_id, gsw.team_id], [1610612739, 1610612744]);
  assert.deepStrictEqual([cle.total_games, cle.wins, gsw.wins], [45, 17, 28]);
  assert.deepStrictEqual([cle.covers, gsw.covers, cle.pushes, gsw.pushes], [17, 27, 1, 1]);
  assert.deepStrictEqual([cle.underdog_games, cle.underdog_wins, gsw.underdog_games, gsw.underdog_wins], [32, 9, 13, 5]);
  const swapped = (await get('/matchup/1610612744/1610612739')).body;
  assert.deepStrictEqual(swapped, body);
});

test('cover rates leave out pushes and average 50% over all teams', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  const teams = (await get('/team/search')).body;
  const rows = await Promise.all(teams.map(async t => (await get(`/team/${t.team_id}/spread_cover`)).body[0]));
  for (const r of rows) {
    assert.ok(Math.abs(r.spread_percentage - r.count / (r.total_games - r.pushes)) < 1e-3, r.name);
  }
  const mean = rows.reduce((a, r) => a + r.spread_percentage, 0) / rows.length;
  assert.ok(Math.abs(mean - 0.5) < 0.005, `mean cover rate ${mean}`);
});

test('arbitrage bets both sides of the same spread', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  const { body } = await get('/trivia/arbitrage?page=1');
  assert.ok(body.length > 0);
  for (const row of body.slice(0, 5)) {
    const lines = (await get(`/game/${row.game_id}/betting`)).body;
    const one = lines.find(l => l.book_name === row.book1);
    const other = lines.find(l => l.book_name === row.book2);
    assert.strictEqual(one.spread1, other.spread1);
    assert.strictEqual(one.spread1, row.away_spread);
  }
});

test('leaderboards are ranked by the lower end of the 95% interval', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  const spread = (await get('/trivia/spread_players?minimum_games=50')).body;
  const dogs = (await get('/trivia/underdog_players?minimum_games=10')).body;
  for (const rows of [spread, dogs]) {
    assert.strictEqual(rows.length, 15);
    for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1].lower_bound >= rows[i].lower_bound);
    assert.ok(rows[0].players > rows[0].above_even);
  }
  // Wilson lower bound for 36 of 51 (Okaro White), checked against statsmodels.
  const white = spread.find(r => r.person_id === 1627855);
  assert.ok(Math.abs(white.lower_bound - 0.570009) < 1e-5);
  assert.ok(dogs.every(r => r.money_sum_sq > 0));
});

test('% and _ in a search are matched literally', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  assert.strictEqual((await get('/player/search?name=%25%25')).status, 200);
  assert.deepStrictEqual((await get('/player/search?name=%25%25')).body, []);
  assert.deepStrictEqual((await get('/team/search?name-or-abbreviation=_')).body, []);
});

test('arbitrage pairs two different books at plausible prices', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  for (const p of [1, 2, 5]) {
    const { body } = await get(`/trivia/arbitrage?page=${p}`);
    for (const row of body) {
      assert.notStrictEqual(row.book1, row.book2);
      for (const price of [row.spread_price1, row.spread_price2]) assert.ok(Math.abs(price) >= 100 && Math.abs(price) <= 300, price);
      assert.ok(row.arbitrage_percentage < 1);
    }
  }
});

test('the team list is alphabetical', { skip: !hasDatabase && 'no DATABASE_URL' }, async () => {
  const { body } = await get('/team/search?name-or-abbreviation=');
  const names = body.map(t => t.name);
  assert.strictEqual(names.length, 30);
  assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});
