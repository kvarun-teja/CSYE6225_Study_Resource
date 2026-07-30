'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto'); // built-in since Node 14.17
const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const docClient = require('../db');
const { JWT_SECRET, USERS_TABLE } = require('../config');

const router = express.Router();

// ── Health ────────────────────────────────────────────────────────────────────

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ── Register ──────────────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};

  // Validation
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'username must be at least 3 characters' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  try {
    // Check for duplicate username — partition key lookup is a consistent read
    const existing = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { username },
    }));

    if (existing.Item) {
      return res.status(409).json({ error: 'username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();
    const createdAt = new Date().toISOString();

    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: { username, passwordHash, userId, createdAt },
    }));

    // Never return passwordHash
    return res.status(201).json({ userId, username });
  } catch (err) {
    console.error('POST /register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  // Treat missing credentials as invalid rather than 400 so the response
  // gives no hint about which field is wrong.
  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { username },
    }));

    const user = result.Item;

    // Deliberately use the same message for "user not found" and "wrong
    // password" to avoid username-enumeration attacks.
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Payload teammates can depend on — must stay in sync with authMiddleware.js
    const token = jwt.sign(
      { userId: user.userId, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({ token });
  } catch (err) {
    console.error('POST /login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
