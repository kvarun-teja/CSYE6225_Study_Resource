'use strict';

// Centralised config — all env vars read here so the rest of the app
// never touches process.env directly.
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  USERS_TABLE: process.env.USERS_TABLE || 'users',
  PORT: parseInt(process.env.PORT, 10) || 3000,
};
