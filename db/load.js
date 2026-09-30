// Create the tables and load the CSVs in data/ into MySQL or TiDB.
//
//   DATABASE_URL='mysql://user:password@host:4000/sports_betting' node db/load.js
//
// With --derived, only the derived tables are rebuilt from the loaded data
// (after a change to db/derived.sql); the six source tables are left alone.
//
// Safe to re-run: the tables are recreated and reloaded each time. Connections use
// TLS unless DB_SSL=false (for a local MySQL). With APP_DB_PASSWORD set, it
// also creates the read-only user the website connects as (see README).

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { parse } = require('csv-parse');
const { connectionOptions } = require('../server/db-config');

const DATA = path.join(__dirname, '..', 'data');
const BATCH = 2000;

// Table -> CSV. Columns are matched by the CSV's header row.
const TABLES = [
  ['teams', 'teams.csv'],
  ['players', 'nba_players.csv'],
  ['game_data', 'nba_games.csv'],
  ['player_stats', 'nba_players_stats.csv'],
  ['betting_data', 'nba_betting.csv'],
  ['topmatchups', 'topmatchups.csv'],
];

async function loadTable(db, table, file) {
  const parser = fs.createReadStream(path.join(DATA, file)).pipe(parse({ columns: true }));
  let columns = null;
  let batch = [];
  let count = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    await db.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`, [batch]);
    count += batch.length;
    batch = [];
    if (count % 100000 < BATCH) console.log(`  ${table}: ${count.toLocaleString()} rows...`);
  };
  for await (const record of parser) {
    columns ??= Object.keys(record);
    batch.push(columns.map(c => (record[c] === '' ? null : record[c])));
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.log(`  ${table}: ${count.toLocaleString()} rows`);
  const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
  if (n !== count) throw new Error(`${table}: loaded ${count} rows but the table has ${n}`);
  return count;
}

async function createReadOnlyUser(db, database, password) {
  // TiDB Cloud usernames carry the cluster's prefix, e.g. "2abc.root", and new
  // users must share it. A plain MySQL user has no prefix.
  const [[{ me }]] = await db.query('SELECT CURRENT_USER() AS me');
  const name = me.split('@')[0];
  const prefix = name.includes('.') ? name.slice(0, name.indexOf('.') + 1) : '';
  const user = `${prefix}web`;
  await db.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [user, '%', password]);
  await db.query('ALTER USER ?@? IDENTIFIED BY ?', [user, '%', password]);
  await db.query(`GRANT SELECT ON ${database}.* TO ?@?`, [user, '%']);
  console.log(`Read-only user: ${user} (SELECT on ${database} only)`);
}

async function main() {
  const { database, ...options } = connectionOptions();
  const db = await mysql.createConnection({ ...options, multipleStatements: true });
  await db.query(`CREATE DATABASE IF NOT EXISTS ${database}`);
  await db.query(`USE ${database}`);
  const derived = ['player_averages', 'player_spread_totals', 'player_underdog_totals'];
  if (process.argv.includes('--derived')) {
    await db.query(`DROP TABLE IF EXISTS ${derived.join(', ')}`);
    // schema.sql uses CREATE TABLE IF NOT EXISTS, so only the dropped tables are made.
    await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log(`Rebuilding derived tables in ${options.host}/${database}...`);
    await db.query(fs.readFileSync(path.join(__dirname, 'derived.sql'), 'utf8'));
    for (const t of derived) {
      const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM ${t}`);
      console.log(`  ${t}: ${n.toLocaleString()} rows`);
    }
    await db.end();
    console.log('Done.');
    return;
  }
  // A full reload: recreate every table, so schema changes take effect.
  await db.query(`DROP TABLE IF EXISTS ${[...TABLES.map(([t]) => t), ...derived].join(', ')}`);
  await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log(`Loading into ${options.host}/${database}`);
  for (const [table, file] of TABLES) await loadTable(db, table, file);
  console.log('  derived tables (db/derived.sql)...');
  await db.query(fs.readFileSync(path.join(__dirname, 'derived.sql'), 'utf8'));
  if (process.env.APP_DB_PASSWORD) await createReadOnlyUser(db, database, process.env.APP_DB_PASSWORD);
  await db.end();
  console.log('Done.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
