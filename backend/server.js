'use strict';

// dotenv must be loaded before any other local require so that config.js
// reads the populated process.env.
require('dotenv').config();

const express = require('express');
const { PORT } = require('./config');
const authRoutes = require('./routes/auth');

const app = express();
app.use(express.json());

app.use('/', authRoutes);

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
