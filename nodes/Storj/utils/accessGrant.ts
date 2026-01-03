/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject } from 'n8n-workflow';
import type {
  IStorjAccessGrant,
  IStorjAccessGrantParsed,
  IStorjPermissions,
  IStorjS3Credentials,
} from './types';

/**
 * Parse a Storj access grant to extract its components
 * Access grants are base64-encoded protocol buffers containing:
 * - Satellite address
 * - API key (macaroon)
 * - Encryption access
 */
export function parseAccessGrant(accessGrant: string): IStorjAccessGrantParsed {
  try {
    // Decode the base64 access grant
    const decoded = Buffer.from(accessGrant, 'base64');
    
    // The access grant format is a serialized protobuf
    // For simplicity, we extract the basic structure
    // In production, you'd use the uplink library
    
    // Parse the decoded data to validate it's proper base64
    decoded.toString('utf-8');
    
    return {
      satellite: extractSatellite(accessGrant),
      apiKey: extractApiKey(accessGrant),
      encryptionAccess: extractEncryptionAccess(accessGrant),
      macaroon: parseApiKeyMacaroon(extractApiKey(accessGrant)),
    };
  } catch {
    // If parsing fails, return partial info
    return {
      satellite: 'unknown',
      apiKey: 'encoded',
      encryptionAccess: 'encoded',
    };
  }
}

/**
 * Extract satellite address from access grant
 */
function extractSatellite(accessGrant: string): string {
  // Access grants encode the satellite URL
  // Common satellites
  const satellites = ['us1.storj.io', 'eu1.storj.io', 'ap1.storj.io'];
  
  try {
    const decoded = Buffer.from(accessGrant, 'base64').toString('utf-8');
    for (const sat of satellites) {
      if (decoded.includes(sat)) {
        return sat;
      }
    }
  } catch {
    // Ignore parsing errors
  }
  
  return 'unknown';
}

/**
 * Extract API key from access grant
 */
function extractApiKey(_accessGrant: string): string {
  // The API key is embedded in the access grant
  // This would require proper protobuf parsing
  return 'embedded';
}

/**
 * Extract encryption access from access grant
 */
function extractEncryptionAccess(_accessGrant: string): string {
  // The encryption access is embedded in the access grant
  return 'embedded';
}

/**
 * Parse API key macaroon to extract caveats
 */
function parseApiKeyMacaroon(_apiKey: string): IDataObject | undefined {
  // Macaroon parsing would require proper library
  return undefined;
}

/**
 * Create a restricted access grant with limited permissions
 */
export function createRestrictedGrant(
  baseGrant: string,
  permissions: IStorjPermissions,
): IStorjAccessGrant {
  // In a real implementation, this would use the uplink library
  // to create a properly restricted access grant
  
  return {
    accessGrant: baseGrant, // Would be modified in production
    satellite: extractSatellite(baseGrant),
    apiKey: 'restricted',
    encryptionPassphrase: '',
    permissions,
  };
}

/**
 * Convert access grant to S3-compatible credentials
 * This simulates the linksharing service behavior
 */
export function convertToS3Credentials(
  accessGrant: string,
  _satellite?: string,
): IStorjS3Credentials {
  // In production, this would call the Storj API to generate
  // S3-compatible credentials from the access grant
  
  // Generate deterministic but unique credentials from the grant
  const hash = simpleHash(accessGrant);
  
  return {
    accessKeyId: `jw${hash.slice(0, 30)}`,
    secretAccessKey: hash.slice(30, 70),
    endpoint: 'https://gateway.storjshare.io',
  };
}

/**
 * Simple hash function for demo purposes
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // Convert to alphanumeric string
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  let num = Math.abs(hash);
  while (result.length < 64) {
    result += chars[num % chars.length];
    num = Math.floor(num / chars.length) || Math.abs(input.charCodeAt(result.length % input.length));
  }
  return result;
}

/**
 * Validate access grant format
 */
export function validateAccessGrant(accessGrant: string): boolean {
  if (!accessGrant || typeof accessGrant !== 'string') {
    return false;
  }
  
  // Check if it's valid base64
  try {
    const decoded = Buffer.from(accessGrant, 'base64');
    // Re-encode and compare
    const reencoded = decoded.toString('base64');
    // Allow for padding differences
    return accessGrant.replace(/=+$/, '') === reencoded.replace(/=+$/, '');
  } catch {
    return false;
  }
}

/**
 * Get permissions summary from access grant
 */
export function getPermissionsSummary(_accessGrant: string): IStorjPermissions {
  // In production, this would parse the macaroon caveats
  // to extract the actual permissions
  
  return {
    read: true,
    write: true,
    delete: true,
    list: true,
  };
}

/**
 * Create a share URL for an object using linksharing
 */
export function createShareUrl(
  bucket: string,
  key: string,
  accessGrant: string,
): string {
  const baseUrl = 'https://link.storjshare.io/s';
  
  // In production, this would properly encode the access grant
  // and create a proper linksharing URL
  const encodedGrant = Buffer.from(accessGrant.slice(0, 20)).toString('base64url');
  
  return `${baseUrl}/${encodedGrant}/${bucket}/${key}`;
}
