'use strict';

// dotenv must be loaded before any other local require so that config.js
// reads the populated process.env.
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const authRoutes = require('./routes/auth');
const resourceRoutes = require('./routes/resources');

const app = express();
app.use(cors());
app.use(express.json());

// API routes are registered before static serving so they take precedence
// over any same-named file in frontend/.
app.use('/', authRoutes);
app.use('/', resourceRoutes);

// Serve the frontend (sibling directory) from the same origin/port as the API.
app.use(express.static(path.join(__dirname, '..', 'frontend'), { index: 'home.html' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
