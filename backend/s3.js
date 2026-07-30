const path = require('path');
const { randomUUID } = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.UPLOADS_BUCKET || 'csye6225-study-resources-926909118634';

const s3 = new S3Client({ region: REGION });

async function uploadFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const key = `uploads/${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return { key, url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}` };
}

function presignedUrl(key, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

module.exports = { uploadFile, presignedUrl, BUCKET, REGION };
