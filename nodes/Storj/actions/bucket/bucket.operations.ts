/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createStorjClient } from '../../transport/s3Client';

export async function listBuckets(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const client = await createStorjClient(this);
  const response = await client.listBuckets();

  const result = (response as IDataObject).ListAllMyBucketsResult || response;
  const bucketsContainer = (result as IDataObject).Buckets as IDataObject || {};
  const buckets = bucketsContainer.Bucket || [];
  const bucketList = Array.isArray(buckets) ? buckets : [buckets];

  return (bucketList as IDataObject[]).map((bucket: IDataObject) => ({
    json: {
      name: bucket.Name,
      creationDate: bucket.CreationDate,
    },
    pairedItem: { item: index },
  }));
}

export async function createBucket(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const acl = this.getNodeParameter('acl', index, 'private') as string;

  if (!bucketName) {
    throw new NodeOperationError(this.getNode(), 'Bucket name is required', { itemIndex: index });
  }

  // Validate bucket name
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucketName)) {
    throw new NodeOperationError(
      this.getNode(),
      'Bucket name must be 3-63 characters, start and end with alphanumeric, and contain only lowercase letters, numbers, hyphens, and periods',
      { itemIndex: index },
    );
  }

  const client = await createStorjClient(this);
  await client.createBucket(bucketName, acl);

  return [
    {
      json: {
        success: true,
        bucketName,
        acl,
        createdAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function deleteBucket(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;

  if (!bucketName) {
    throw new NodeOperationError(this.getNode(), 'Bucket name is required', { itemIndex: index });
  }

  const client = await createStorjClient(this);
  await client.deleteBucket(bucketName);

  return [
    {
      json: {
        success: true,
        bucketName,
        deletedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getBucketInfo(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;

  if (!bucketName) {
    throw new NodeOperationError(this.getNode(), 'Bucket name is required', { itemIndex: index });
  }

  const client = await createStorjClient(this);
  
  // Get bucket location
  const locationResponse = await client.getBucketLocation(bucketName);
  
  // List objects to get count
  const objectsResponse = await client.listObjects(bucketName, undefined, undefined, 1);
  const objResult = (objectsResponse as IDataObject).ListBucketResult || objectsResponse;
  const hasObjects = !!(objResult as IDataObject).Contents;

  return [
    {
      json: {
        name: bucketName,
        location: (locationResponse as IDataObject).LocationConstraint || 'us-east-1',
        hasObjects,
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getBucketLocation(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;

  if (!bucketName) {
    throw new NodeOperationError(this.getNode(), 'Bucket name is required', { itemIndex: index });
  }

  const client = await createStorjClient(this);
  const response = await client.getBucketLocation(bucketName);

  return [
    {
      json: {
        bucketName,
        location: response.LocationConstraint || 'us-east-1',
      },
      pairedItem: { item: index },
    },
  ];
}

export async function setBucketACL(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const acl = this.getNodeParameter('acl', index) as string;

  if (!bucketName) {
    throw new NodeOperationError(this.getNode(), 'Bucket name is required', { itemIndex: index });
  }

  const client = await createStorjClient(this);
  await client.setBucketACL(bucketName, acl);

  return [
    {
      json: {
        success: true,
        bucketName,
        acl,
        updatedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export const bucketOperations = {
  listBuckets,
  createBucket,
  deleteBucket,
  getBucketInfo,
  getBucketLocation,
  setBucketACL,
};
