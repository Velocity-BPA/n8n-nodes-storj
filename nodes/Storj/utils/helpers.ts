/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

/**
 * Convert bytes to human-readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parse size string to bytes (e.g., "10MB" -> 10485760)
 */
export function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|PB)?$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
    PB: 1024 ** 5,
  };
  
  return Math.floor(value * (multipliers[unit] || 1));
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Text
    txt: 'text/plain',
    csv: 'text/csv',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    json: 'application/json',
    xml: 'application/xml',
    
    // Archives
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Sanitize object key for S3 compatibility
 */
export function sanitizeKey(key: string): string {
  // Remove leading slashes
  let sanitized = key.replace(/^\/+/, '');
  
  // Replace multiple slashes with single slash
  sanitized = sanitized.replace(/\/+/g, '/');
  
  // Encode special characters but preserve slashes
  const parts = sanitized.split('/');
  return parts.map((part) => encodeURIComponent(part)).join('/');
}

/**
 * Parse S3 object key to extract bucket and key
 */
export function parseS3Path(path: string): { bucket: string; key: string } {
  // Handle s3:// URLs
  if (path.startsWith('s3://')) {
    path = path.slice(5);
  }
  
  // Remove leading slashes
  path = path.replace(/^\/+/, '');
  
  const parts = path.split('/');
  const bucket = parts[0];
  const key = parts.slice(1).join('/');
  
  return { bucket, key };
}

/**
 * Build execution data from response
 */
export function buildReturnData(
  items: IDataObject[],
  _executeFunctions: IExecuteFunctions,
  itemIndex: number,
): INodeExecutionData[] {
  return items.map((item) => ({
    json: item,
    pairedItem: { item: itemIndex },
  }));
}

/**
 * Flatten nested object for output
 */
export function flattenObject(
  obj: IDataObject,
  prefix: string = '',
  result: IDataObject = {},
): IDataObject {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value as IDataObject, newKey, result);
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Convert ISO date string to timestamp
 */
export function toTimestamp(dateStr: string): number {
  return new Date(dateStr).getTime();
}

/**
 * Convert timestamp to ISO date string
 */
export function toISOString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Calculate expiration time
 */
export function calculateExpiration(expiresIn: number): string {
  const expirationTime = Date.now() + expiresIn * 1000;
  return new Date(expirationTime).toISOString();
}

/**
 * Check if a date/time has expired
 */
export function isExpired(expirationStr: string): boolean {
  return new Date(expirationStr).getTime() < Date.now();
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Safe JSON parse with default
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}
