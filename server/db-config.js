// Database connection settings, from the environment (never from a committed file).
//
//   DATABASE_URL  mysql://user:password@host:port/database
//   DB_SSL        "false" to connect without TLS (a local MySQL). TiDB Cloud requires TLS.

function connectionOptions(url = process.env.DATABASE_URL) {
  if (!url) {
    throw new Error('DATABASE_URL is not set. See README: Running locally.');
  }
  const u = new URL(url);
  const database = decodeURIComponent(u.pathname.slice(1)) || 'sports_betting';
  if (!/^\w+$/.test(database)) throw new Error(`Unexpected database name: ${database}`);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
    ssl: process.env.DB_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    // Dates as 'YYYY-MM-DD' strings, not Date objects shifted by the server's timezone.
    dateStrings: true,
    // AVG() and SUM() of whole-number columns are DECIMAL: send them as numbers,
    // which the frontend formats with toFixed().
    decimalNumbers: true,
  };
}

module.exports = { connectionOptions };
