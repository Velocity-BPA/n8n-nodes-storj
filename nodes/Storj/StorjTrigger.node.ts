/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
  IPollFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { createStorjClient, StorjS3Client } from './transport/s3Client';
import { formatBytes } from './utils/helpers';
import { logLicensingNotice } from './constants/constants';

// Log licensing notice once on module load
logLicensingNotice();

export class StorjTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Storj Trigger',
    name: 'storjTrigger',
    icon: 'file:storj.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["triggerType"]}}',
    description: 'Trigger workflows based on Storj events',
    defaults: {
      name: 'Storj Trigger',
    },
    polling: true,
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'storjApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Trigger Type',
        name: 'triggerType',
        type: 'options',
        options: [
          {
            name: 'New Object Uploaded',
            value: 'newObjectUploaded',
            description: 'Triggers when a new object is uploaded to a bucket',
          },
          {
            name: 'Object Deleted',
            value: 'objectDeleted',
            description: 'Triggers when an object is deleted from a bucket',
          },
          {
            name: 'Bucket Created',
            value: 'bucketCreated',
            description: 'Triggers when a new bucket is created',
          },
          {
            name: 'Usage Threshold Alert',
            value: 'usageThresholdAlert',
            description: 'Triggers when storage or bandwidth usage exceeds a threshold',
          },
        ],
        default: 'newObjectUploaded',
        required: true,
      },
      {
        displayName: 'Bucket Name',
        name: 'bucket',
        type: 'string',
        default: '',
        required: true,
        description: 'Name of the bucket to monitor',
        displayOptions: {
          show: {
            triggerType: ['newObjectUploaded', 'objectDeleted'],
          },
        },
      },
      {
        displayName: 'Prefix',
        name: 'prefix',
        type: 'string',
        default: '',
        description: 'Only trigger for objects with this prefix',
        displayOptions: {
          show: {
            triggerType: ['newObjectUploaded', 'objectDeleted'],
          },
        },
      },
      {
        displayName: 'Suffix',
        name: 'suffix',
        type: 'string',
        default: '',
        description: 'Only trigger for objects with this suffix (e.g., .jpg, .pdf)',
        displayOptions: {
          show: {
            triggerType: ['newObjectUploaded'],
          },
        },
      },
      {
        displayName: 'Include Object Content',
        name: 'includeContent',
        type: 'boolean',
        default: false,
        description: 'Whether to download and include the object content when triggered',
        displayOptions: {
          show: {
            triggerType: ['newObjectUploaded'],
          },
        },
      },
      {
        displayName: 'Threshold Type',
        name: 'thresholdType',
        type: 'options',
        options: [
          {
            name: 'Storage Used (%)',
            value: 'storagePercent',
          },
          {
            name: 'Storage Used (Bytes)',
            value: 'storageBytes',
          },
          {
            name: 'Object Count',
            value: 'objectCount',
          },
        ],
        default: 'storagePercent',
        displayOptions: {
          show: {
            triggerType: ['usageThresholdAlert'],
          },
        },
      },
      {
        displayName: 'Threshold Value',
        name: 'thresholdValue',
        type: 'number',
        default: 80,
        description: 'Threshold value to trigger alert',
        displayOptions: {
          show: {
            triggerType: ['usageThresholdAlert'],
          },
        },
      },
      {
        displayName: 'Storage Limit (GB)',
        name: 'storageLimit',
        type: 'number',
        default: 150,
        description: 'Your account storage limit in GB (used for percentage calculation)',
        displayOptions: {
          show: {
            triggerType: ['usageThresholdAlert'],
            thresholdType: ['storagePercent'],
          },
        },
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Max Results Per Poll',
            name: 'maxResults',
            type: 'number',
            default: 100,
            description: 'Maximum number of results to check per poll',
          },
        ],
      },
    ],
  };

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const triggerType = this.getNodeParameter('triggerType', 0) as string;
    const options = this.getNodeParameter('options', 0, {}) as IDataObject;
    const maxResults = (options.maxResults as number) || 100;

    // Get workflow static data for state management
    const workflowStaticData = this.getWorkflowStaticData('node');

    const client = await createStorjClient(this);

    let returnData: INodeExecutionData[] = [];

    try {
      switch (triggerType) {
        case 'newObjectUploaded':
          returnData = await pollNewObjects.call(this, client, workflowStaticData, maxResults);
          break;

        case 'objectDeleted':
          returnData = await pollDeletedObjects.call(this, client, workflowStaticData, maxResults);
          break;

        case 'bucketCreated':
          returnData = await pollNewBuckets.call(this, client, workflowStaticData);
          break;

        case 'usageThresholdAlert':
          returnData = await pollUsageThreshold.call(this, client, workflowStaticData);
          break;
      }
    } catch (error) {
      // On error, return empty but don't crash the trigger
      console.error('Storj Trigger error:', error);
      return null;
    }

    if (returnData.length === 0) {
      return null;
    }

    return [returnData];
  }
}

