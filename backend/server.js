const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { randomUUID } = require('crypto');
const {
  ScanCommand,
  PutCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const { docClient, TABLE_NAME } = require('./db');
const { uploadFile, presignedUrl } = require('./s3');
const {
  validateTitle,
  validateSubject,
  validateHasUrlOrFile,
  validateUrl,
  validateNote,
  validateFile,
} = require('./validation');

const app = express();
const PORT = 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Swaps a stored (permanent) S3 url for a fresh, time-limited presigned one.
async function withPresignedUrl(item) {
  if (item.s3Key) {
    return { ...item, fileUrl: await presignedUrl(item.s3Key) };
  }
  return item;
}

// GET /resources — all resources, sorted by likes descending
app.get('/resources', async (req, res, next) => {
  try {
    const { Items } = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const resources = await Promise.all((Items || []).map(withPresignedUrl));
    resources.sort((a, b) => b.likes - a.likes);
    res.json(resources);
  } catch (err) {
    next(err);
  }
});

// POST /resources — create a resource (JSON body for links, multipart for files)
app.post('/resources', (req, res, next) => {
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

    let error =
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
      // multipart/form-data normalizes textarea line breaks to \r\n on the wire — collapse back to \n for storage
      note: typeof body.note === 'string' ? body.note.trim().replace(/\r\n/g, '\n') : '',
      likes: 0,
      dislikes: 0,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    res.status(201).json(await withPresignedUrl(item));
  } catch (err) {
    next(err);
  }
}

async function castVote(field, req, res, next) {
  try {
    const { Attributes } = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
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

app.post('/resources/:id/like', (req, res, next) => castVote('likes', req, res, next));
app.post('/resources/:id/dislike', (req, res, next) => castVote('dislikes', req, res, next));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
