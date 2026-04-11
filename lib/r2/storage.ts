import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * R2 Storage helper.
 *
 * Cloudflare R2 is S3-compatible. We use the AWS SDK with R2's endpoint.
 * Files are stored under: {user_id}/{file_hash}/{filename}
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_BUCKET_NAME       — R2 bucket name (e.g. "flow-me-ai")
 *   R2_ACCESS_KEY_ID     — R2 API Token → Access Key ID
 *   R2_SECRET_ACCESS_KEY — R2 API Token → Secret Access Key
 */

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function getBucket(): string {
  return process.env.R2_BUCKET_NAME || 'flow-me-ai';
}

/**
 * Build the R2 object key for a user's document.
 */
export function buildR2Key(userId: string, fileHash: string, filename: string): string {
  // Sanitize filename (keep extension, remove problematic chars)
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `users/${userId}/docs/${fileHash}/${safe}`;
}

/**
 * Upload a file to R2.
 */
export async function uploadToR2(opts: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  const client = getR2Client();

  await client.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: opts.key,
    Body: opts.body,
    ContentType: opts.contentType,
    Metadata: opts.metadata,
  }));
}

/**
 * Download a file from R2.
 * Returns the body as a readable stream.
 */
export async function downloadFromR2(key: string): Promise<{
  body: ReadableStream;
  contentType: string;
  contentLength: number;
}> {
  const client = getR2Client();

  const response = await client.send(new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }));

  if (!response.Body) {
    throw new Error('Empty response from R2');
  }

  return {
    body: response.Body.transformToWebStream(),
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: response.ContentLength || 0,
  };
}

/**
 * Get a presigned download URL (time-limited, no auth needed).
 * Default expiry: 1 hour.
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const client = getR2Client();

  return await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Delete a file from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();

  await client.send(new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }));
}

/**
 * Check if a file exists in R2.
 */
export async function existsInR2(key: string): Promise<boolean> {
  const client = getR2Client();

  try {
    await client.send(new HeadObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Compute SHA-256 hash of file content.
 */
export async function hashFileContent(content: ArrayBuffer | Buffer): Promise<string> {
  const data = content instanceof Buffer ? new Uint8Array(content) : new Uint8Array(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
