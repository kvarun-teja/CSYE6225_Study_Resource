'use strict';

const path = require('path');
const { randomUUID } = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { AWS_REGION, UPLOADS_BUCKET } = require('./config');

// Region only — credentials come from the EC2 instance's IAM role at runtime.
const s3 = new S3Client({ region: AWS_REGION });

async function uploadFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const key = `uploads/${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: UPLOADS_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return { key, url: `https://${UPLOADS_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}` };
}

function presignedUrl(key, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key }), { expiresIn });
}

module.exports = { uploadFile, presignedUrl };
