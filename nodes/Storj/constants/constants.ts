/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

export const STORJ_SATELLITES = {
  US1: 'us1.storj.io',
  EU1: 'eu1.storj.io',
  AP1: 'ap1.storj.io',
} as const;

export const STORJ_S3_ENDPOINTS = {
  GATEWAY: 'https://gateway.storjshare.io',
  LINK_SHARING: 'https://link.storjshare.io',
} as const;

export const STORJ_REGIONS = {
  'us1.storj.io': 'us-east-1',
  'eu1.storj.io': 'eu-west-1',
  'ap1.storj.io': 'ap-southeast-1',
} as const;

export const S3_ACL_OPTIONS = [
  { name: 'Private', value: 'private' },
  { name: 'Public Read', value: 'public-read' },
  { name: 'Public Read Write', value: 'public-read-write' },
  { name: 'Authenticated Read', value: 'authenticated-read' },
] as const;

export const STORAGE_CLASSES = {
  STANDARD: 'STANDARD',
} as const;

export const DEFAULT_MAX_KEYS = 1000;
export const DEFAULT_PART_SIZE = 64 * 1024 * 1024; // 64 MB
export const MIN_PART_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_PARTS = 10000;

export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const KEY_DERIVATION_ITERATIONS = 100000;
export const SALT_LENGTH = 32;
export const IV_LENGTH = 12;
export const AUTH_TAG_LENGTH = 16;

export const HTTP_METHODS = {
  GET: 'GET',
  PUT: 'PUT',
  POST: 'POST',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  XML: 'application/xml',
  OCTET_STREAM: 'application/octet-stream',
  TEXT_PLAIN: 'text/plain',
} as const;

export const ERROR_CODES = {
  BUCKET_NOT_FOUND: 'NoSuchBucket',
  KEY_NOT_FOUND: 'NoSuchKey',
  BUCKET_NOT_EMPTY: 'BucketNotEmpty',
  ACCESS_DENIED: 'AccessDenied',
  INVALID_ACCESS_KEY: 'InvalidAccessKeyId',
  SIGNATURE_MISMATCH: 'SignatureDoesNotMatch',
  UPLOAD_NOT_FOUND: 'NoSuchUpload',
  INVALID_PART: 'InvalidPart',
  ENTITY_TOO_LARGE: 'EntityTooLarge',
} as const;

export const PRESIGNED_URL_EXPIRATION = {
  MIN: 60, // 1 minute
  DEFAULT: 3600, // 1 hour
  MAX: 604800, // 7 days
} as const;

export const TRIGGER_POLL_INTERVAL = 60000; // 1 minute in milliseconds

export const LICENSING_NOTICE = `[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.`;

let licensingNoticeLogged = false;

export function logLicensingNotice(): void {
  if (!licensingNoticeLogged) {
    console.warn(LICENSING_NOTICE);
    licensingNoticeLogged = true;
  }
}
