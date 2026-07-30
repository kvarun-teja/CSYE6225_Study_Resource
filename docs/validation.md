# Input Validation Rules

Rules the backend enforces on `POST /resources`. Validation happens server-side
before any database write. Requests that fail validation return `400 Bad Request`
with a clear error message.

The frontend applies the same rules for a better user experience,
but the backend never trusts the frontend.

---

## Field rules

### `title`

- Required
- Type: string
- Length: 1–100 characters
- Whitespace at the start and end is trimmed before validation
- Errors:
  - Missing or empty: `"Title is required"`
  - Too long: `"Title must be 100 characters or fewer"`

### `subject`

- Required
- Type: string, free text (no fixed list — the user can type anything, e.g. "Math" or a course code)
- Length: 1–50 characters
- Whitespace trimmed
- Errors:
  - Missing or empty: `"Subject is required"`
  - Too long: `"Subject must be 50 characters or fewer"`

### `url` and file — at least one required

A resource can have a link, an uploaded file, or both. There is no `type` field anymore.

- If neither a `url` nor a file is present: `"Please provide a URL, upload a file, or both"`

### `url`

- Optional — only validated if provided
- Must be a valid `http://` or `https://` URL
- Errors:
  - Malformed: `"URL must start with http:// or https://"`

### `note`

- Optional
- Type: string, free-form (multiple paragraphs are fine — line breaks are preserved when displayed)
- Length: up to 2000 characters
- Whitespace trimmed
- Errors:
  - Too long: `"Note must be 2000 characters or fewer"`

### File uploads

Sent as `multipart/form-data` in the same `POST /resources` request (not a separate endpoint):

- Optional — only validated if a file is attached
- Maximum file size: 25 MB
- Allowed MIME types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `video/mp4`
- Allowed extensions: `.pdf`, `.doc`, `.docx`, `.mp4`
- Errors:
  - Oversized: `"File must be 25 MB or smaller"`
  - Disallowed type: `"File type not supported"`

---

## Response format

All validation errors return HTTP `400 Bad Request` with a single error message:

```json
{ "error": "Title is required" }
```

If multiple rules fail on the same request, the backend returns the **first** failure only. The frontend can re-submit after the user fixes it.

---

## Server-generated fields

These are never accepted from the client — the backend always sets them:

- `id` — UUID v4, generated on create
- `likes` — starts at 0
- `dislikes` — starts at 0
- `createdAt` — ISO 8601 timestamp at the moment of creation

If the client sends any of these in the request body, they are ignored silently.

---

## Notes

- All validation is case-sensitive except URL scheme detection.
- The 25 MB file size limit is a project decision, not a DynamoDB or S3 limit.
- No PII (email, name, personal identifiers) is collected or stored.