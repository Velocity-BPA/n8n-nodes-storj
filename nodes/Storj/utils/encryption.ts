/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import * as crypto from 'crypto';
import type { IStorjEncryptionKey, IStorjEncryptedData } from './types';
import {
  ENCRYPTION_ALGORITHM,
  KEY_DERIVATION_ITERATIONS,
  SALT_LENGTH,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
} from '../constants/constants';

/**
 * Generate a new encryption key with salt
 */
export function generateEncryptionKey(passphrase?: string): IStorjEncryptionKey {
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  let key: Buffer;
  if (passphrase) {
    key = crypto.pbkdf2Sync(
      passphrase,
      salt,
      KEY_DERIVATION_ITERATIONS,
      32, // 256 bits
      'sha256',
    );
  } else {
    key = crypto.randomBytes(32);
  }
  
  return {
    key: key.toString('base64'),
    salt: salt.toString('base64'),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Derive encryption key from passphrase and salt
 */
export function deriveKey(passphrase: string, salt: string): Buffer {
  const saltBuffer = Buffer.from(salt, 'base64');
  return crypto.pbkdf2Sync(
    passphrase,
    saltBuffer,
    KEY_DERIVATION_ITERATIONS,
    32,
    'sha256',
  );
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encryptData(
  data: Buffer | string,
  key: string | Buffer,
): IStorjEncryptedData {
  const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'base64') : key;
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  
  const encrypted = Buffer.concat([
    cipher.update(dataBuffer),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    data: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    algorithm: ENCRYPTION_ALGORITHM,
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decryptData(
  encryptedData: IStorjEncryptedData,
  key: string | Buffer,
): Buffer {
  const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'base64') : key;
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.tag, 'base64');
  const data = Buffer.from(encryptedData.data, 'base64');
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]);
}

/**
 * Encrypt a file for Storj upload
 * Returns the encrypted data and encryption metadata
 */
export function encryptFile(
  fileData: Buffer,
  passphrase: string,
): { encrypted: Buffer; metadata: IStorjEncryptedData; salt: string } {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('base64');
  const key = deriveKey(passphrase, salt);
  const encryptedData = encryptData(fileData, key);
  
  // Combine IV, auth tag, and encrypted data into single buffer
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const tag = Buffer.from(encryptedData.tag, 'base64');
  const data = Buffer.from(encryptedData.data, 'base64');
  
  const encrypted = Buffer.concat([iv, tag, data]);
  
  return {
    encrypted,
    metadata: encryptedData,
    salt,
  };
}

/**
 * Decrypt a file downloaded from Storj
 */
export function decryptFile(
  encryptedBuffer: Buffer,
  passphrase: string,
  salt: string,
): Buffer {
  const key = deriveKey(passphrase, salt);
  
  // Extract IV, auth tag, and encrypted data from buffer
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const tag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const encryptedData: IStorjEncryptedData = {
    data: data.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    algorithm: ENCRYPTION_ALGORITHM,
  };
  
  return decryptData(encryptedData, key);
}

/**
 * Generate a secure random passphrase
 */
export function generatePassphrase(length: number = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomBytes = crypto.randomBytes(length);
  let passphrase = '';
  
  for (let i = 0; i < length; i++) {
    passphrase += chars[randomBytes[i] % chars.length];
  }
  
  return passphrase;
}

/**
 * Hash a passphrase for storage (not the encryption key itself)
 */
export function hashPassphrase(passphrase: string): string {
  return crypto.createHash('sha256').update(passphrase).digest('hex');
}

/**
 * Validate that a key is the correct format and length
 */
export function validateKey(key: string): boolean {
  try {
    const keyBuffer = Buffer.from(key, 'base64');
    return keyBuffer.length === 32; // 256 bits
  } catch {
    return false;
  }
}
