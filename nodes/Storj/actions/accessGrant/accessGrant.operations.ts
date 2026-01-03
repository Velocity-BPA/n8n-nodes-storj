/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
  parseAccessGrant,
  createRestrictedGrant,
  validateAccessGrant,
  getPermissionsSummary,
} from '../../utils/accessGrant';
import type { IStorjPermissions } from '../../utils/types';

export async function createAccessGrantOperation(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const credentials = await this.getCredentials('storjApi');
  
  // Check if using access grant auth method
  if (credentials.authMethod !== 'accessGrant') {
    throw new NodeOperationError(
      this.getNode(),
      'Creating access grants requires the Access Grant authentication method. Please configure your credentials with an Access Grant.',
      { itemIndex: index },
    );
  }

  const baseGrant = credentials.accessGrant as string;
  if (!baseGrant || !validateAccessGrant(baseGrant)) {
    throw new NodeOperationError(this.getNode(), 'Invalid base access grant in credentials', {
      itemIndex: index,
    });
  }

  // Get permissions from parameters
  const allowRead = this.getNodeParameter('allowRead', index, true) as boolean;
  const allowWrite = this.getNodeParameter('allowWrite', index, true) as boolean;
  const allowDelete = this.getNodeParameter('allowDelete', index, false) as boolean;
  const allowList = this.getNodeParameter('allowList', index, true) as boolean;
  
  const additionalFields = this.getNodeParameter('additionalFields', index, {}) as IDataObject;
  const buckets = additionalFields.buckets as string;
  const prefixes = additionalFields.prefixes as string;
  const notBefore = additionalFields.notBefore as string;
  const notAfter = additionalFields.notAfter as string;

  const permissions: IStorjPermissions = {
    read: allowRead,
    write: allowWrite,
    delete: allowDelete,
    list: allowList,
    buckets: buckets ? buckets.split(',').map((b) => b.trim()) : undefined,
    prefixes: prefixes ? prefixes.split(',').map((p) => p.trim()) : undefined,
    notBefore: notBefore || undefined,
    notAfter: notAfter || undefined,
  };

  const newGrant = createRestrictedGrant(baseGrant, permissions);

  return [
    {
      json: {
        accessGrant: newGrant.accessGrant,
        satellite: newGrant.satellite,
        permissions: newGrant.permissions,
        createdAt: new Date().toISOString(),
        note: 'This is a derived access grant with restricted permissions',
      },
      pairedItem: { item: index },
    },
  ];
}

export async function revokeAccessGrant(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  // Note: Storj access grants cannot be directly revoked via API
  // The recommended approach is to regenerate the parent access grant
  // This operation provides guidance
  
  const accessGrantToRevoke = this.getNodeParameter('accessGrant', index) as string;

  if (!accessGrantToRevoke) {
    throw new NodeOperationError(this.getNode(), 'Access grant to revoke is required', {
      itemIndex: index,
    });
  }

  if (!validateAccessGrant(accessGrantToRevoke)) {
    throw new NodeOperationError(this.getNode(), 'Invalid access grant format', {
      itemIndex: index,
    });
  }

  // Parse the grant to provide info
  const parsed = parseAccessGrant(accessGrantToRevoke);

  return [
    {
      json: {
        status: 'revocation_guidance',
        message: 'Storj access grants cannot be directly revoked. To invalidate this access grant, you must regenerate the parent access grant or API key from the Storj satellite console.',
        grantInfo: {
          satellite: parsed.satellite,
        },
        recommendations: [
          'Log into your Storj satellite console',
          'Navigate to Access Keys section',
          'Regenerate the parent API key',
          'Create new access grants for authorized users',
        ],
        timestamp: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function parseAccessGrantOperation(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const accessGrant = this.getNodeParameter('accessGrant', index) as string;

  if (!accessGrant) {
    throw new NodeOperationError(this.getNode(), 'Access grant is required', { itemIndex: index });
  }

  if (!validateAccessGrant(accessGrant)) {
    throw new NodeOperationError(this.getNode(), 'Invalid access grant format', {
      itemIndex: index,
    });
  }

  const parsed = parseAccessGrant(accessGrant);
  const permissions = getPermissionsSummary(accessGrant);

  return [
    {
      json: {
        satellite: parsed.satellite,
        apiKey: parsed.apiKey,
        encryptionAccess: parsed.encryptionAccess,
        permissions,
        isValid: true,
        parsedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function restrictAccessGrant(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const accessGrant = this.getNodeParameter('accessGrant', index) as string;
  
  if (!accessGrant) {
    throw new NodeOperationError(this.getNode(), 'Access grant is required', { itemIndex: index });
  }

  if (!validateAccessGrant(accessGrant)) {
    throw new NodeOperationError(this.getNode(), 'Invalid access grant format', {
      itemIndex: index,
    });
  }

  // Get restriction parameters
  const restrictToBuckets = this.getNodeParameter('restrictToBuckets', index, '') as string;
  const restrictToPrefixes = this.getNodeParameter('restrictToPrefixes', index, '') as string;
  const expiresAt = this.getNodeParameter('expiresAt', index, '') as string;
  const removeWrite = this.getNodeParameter('removeWrite', index, false) as boolean;
  const removeDelete = this.getNodeParameter('removeDelete', index, false) as boolean;

  const permissions: IStorjPermissions = {
    read: true,
    write: !removeWrite,
    delete: !removeDelete,
    list: true,
    buckets: restrictToBuckets ? restrictToBuckets.split(',').map((b) => b.trim()) : undefined,
    prefixes: restrictToPrefixes ? restrictToPrefixes.split(',').map((p) => p.trim()) : undefined,
    notAfter: expiresAt || undefined,
  };

  const restrictedGrant = createRestrictedGrant(accessGrant, permissions);

  return [
    {
      json: {
        originalGrant: accessGrant.substring(0, 20) + '...',
        restrictedGrant: restrictedGrant.accessGrant,
        restrictions: {
          buckets: permissions.buckets || 'all',
          prefixes: permissions.prefixes || 'all',
          expiresAt: permissions.notAfter || 'never',
          canWrite: permissions.write,
          canDelete: permissions.delete,
        },
        createdAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export const accessGrantOperations = {
  createAccessGrant: createAccessGrantOperation,
  revokeAccessGrant,
  parseAccessGrant: parseAccessGrantOperation,
  restrictAccessGrant,
};
