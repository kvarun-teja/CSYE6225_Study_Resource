# File Upload Verification

Manual end-to-end test of `POST /resources` file uploads against the real
`Resources` DynamoDB table and the real `csye6225-study-resources-926909118634`
S3 bucket (not mocked). Run locally with the server started via `node server.js`,
a test user registered via `POST /register`/`POST /login` for a real JWT, and
`curl` driving multipart requests. All test items/objects were deleted after
verification — nothing left behind in the shared table or bucket.

## Results

| # | Case | Expected | Result |
|---|---|---|---|
| 1 | Upload a valid `.pdf` | `201`, item has `s3Key`/`fileUrl`, `createdBy` set from the JWT | ✅ Pass |
| 2 | Object actually in S3 | `HeadObject` succeeds, correct size/content-type | ✅ Pass — `ContentLength` matched the uploaded file exactly, `ContentType: application/pdf` |
| 3 | Presigned download link | Downloading `fileUrl` returns the original file | ✅ Pass — downloaded bytes are identical to the uploaded file (`diff` clean) |
| 4 | Oversized file (26 MB, limit is 25 MB) | `400 { "error": "File must be 25 MB or smaller" }` | ✅ Pass |
| 5 | File just under the limit (24 MB) | `201` (succeeds) | ✅ Pass |
| 6 | Disallowed file type (`.txt`) | `400 { "error": "File type not supported" }` | ✅ Pass |
| 7 | URL-only submission (no file) | Still `201`, no `s3Key`/`fileUrl` on the item | ✅ Pass |
| 8 | Missing title | `400 { "error": "Title is required" }` | ✅ Pass |
| 9 | Neither URL nor file provided | `400 { "error": "Please provide a URL, upload a file, or both" }` | ✅ Pass |

## Notes

- The 25 MB check is enforced twice — once by `multer`'s `limits.fileSize`
  (rejects before the handler even runs) and again in `validation.js`'s
  `validateFile` — both paths were exercised and return the same message.
- Only `.pdf` was upload-tested end-to-end against S3; `.doc`/`.docx`/`.mp4`
  share the same `validateFile` allow-list check (extension + MIME type) and
  the same `uploadFile()` path, so they aren't expected to behave differently,
  but weren't individually pushed through a real S3 round-trip here.
