# Backend — Node.js and Express API

REST API for CSYE6225 Study Resource. This slice owns user registration and login, and issues JWTs that every other endpoint must verify. If you are building a protected endpoint (resources, voting, etc.), skip to [Using authMiddleware.js](#using-authmiddlewarejs).

**The backend also serves the frontend.** `server.js` serves the sibling `frontend/` directory as static files, with `home.html` as the default index. Visiting the EC2 URL directly (no path) loads the site — there's no separate frontend host/deployment.

---

## Requirements

- Node.js 18+
- A `backend/.env` file (copy from `.env.example` and fill in `JWT_SECRET`)
- AWS credentials supplied by the EC2 instance's IAM role — no key files needed on the instance; for local dev, configure `~/.aws/credentials` or set the standard AWS env vars in your shell

---

## Local setup

```bash
cd backend
cp .env.example .env          # then open .env and set JWT_SECRET
npm install
npm start                     # or: npm run dev  (uses node --watch)
```

The server listens on `PORT` (default `3000`).

---

## Environment variables

| Variable | Default | Required | Notes |
|---|---|---|---|
| `JWT_SECRET` | — | **Yes** | Long random string; signs and verifies all JWTs |
| `AWS_REGION` | `us-east-1` | No | Region where the DynamoDB table lives |
| `USERS_TABLE` | `users` | No | DynamoDB table name |
| `PORT` | `3000` | No | Express listen port |

`.env` is gitignored. Only `.env.example` (no real values) is committed.

---

## Endpoints

### `GET /health`

Load-balancer health check. No authentication required.

**Response `200`:**
```json
{ "status": "ok" }
```

---

### `POST /register`

Create a new user account.

**Request body:**
```json
{ "username": "alice", "password": "securePass1" }
```

**Validation rules:**
- Both `username` and `password` must be present.
- `username` must be ≥ 3 characters.
- `password` must be ≥ 8 characters.

**Responses:**

| Status | Body | Condition |
|---|---|---|
| `201` | `{ "userId": "<uuid>", "username": "alice" }` | Success |
| `400` | `{ "error": "<validation message>" }` | Missing field or length violation |
| `409` | `{ "error": "username already exists" }` | Duplicate username |
| `500` | `{ "error": "Internal server error" }` | Unexpected failure |

The `passwordHash` is **never** returned.

---

### `POST /login`

Authenticate and receive a signed JWT.

**Request body:**
```json
{ "username": "alice", "password": "securePass1" }
```

**Responses:**

| Status | Body | Condition |
|---|---|---|
| `200` | `{ "token": "<jwt>" }` | Success — token expires in 24 h |
| `401` | `{ "error": "Invalid credentials" }` | Username not found **or** wrong password (same message — intentional) |
| `500` | `{ "error": "Internal server error" }` | Unexpected failure |

---

## Using authMiddleware.js

Import `authMiddleware` from this file to protect any route in any teammate's module:

```js
'use strict';

const express = require('express');
const authMiddleware = require('../authMiddleware'); // adjust relative path

const router = express.Router();

router.post('/resources', authMiddleware, async (req, res) => {
  // authMiddleware has already verified the JWT and populated req.user
  const { userId, username } = req.user;
  // ... your handler logic
});
```

**What `req.user` contains after the middleware runs:**

| Field | Type | Description |
|---|---|---|
| `req.user.userId` | `string` | UUID generated at registration — use this as the canonical user identifier |
| `req.user.username` | `string` | The user's login handle |

If the `Authorization: Bearer <token>` header is missing, malformed, or the token is invalid/expired, the middleware responds `401 { "error": "Unauthorized" }` and the handler is **not** called.

---

## DynamoDB data model

Table name: `users` (partition key: `username`, type String — table created manually, not in code)

| Field | Type | Description |
|---|---|---|
| `username` | String (PK) | Unique login handle |
| `passwordHash` | String | bcrypt hash — never exposed in API responses |
| `userId` | String | UUID generated at registration — the stable user identifier |
| `createdAt` | String | ISO 8601 timestamp |

---

## File structure

```
backend/
├── server.js          — Entry point; loads dotenv, registers middleware and routes
├── config.js          — Reads all env vars; single source of truth for configuration
├── db.js              — DynamoDB Document client (region only; IAM role provides creds)
├── authMiddleware.js  — Shared JWT verification middleware — import this in your routes
├── routes/
│   └── auth.js        — Handlers for /health, /register, /login
├── package.json
├── .env.example       — Safe to commit; lists variable names with blank values
└── README.md
```
