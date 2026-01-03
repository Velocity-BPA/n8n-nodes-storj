/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { createStorjClient } from '../../transport/s3Client';
import type { IStorjCredentials } from '../../utils/types';
import { formatBytes } from '../../utils/helpers';

export async function getProjectInfo(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const credentials = (await this.getCredentials('storjApi')) as unknown as IStorjCredentials;

  // Extract project info from credentials
  const satellite =
    credentials.satellite === 'custom'
      ? credentials.customSatellite
      : credentials.satellite;

  return [
    {
      json: {
        satellite,
        endpoint: credentials.s3Endpoint,
        authMethod: credentials.authMethod,
        hasAccessKeyId: !!credentials.accessKeyId,
        hasAccessGrant: !!credentials.accessGrant,
        status: 'connected',
        queriedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getUsage(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  // Note: Storj doesn't expose usage stats via S3 API
  // This would require satellite API access
  // We provide estimated info based on bucket listings
  
  const client = await createStorjClient(this);
  
  // List all buckets
  const bucketsResponse = await client.listBuckets();
  const bucketsResult = (bucketsResponse as IDataObject).ListAllMyBucketsResult || bucketsResponse;
  const bucketsContainer = (bucketsResult as IDataObject).Buckets as IDataObject || {};
  const buckets = bucketsContainer.Bucket || [];
  const bucketList = Array.isArray(buckets) ? buckets : [buckets];

  let totalSize = 0;
  let totalObjects = 0;
  const bucketStats: IDataObject[] = [];

  for (const bucket of bucketList as IDataObject[]) {
    if (!bucket.Name) continue;
    
    try {
      const objectsResponse = await client.listObjects(bucket.Name as string);
      const result = (objectsResponse as IDataObject).ListBucketResult || objectsResponse;
      const contents = (result as IDataObject).Contents || [];
      const objects = Array.isArray(contents) ? contents : [contents];
      
      let bucketSize = 0;
      let objectCount = 0;
      
      for (const obj of objects as IDataObject[]) {
        if (obj.Size) {
          bucketSize += parseInt(obj.Size as string, 10) || 0;
          objectCount++;
        }
      }
      
      totalSize += bucketSize;
      totalObjects += objectCount;
      
      bucketStats.push({
        name: bucket.Name,
        objectCount,
        size: bucketSize,
        sizeFormatted: formatBytes(bucketSize),
      });
    } catch {
      // Skip buckets we can't access
      bucketStats.push({
        name: bucket.Name,
        error: 'Unable to access bucket',
      });
    }
  }

  return [
    {
      json: {
        totalBuckets: bucketList.length,
        totalObjects,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        bucketStats,
        note: 'This is an estimate based on visible objects. For accurate usage, check the Storj satellite console.',
        queriedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getLimits(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  // Storj limits are not exposed via S3 API
  // Provide standard Storj limits info
  
  const credentials = (await this.getCredentials('storjApi')) as unknown as IStorjCredentials;
  const satellite =
    credentials.satellite === 'custom'
      ? credentials.customSatellite
      : credentials.satellite;

  return [
    {
      json: {
        satellite,
        standardLimits: {
          storage: {
            free: '25 GB',
            paid: 'Unlimited (per usage)',
          },
          bandwidth: {
            free: '25 GB/month',
            paid: 'Unlimited (per usage)',
          },
          segments: {
            description: 'Each file creates at least one segment',
            free: '10,000 segments',
            paid: 'Unlimited (per usage)',
          },
          buckets: {
            limit: 100,
            description: 'Maximum buckets per project',
          },
          objectSize: {
            maxSingleUpload: '5 TB',
            multipartMinPartSize: '5 MB',
            multipartMaxParts: 10000,
          },
        },
        note: 'For your actual account limits, check the Storj satellite console.',
        queriedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getBilling(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  // Billing info is not available via S3 API
  // Provide pricing info and redirect to console
  
  const credentials = (await this.getCredentials('storjApi')) as unknown as IStorjCredentials;
  const satellite =
    credentials.satellite === 'custom'
      ? credentials.customSatellite
      : credentials.satellite;

  return [
    {
      json: {
        satellite,
        pricing: {
          storage: {
            rate: '$0.004/GB/month',
            description: 'Stored data',
          },
          bandwidth: {
            rate: '$0.007/GB',
            description: 'Data downloaded',
          },
          segments: {
            rate: '$0.0000088/segment/month',
            description: 'Per stored segment',
          },
        },
        freeAllowance: {
          storage: '25 GB',
          bandwidth: '25 GB/month',
          segments: '10,000',
        },
        note: 'For your actual billing details, visit the Storj satellite console.',
        billingUrl: `https://${satellite}/billing`,
        queriedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export const projectOperations = {
  getProjectInfo,
  getUsage,
  getLimits,
  getBilling,
};
