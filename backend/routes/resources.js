'use strict';

const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const { ScanCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

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

// GET /resources — all resources, sorted by likes descending
router.get('/resources', async (req, res, next) => {
  try {
    const { Items } = await docClient.send(new ScanCommand({ TableName: RESOURCES_TABLE }));
    const resources = await Promise.all((Items || []).map(withPresignedUrl));
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
      createdBy: req.user.username,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: RESOURCES_TABLE, Item: item }));
    res.status(201).json(await withPresignedUrl(item));
  } catch (err) {
    next(err);
  }
}

async function castVote(field, req, res, next) {
  try {
    const { Attributes } = await docClient.send(
      new UpdateCommand({
        TableName: RESOURCES_TABLE,
        Key: { id: req.params.id },
        UpdateExpression: 'ADD #field :inc',
        ExpressionAttributeNames: { '#field': field },
        ExpressionAttributeValues: { ':inc': 1 },
        ConditionExpression: 'attribute_exists(id)',
        ReturnValues: 'ALL_NEW',
      })
    );
    res.json({ id: Attributes.id, likes: Attributes.likes, dislikes: Attributes.dislikes });
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(404).json({ error: 'Resource not found' });
    }
    next(err);
  }
}

router.post('/resources/:id/like', authMiddleware, (req, res, next) => castVote('likes', req, res, next));
router.post('/resources/:id/dislike', authMiddleware, (req, res, next) => castVote('dislikes', req, res, next));

module.exports = router;