async function pollNewObjects(
  this: IPollFunctions,
  client: StorjS3Client,
  workflowStaticData: IDataObject,
  maxResults: number,
): Promise<INodeExecutionData[]> {
  const bucket = this.getNodeParameter('bucket', 0) as string;
  const prefix = (this.getNodeParameter('prefix', 0) as string) || '';
  const suffix = (this.getNodeParameter('suffix', 0) as string) || '';
  const includeContent = this.getNodeParameter('includeContent', 0) as boolean;

  // Get last known objects
  const stateKey = `objects_${bucket}_${prefix}`;
  const lastKnownObjects = (workflowStaticData[stateKey] as Record<string, string>) || {};
  const currentObjects: Record<string, string> = {};

  // List current objects
  const response = await client.listObjects(bucket, prefix, undefined, maxResults);

  const result = (response as IDataObject).ListBucketResult || response;
  const contents = (result as IDataObject).Contents || [];
  const objects = Array.isArray(contents) ? contents : [contents];

  const newObjects: INodeExecutionData[] = [];

  for (const obj of objects as IDataObject[]) {
    if (!obj.Key) continue;
    
    const key = obj.Key as string;
    const lastModified = obj.LastModified as string;
    const etag = obj.ETag as string;

    // Apply suffix filter
    if (suffix && !key.endsWith(suffix)) {
      continue;
    }

    // Track current objects
    currentObjects[key] = etag;

    // Check if this is a new object (not in last known state or different etag)
    if (!lastKnownObjects[key] || lastKnownObjects[key] !== etag) {
      const outputData: INodeExecutionData = {
        json: {
          event: 'objectCreated',
          bucket,
          key,
          size: parseInt(obj.Size as string, 10) || 0,
          sizeFormatted: formatBytes(parseInt(obj.Size as string, 10) || 0),
          lastModified,
          etag,
          storageClass: obj.StorageClass || 'STANDARD',
          triggeredAt: new Date().toISOString(),
        },
      };

      // Optionally include content
      if (includeContent) {
        try {
          const contentResponse = await client.getObject(bucket, key);
          if (contentResponse && (contentResponse as IDataObject).body) {
            const body = (contentResponse as IDataObject).body;
            if (Buffer.isBuffer(body)) {
              const binaryData = await this.helpers.prepareBinaryData(
                body,
                key.split('/').pop() || key,
                (contentResponse as IDataObject).contentType as string || 'application/octet-stream',
              );
              outputData.binary = { data: binaryData };
            }
          }
        } catch {
          // Couldn't download content, continue without it
          (outputData.json as IDataObject).contentError = 'Could not download object content';
        }
      }

      newObjects.push(outputData);
    }
  }

  // Update state
  workflowStaticData[stateKey] = currentObjects;

  return newObjects;
}

async function pollDeletedObjects(
  this: IPollFunctions,
  client: StorjS3Client,
  workflowStaticData: IDataObject,
  maxResults: number,
): Promise<INodeExecutionData[]> {
  const bucket = this.getNodeParameter('bucket', 0) as string;
  const prefix = (this.getNodeParameter('prefix', 0) as string) || '';

  // Get last known objects
  const stateKey = `objects_${bucket}_${prefix}`;
  const lastKnownObjects = (workflowStaticData[stateKey] as Record<string, string>) || {};
  const currentObjects: Record<string, string> = {};

  // List current objects
  const response = await client.listObjects(bucket, prefix, undefined, maxResults);

  const result = (response as IDataObject).ListBucketResult || response;
  const contents = (result as IDataObject).Contents || [];
  const objects = Array.isArray(contents) ? contents : [contents];

  // Build current state
  for (const obj of objects as IDataObject[]) {
    if (!obj.Key) continue;
    const key = obj.Key as string;
    const etag = obj.ETag as string;
    currentObjects[key] = etag;
  }

  const deletedObjects: INodeExecutionData[] = [];

  // Find deleted objects (in last known but not in current)
  for (const key of Object.keys(lastKnownObjects)) {
    if (!currentObjects[key]) {
      deletedObjects.push({
        json: {
          event: 'objectDeleted',
          bucket,
          key,
          previousEtag: lastKnownObjects[key],
          triggeredAt: new Date().toISOString(),
        },
      });
    }
  }

  // Update state
  workflowStaticData[stateKey] = currentObjects;

  return deletedObjects;
}

