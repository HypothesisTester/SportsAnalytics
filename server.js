// Run the app locally: the API under /api, plus the built React app.
//   DATABASE_URL=... node server.js    (build the client first: npm run build)
const path = require('path');
const express = require('express');
const app = require('./server/app');

const build = path.join(__dirname, 'client', 'build');
app.use(express.static(build));
app.get('*', (req, res) => res.sendFile(path.join(build, 'index.html')));

const port = process.env.PORT || 6100;
app.listen(port, () => console.log(`Running at http://localhost:${port}`));
