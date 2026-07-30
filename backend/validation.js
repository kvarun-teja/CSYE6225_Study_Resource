const path = require('path');

const MAX_SUBJECT_LENGTH = 50;
const MAX_NOTE_LENGTH = 2000;

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.mp4'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
];
const MAX_FILE_BYTES = 25 * 1024 * 1024;

// Each function mirrors one field's rules from docs/validation.md,
// returning the error message on failure or null when valid.

function validateTitle(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return 'Title is required';
  if (title.length > 100) return 'Title must be 100 characters or fewer';
  return null;
}

// Subject is free text (e.g. "Math", "Web Development", or anything a user types) — no fixed list.
function validateSubject(body) {
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject) return 'Subject is required';
  if (subject.length > MAX_SUBJECT_LENGTH) return `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer`;
  return null;
}

// A resource may have a link, an uploaded file, or both — but not neither.
function validateHasUrlOrFile(body, file) {
  const hasUrl = typeof body.url === 'string' && body.url.trim();
  if (!hasUrl && !file) return 'Please provide a URL, upload a file, or both';
  return null;
}

// Only validated when a URL was actually provided — it's optional now that a file can stand alone.
function validateUrl(url) {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return 'URL must start with http:// or https://';
  return null;
}

function validateNote(body) {
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > MAX_NOTE_LENGTH) return `Note must be ${MAX_NOTE_LENGTH} characters or fewer`;
  return null;
}

// Only validated when a file was actually uploaded — it's optional now that a URL can stand alone.
function validateFile(file) {
  if (!file) return null;
  if (file.size > MAX_FILE_BYTES) return 'File must be 25 MB or smaller';
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return 'File type not supported';
  }
  return null;
}

module.exports = {
  validateTitle,
  validateSubject,
  validateHasUrlOrFile,
  validateUrl,
  validateNote,
  validateFile,
  MAX_SUBJECT_LENGTH,
  MAX_NOTE_LENGTH,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
};
