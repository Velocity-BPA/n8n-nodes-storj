/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createStorjClient } from '../../transport/s3Client';
import { createShareUrl } from '../../utils/accessGrant';
import { calculateExpiration } from '../../utils/helpers';
import type { IStorjCredentials } from '../../utils/types';

export async function createShareLink(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const expiresIn = this.getNodeParameter('expiresIn', index, 3600) as number;
  const shareType = this.getNodeParameter('shareType', index, 'presigned') as string;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  const credentials = (await this.getCredentials('storjApi')) as unknown as IStorjCredentials;

  let shareUrl: string;
  let expiresAt: string;

  if (shareType === 'presigned') {
    // Generate presigned URL
    const client = await createStorjClient(this);
    shareUrl = client.generatePresignedUrl(bucketName, key, 'GET', expiresIn);
    expiresAt = calculateExpiration(expiresIn);
  } else if (shareType === 'linksharing') {
    // Use linksharing service
    if (credentials.authMethod !== 'accessGrant' || !credentials.accessGrant) {
      throw new NodeOperationError(
        this.getNode(),
        'Linksharing requires Access Grant authentication',
        { itemIndex: index },
      );
    }
    shareUrl = createShareUrl(bucketName, key, credentials.accessGrant);
    expiresAt = 'never'; // Linksharing URLs don't expire unless access grant expires
  } else {
    throw new NodeOperationError(this.getNode(), 'Invalid share type', { itemIndex: index });
  }

  return [
    {
      json: {
        url: shareUrl,
        bucket: bucketName,
        key,
        shareType,
        expiresAt,
        createdAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getShareInfo(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const shareUrl = this.getNodeParameter('shareUrl', index) as string;

  if (!shareUrl) {
    throw new NodeOperationError(this.getNode(), 'Share URL is required', { itemIndex: index });
  }

  // Parse the URL to extract information
  const url = new URL(shareUrl);
  const isPresigned = url.searchParams.has('X-Amz-Signature');
  const isLinksharing = url.hostname.includes('link.storjshare.io');

  let shareInfo: IDataObject = {
    url: shareUrl,
    type: isPresigned ? 'presigned' : isLinksharing ? 'linksharing' : 'unknown',
    host: url.hostname,
  };

  if (isPresigned) {
    const expiresParam = url.searchParams.get('X-Amz-Expires');
    const dateParam = url.searchParams.get('X-Amz-Date');
    
    if (expiresParam && dateParam) {
      // Parse the date and calculate expiration
      const year = dateParam.substring(0, 4);
      const month = dateParam.substring(4, 6);
      const day = dateParam.substring(6, 8);
      const hour = dateParam.substring(9, 11);
      const minute = dateParam.substring(11, 13);
      const second = dateParam.substring(13, 15);
      
      const createdDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
      const expirationDate = new Date(createdDate.getTime() + parseInt(expiresParam, 10) * 1000);
      
      shareInfo = {
        ...shareInfo,
        createdAt: createdDate.toISOString(),
        expiresAt: expirationDate.toISOString(),
        expiresInSeconds: parseInt(expiresParam, 10),
        isExpired: expirationDate.getTime() < Date.now(),
      };
    }

    // Extract path to get bucket and key
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      shareInfo.bucket = pathParts[0];
      shareInfo.key = pathParts.slice(1).join('/');
    }
  } else if (isLinksharing) {
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 3) {
      shareInfo.accessGrantPrefix = pathParts[1];
      shareInfo.bucket = pathParts[2];
      shareInfo.key = pathParts.slice(3).join('/');
    }
  }

  return [
    {
      json: shareInfo,
      pairedItem: { item: index },
    },
  ];
}

export async function revokeShare(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const shareUrl = this.getNodeParameter('shareUrl', index) as string;

  if (!shareUrl) {
    throw new NodeOperationError(this.getNode(), 'Share URL is required', { itemIndex: index });
  }

  const url = new URL(shareUrl);
  const isPresigned = url.searchParams.has('X-Amz-Signature');

  if (isPresigned) {
    return [
      {
        json: {
          status: 'info',
          message: 'Presigned URLs cannot be directly revoked. They will expire automatically based on their configured expiration time.',
          recommendation: 'To prevent future access, rotate your S3 credentials.',
          url: shareUrl,
          timestamp: new Date().toISOString(),
        },
        pairedItem: { item: index },
      },
    ];
  }

  // For linksharing URLs
  return [
    {
      json: {
        status: 'info',
        message: 'Linksharing URLs can be revoked by invalidating the associated access grant.',
        recommendation: 'Regenerate the parent access grant from your Storj satellite console to revoke all derived shares.',
        url: shareUrl,
        timestamp: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function setExpiration(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const expiresIn = this.getNodeParameter('expiresIn', index) as number;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  if (expiresIn < 60 || expiresIn > 604800) {
    throw new NodeOperationError(
      this.getNode(),
      'Expiration must be between 60 seconds (1 minute) and 604800 seconds (7 days)',
      { itemIndex: index },
    );
  }

  // Generate a new presigned URL with the specified expiration
  const client = await createStorjClient(this);
  const shareUrl = client.generatePresignedUrl(bucketName, key, 'GET', expiresIn);
  const expiresAt = calculateExpiration(expiresIn);

  return [
    {
      json: {
        url: shareUrl,
        bucket: bucketName,
        key,
        expiresIn,
        expiresAt,
        createdAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export const sharingOperations = {
  createShareLink,
  getShareInfo,
  revokeShare,
  setExpiration,
};
