// One small connection pool per process. On Vercel each function instance
// gets its own, so the limit stays low.
const mysql = require('mysql2/promise');
const { connectionOptions } = require('./db-config');

const pool = mysql.createPool({
  ...connectionOptions(),
  connectionLimit: 3,
  enableKeepAlive: true,
});

module.exports = { pool };
