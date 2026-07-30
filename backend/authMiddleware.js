'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');

/**
 * Express middleware — verifies a Bearer JWT on every protected request.
 *
 * TEAMMATES: import this file to guard your own endpoints, e.g.:
 *
 *   const authMiddleware = require('../authMiddleware');
 *   router.post('/resources', authMiddleware, yourHandler);
 *
 * On success the decoded payload is attached to req.user:
 *   req.user.userId   {string} — the user's UUID (generated at registration)
 *   req.user.username {string} — the user's username
 *
 * On failure (missing header, invalid token, expired token) responds
 * immediately with 401 { error: 'Unauthorized' } and stops the chain.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7); // strip the "Bearer " prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Expose only the fields teammates should depend on — if the JWT payload
    // shape ever changes, this is the single place to update.
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
    };
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = authMiddleware;
