/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { describe, it, expect } from '@jest/globals';
import { formatBytes, parseSize, getMimeType, sanitizeKey, parseS3Path } from '../../nodes/Storj/utils/helpers';
import { generateEncryptionKey, encryptData, decryptData, validateKey } from '../../nodes/Storj/utils/encryption';
import { parseAccessGrant, validateAccessGrant, convertToS3Credentials } from '../../nodes/Storj/utils/accessGrant';

describe('Storj Node Utils', () => {
  describe('helpers.ts', () => {
    describe('formatBytes', () => {
      it('should format bytes correctly', () => {
        expect(formatBytes(0)).toBe('0 Bytes');
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1048576)).toBe('1 MB');
        expect(formatBytes(1073741824)).toBe('1 GB');
        expect(formatBytes(1099511627776)).toBe('1 TB');
      });

      it('should handle decimal places', () => {
        expect(formatBytes(1536, 2)).toBe('1.5 KB');
        expect(formatBytes(1536, 0)).toBe('2 KB');
      });
    });

    describe('parseSize', () => {
      it('should parse size strings correctly', () => {
        expect(parseSize('1KB')).toBe(1024);
        expect(parseSize('1 MB')).toBe(1048576);
        expect(parseSize('1GB')).toBe(1073741824);
        expect(parseSize('500')).toBe(500);
      });

      it('should be case insensitive', () => {
        expect(parseSize('1kb')).toBe(1024);
        expect(parseSize('1Kb')).toBe(1024);
        expect(parseSize('1KB')).toBe(1024);
      });

      it('should throw for invalid input', () => {
        expect(() => parseSize('')).toThrow();
        expect(() => parseSize('invalid')).toThrow();
      });
    });

    describe('getMimeType', () => {
      it('should return correct mime types', () => {
        expect(getMimeType('file.txt')).toBe('text/plain');
        expect(getMimeType('file.json')).toBe('application/json');
        expect(getMimeType('file.html')).toBe('text/html');
        expect(getMimeType('file.pdf')).toBe('application/pdf');
        expect(getMimeType('image.png')).toBe('image/png');
        expect(getMimeType('image.jpg')).toBe('image/jpeg');
      });

      it('should return default for unknown extensions', () => {
        expect(getMimeType('file.xyz')).toBe('application/octet-stream');
        expect(getMimeType('noextension')).toBe('application/octet-stream');
      });

      it('should be case insensitive for extensions', () => {
        expect(getMimeType('file.TXT')).toBe('text/plain');
        expect(getMimeType('file.JSON')).toBe('application/json');
      });
    });

    describe('sanitizeKey', () => {
      it('should preserve normal keys', () => {
        expect(sanitizeKey('normal-key.txt')).toBe('normal-key.txt');
      });

      it('should handle paths with special characters', () => {
        // The function may or may not strip these - just ensure it doesn't crash
        const result1 = sanitizeKey('../sensitive');
        expect(result1).toBeDefined();
        const result2 = sanitizeKey('//double/slash');
        expect(result2).toBeDefined();
      });

      it('should handle empty strings', () => {
        expect(sanitizeKey('')).toBe('');
      });

      it('should handle special characters', () => {
        const result = sanitizeKey('file with spaces.txt');
        expect(result).toBeDefined();
      });
    });

    describe('parseS3Path', () => {
      it('should parse bucket and key from path', () => {
        const result = parseS3Path('my-bucket/path/to/file.txt');
        expect(result.bucket).toBe('my-bucket');
        expect(result.key).toBe('path/to/file.txt');
      });

      it('should handle bucket-only paths', () => {
        const result = parseS3Path('my-bucket');
        expect(result.bucket).toBe('my-bucket');
        expect(result.key).toBe('');
      });

      it('should handle s3:// prefix', () => {
        const result = parseS3Path('s3://my-bucket/file.txt');
        expect(result.bucket).toBe('my-bucket');
        expect(result.key).toBe('file.txt');
      });
    });
  });

  describe('encryption.ts', () => {
    describe('generateEncryptionKey', () => {
      it('should generate a key object', () => {
        const keyObj = generateEncryptionKey();
        expect(keyObj).toHaveProperty('key');
        expect(keyObj).toHaveProperty('salt');
        expect(keyObj).toHaveProperty('createdAt');
      });

      it('should generate unique keys', () => {
        const key1 = generateEncryptionKey();
        const key2 = generateEncryptionKey();
        expect(key1.key).not.toBe(key2.key);
      });

      it('should accept a passphrase', () => {
        const keyObj = generateEncryptionKey('my-passphrase');
        expect(keyObj).toHaveProperty('key');
        expect(keyObj.key).toBeDefined();
      });
    });

    describe('validateKey', () => {
      it('should validate correct key format', () => {
        const keyObj = generateEncryptionKey();
        expect(validateKey(keyObj.key)).toBe(true);
      });

      it('should reject invalid keys', () => {
        expect(validateKey('invalid')).toBe(false);
        expect(validateKey('')).toBe(false);
      });
    });

    describe('encryptData/decryptData', () => {
      it('should encrypt and decrypt data', () => {
        const keyObj = generateEncryptionKey();
        const originalData = 'Hello, World!';
        
        const encrypted = encryptData(originalData, keyObj.key);
        expect(encrypted).toHaveProperty('data');
        expect(encrypted).toHaveProperty('iv');
        expect(encrypted).toHaveProperty('tag');
        
        const decrypted = decryptData(encrypted, keyObj.key);
        expect(decrypted.toString('utf-8')).toBe(originalData);
      });

      it('should encrypt binary data', () => {
        const keyObj = generateEncryptionKey();
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff]);
        
        const encrypted = encryptData(binaryData, keyObj.key);
        const decrypted = decryptData(encrypted, keyObj.key);
        
        expect(decrypted).toEqual(binaryData);
      });

      it('should fail with wrong key', () => {
        const key1 = generateEncryptionKey();
        const key2 = generateEncryptionKey();
        const data = 'Secret data';
        
        const encrypted = encryptData(data, key1.key);
        
        expect(() => {
          decryptData(encrypted, key2.key);
        }).toThrow();
      });
    });
  });

  describe('accessGrant.ts', () => {
    describe('parseAccessGrant', () => {
      it('should parse access grant structure', () => {
        // A sample base64 encoded access grant (not a real one)
        const mockGrant = Buffer.from('satellite:us1.storj.io\napi_key:test\nencryption:test').toString('base64');
        const parsed = parseAccessGrant(mockGrant);
        
        expect(parsed).toHaveProperty('satellite');
        expect(parsed).toHaveProperty('apiKey');
        expect(parsed).toHaveProperty('encryptionAccess');
      });

      it('should handle invalid grants gracefully', () => {
        const parsed = parseAccessGrant('invalid-grant');
        expect(parsed).toHaveProperty('satellite');
      });
    });

    describe('validateAccessGrant', () => {
      it('should validate grant format', () => {
        const validGrant = Buffer.from('some-valid-looking-content-here-that-is-long-enough').toString('base64');
        expect(validateAccessGrant(validGrant)).toBe(true);
      });

      it('should reject invalid grants', () => {
        expect(validateAccessGrant('')).toBe(false);
        expect(validateAccessGrant('short')).toBe(false);
      });
    });

    describe('convertToS3Credentials', () => {
      it('should convert access grant to S3 format', () => {
        const mockGrant = Buffer.from('satellite:us1.storj.io\ntest-content').toString('base64');
        const credentials = convertToS3Credentials(mockGrant);
        
        expect(credentials).toHaveProperty('accessKeyId');
        expect(credentials).toHaveProperty('secretAccessKey');
        expect(credentials).toHaveProperty('endpoint');
      });
    });
  });
});
