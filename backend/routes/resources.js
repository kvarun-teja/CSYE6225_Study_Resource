'use strict';

const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const { ScanCommand, PutCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const docClient = require('../db');
const { RESOURCES_TABLE } = require('../config');
const { uploadFile, presignedUrl } = require('../s3');
const authMiddleware = require('../authMiddleware');
const {
  validateTitle,
  validateSubject,
  validateHasUrlOrFile,
  validateUrl,
  validateNote,
  validateFile,
  MAX_FILE_BYTES,
} = require('../validation');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

// Swaps a stored S3 key for a fresh, time-limited presigned URL so links
// handed to the browser never go stale.
async function withPresignedUrl(item) {
  if (item.s3Key) {
    return { ...item, fileUrl: await presignedUrl(item.s3Key) };
  }
  return item;
}

// Never expose the raw voters map — it's other people's voting history, and it
// grows unboundedly. Callers get only their own vote, as `myVote`.
function publicView(item, username) {
  const { voters, ...rest } = item;
  return {
    ...rest,
    likes: item.likes || 0,
    dislikes: item.dislikes || 0,
    myVote: (username && voters && voters[username]) || null,
  };
}

// GET /resources — all resources, sorted by likes descending.
// Public, but auth-aware: a signed-in caller also gets their own myVote.
router.get('/resources', authMiddleware.optional, async (req, res, next) => {
  try {
    const username = req.user && req.user.username;
    const { Items } = await docClient.send(new ScanCommand({ TableName: RESOURCES_TABLE }));
    const resources = await Promise.all(
      (Items || []).map(async (item) => publicView(await withPresignedUrl(item), username))
    );
    resources.sort((a, b) => b.likes - a.likes);
    res.json(resources);
  } catch (err) {
    next(err);
  }
});

// POST /resources — create a resource (JSON body for links, multipart when a file is attached)
router.post('/resources', authMiddleware, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File must be 25 MB or smaller' });
      }
      return next(err);
    }
    createResource(req, res, next);
  });
});

async function createResource(req, res, next) {
  try {
    const body = req.body;

    const error =
      validateTitle(body) ||
      validateSubject(body) ||
      validateHasUrlOrFile(body, req.file) ||
      validateUrl(body.url) ||
      validateFile(req.file) ||
      validateNote(body);
    if (error) return res.status(400).json({ error });

    const url = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : undefined;

    let fileUrl;
    let s3Key;
    if (req.file) {
      const uploaded = await uploadFile(req.file);
      fileUrl = uploaded.url;
      s3Key = uploaded.key;
    }

    const item = {
      id: randomUUID(),
      title: body.title.trim(),
      subject: body.subject.trim(),
      ...(url && { url }),
      ...(fileUrl && { fileUrl }),
      ...(s3Key && { s3Key }),
      // multipart/form-data normalizes textarea line breaks to \r\n on the wire —
      // collapse back to \n for storage
      note: typeof body.note === 'string' ? body.note.trim().replace(/\r\n/g, '\n') : '',
      likes: 0,
      dislikes: 0,
      voters: {},
      createdBy: req.user.username,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: RESOURCES_TABLE, Item: item }));
    res.status(201).json(publicView(await withPresignedUrl(item), req.user.username));
  } catch (err) {
    next(err);
  }
}

// Each resource carries a `voters` map of { username: 'like' | 'dislike' }, so a
// person holds at most one vote on a resource. Clicking your current vote clears
// it; clicking the opposite one switches sides. The counters and the map are
// always changed in the same conditional write, so they cannot drift apart.
const COUNTER = { like: 'likes', dislike: 'dislikes' };

async function applyVote(id, username, choice) {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: RESOURCES_TABLE, Key: { id }, ConsistentRead: true })
  );
  if (!Item) return { notFound: true };

  const current = Item.voters ? Item.voters[username] : undefined;

  // Legacy rows predate the voters map; create it before writing a path inside it.
  if (!Item.voters) {
    await docClient.send(
      new UpdateCommand({
        TableName: RESOURCES_TABLE,
        Key: { id },
        UpdateExpression: 'SET #voters = if_not_exists(#voters, :empty)',
        ExpressionAttributeNames: { '#voters': 'voters' },
        ExpressionAttributeValues: { ':empty': {} },
        ConditionExpression: 'attribute_exists(id)',
      })
    );
  }

  const names = { '#voters': 'voters', '#u': username, '#c': COUNTER[choice] };
  let params;

  if (current === choice) {
    // Same button again — withdraw the vote.
    params = {
      UpdateExpression: 'REMOVE #voters.#u ADD #c :minus',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: { ':minus': -1, ':cur': choice },
      ConditionExpression: '#voters.#u = :cur',
    };
  } else if (current === undefined) {
    // First vote from this user on this resource.
    params = {
      UpdateExpression: 'SET #voters.#u = :choice ADD #c :plus',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: { ':choice': choice, ':plus': 1 },
      ConditionExpression: 'attribute_not_exists(#voters.#u)',
    };
  } else {
    // Switching sides — move the count from one counter to the other.
    params = {
      UpdateExpression: 'SET #voters.#u = :choice ADD #c :plus, #o :minus',
      ExpressionAttributeNames: { ...names, '#o': COUNTER[current] },
      ExpressionAttributeValues: {
        ':choice': choice,
        ':plus': 1,
        ':minus': -1,
        ':cur': current,
      },
      ConditionExpression: '#voters.#u = :cur',
    };
  }

  const { Attributes } = await docClient.send(
    new UpdateCommand({
      TableName: RESOURCES_TABLE,
      Key: { id },
      ReturnValues: 'ALL_NEW',
      ...params,
    })
  );
  return { item: Attributes };
}

async function castVote(choice, req, res, next) {
  const { id } = req.params;
  const { username } = req.user;

  // The condition only fails if this user's vote changed between our read and
  // write (a double-click, or the same account in two tabs) — re-read and redo.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { notFound, item } = await applyVote(id, username, choice);
      if (notFound) return res.status(404).json({ error: 'Resource not found' });
      return res.json({
        id: item.id,
        likes: item.likes || 0,
        dislikes: item.dislikes || 0,
        myVote: (item.voters && item.voters[username]) || null,
      });
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') return next(err);
    }
  }
  return res.status(409).json({ error: 'Vote conflicted, please try again' });
}

router.post('/resources/:id/like', authMiddleware, (req, res, next) => castVote('like', req, res, next));
router.post('/resources/:id/dislike', authMiddleware, (req, res, next) => castVote('dislike', req, res, next));

module.exports = router;
