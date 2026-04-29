/**
 * S3 client — single shared instance.
 *
 * In dev: points at MinIO via the env vars in .env.local.
 * In prod: points at AWS S3 in eu-west-2; credentials come from the IAM role
 * the ECS task runs under, so no access keys live in env vars.
 */
import { S3Client } from '@aws-sdk/client-s3';

const region = process.env.S3_REGION ?? 'eu-west-2';
const endpoint = process.env.S3_ENDPOINT;
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

export const s3 = new S3Client({
  region,
  // Only set endpoint + path-style when we're talking to MinIO. In production
  // these env vars are unset and the SDK uses the default AWS endpoint.
  ...(endpoint ? { endpoint, forcePathStyle } : {}),
  // If creds aren't in env (the prod case under ECS), the SDK falls back to
  // the instance/task role automatically.
  ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
});

export const S3_BUCKET = process.env.S3_BUCKET ?? 'dsd-lim-dev';
