'use strict';

// Centralised config — all env vars read here so the rest of the app
// never touches process.env directly.
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  USERS_TABLE: process.env.USERS_TABLE || 'users',
  RESOURCES_TABLE: process.env.RESOURCES_TABLE || 'Resources',
  UPLOADS_BUCKET: process.env.UPLOADS_BUCKET || 'csye6225-study-resources-926909118634',
  PORT: parseInt(process.env.PORT, 10) || 3000,
};