async function pollNewBuckets(
  this: IPollFunctions,
  client: StorjS3Client,
  workflowStaticData: IDataObject,
): Promise<INodeExecutionData[]> {
  // Get last known buckets
  const stateKey = 'known_buckets';
  const lastKnownBuckets = (workflowStaticData[stateKey] as string[]) || [];
  const currentBuckets: string[] = [];

  // List current buckets
  const response = await client.listBuckets();

  const result = (response as IDataObject).ListAllMyBucketsResult || response;
  const bucketsContainer = (result as IDataObject).Buckets as IDataObject || {};
  const bucketArray = bucketsContainer.Bucket || [];
  const buckets = Array.isArray(bucketArray) ? bucketArray : [bucketArray];

  const newBuckets: INodeExecutionData[] = [];

  for (const bucket of buckets as IDataObject[]) {
    if (!bucket.Name) continue;
    
    const name = bucket.Name as string;
    currentBuckets.push(name);

    // Check if this is a new bucket
    if (!lastKnownBuckets.includes(name)) {
      newBuckets.push({
        json: {
          event: 'bucketCreated',
          bucket: name,
          creationDate: bucket.CreationDate,
          triggeredAt: new Date().toISOString(),
        },
      });
    }
  }

  // Update state
  workflowStaticData[stateKey] = currentBuckets;

  return newBuckets;
}

async function pollUsageThreshold(
  this: IPollFunctions,
  client: StorjS3Client,
  workflowStaticData: IDataObject,
): Promise<INodeExecutionData[]> {
  const thresholdType = this.getNodeParameter('thresholdType', 0) as string;
  const thresholdValue = this.getNodeParameter('thresholdValue', 0) as number;
  let storageLimit = 150;
  try {
    storageLimit = this.getNodeParameter('storageLimit', 0) as number || 150;
  } catch {
    // Use default if not available
  }

  // Get last alert state
  const stateKey = 'usage_alert_sent';
  const lastAlertSent = workflowStaticData[stateKey] as boolean || false;

  // Calculate current usage by listing all buckets and objects
  const response = await client.listBuckets();

  const result = (response as IDataObject).ListAllMyBucketsResult || response;
  const bucketsContainer = (result as IDataObject).Buckets as IDataObject || {};
  const bucketArray = bucketsContainer.Bucket || [];
  const buckets = Array.isArray(bucketArray) ? bucketArray : [bucketArray];

  let totalSize = 0;
  let totalObjects = 0;

  for (const bucket of buckets as IDataObject[]) {
    if (!bucket.Name) continue;
    
    try {
      const objectsResponse = await client.listObjects(bucket.Name as string, undefined, undefined, 1000);
      const objResult = (objectsResponse as IDataObject).ListBucketResult || objectsResponse;
      const contents = (objResult as IDataObject).Contents || [];
      const objects = Array.isArray(contents) ? contents : [contents];
      
      for (const obj of objects as IDataObject[]) {
        if (obj.Size) {
          totalSize += parseInt(obj.Size as string, 10) || 0;
          totalObjects++;
        }
      }
    } catch {
      // Skip buckets we can't access
    }
  }

  const storageLimitBytes = storageLimit * 1024 * 1024 * 1024;
  const storagePercent = (totalSize / storageLimitBytes) * 100;

  let thresholdExceeded = false;
  let currentValue: number = 0;

  switch (thresholdType) {
    case 'storagePercent':
      currentValue = storagePercent;
      thresholdExceeded = storagePercent >= thresholdValue;
      break;
    case 'storageBytes':
      currentValue = totalSize;
      thresholdExceeded = totalSize >= thresholdValue;
      break;
    case 'objectCount':
      currentValue = totalObjects;
      thresholdExceeded = totalObjects >= thresholdValue;
      break;
  }

  // Only trigger if threshold exceeded and we haven't sent an alert recently
  if (thresholdExceeded && !lastAlertSent) {
    workflowStaticData[stateKey] = true;
    
    return [{
      json: {
        event: 'usageThresholdExceeded',
        thresholdType,
        thresholdValue,
        currentValue,
        totalStorageBytes: totalSize,
        totalStorageFormatted: formatBytes(totalSize),
        storagePercent: Math.round(storagePercent * 100) / 100,
        totalObjects,
        bucketCount: buckets.length,
        triggeredAt: new Date().toISOString(),
      },
    }];
  }

  // Reset alert state if we're back under threshold
  if (!thresholdExceeded) {
    workflowStaticData[stateKey] = false;
  }

  return [];
}
