/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createStorjClient } from '../../transport/s3Client';
import { getMimeType } from '../../utils/helpers';

export async function listObjects(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const prefix = this.getNodeParameter('prefix', index, '') as string;
  const delimiter = this.getNodeParameter('delimiter', index, '') as string;
  const maxKeys = this.getNodeParameter('maxKeys', index, 1000) as number;

  if (!bucketName) {
    throw new NodeOperationError(this.getNode(), 'Bucket name is required', { itemIndex: index });
  }

  const client = await createStorjClient(this);
  const response = await client.listObjects(bucketName, prefix, delimiter, maxKeys);

  const result = (response as IDataObject).ListBucketResult || response;
  const contents = (result as IDataObject).Contents || [];
  const objects = Array.isArray(contents) ? contents : [contents];

  return (objects as IDataObject[])
    .filter((obj: IDataObject) => obj.Key)
    .map((obj: IDataObject) => ({
      json: {
        key: obj.Key,
        lastModified: obj.LastModified,
        etag: obj.ETag?.toString().replace(/"/g, ''),
        size: parseInt(obj.Size as string, 10) || 0,
        storageClass: obj.StorageClass || 'STANDARD',
      },
      pairedItem: { item: index },
    }));
}

export async function uploadObject(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const inputType = this.getNodeParameter('inputType', index, 'binary') as string;
  const acl = this.getNodeParameter('acl', index, 'private') as string;
  const contentType = this.getNodeParameter('contentType', index, '') as string;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  let body: Buffer | string;
  let finalContentType: string;

  if (inputType === 'binary') {
    const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index, 'data') as string;
    const binaryData = this.helpers.assertBinaryData(index, binaryPropertyName);
    body = await this.helpers.getBinaryDataBuffer(index, binaryPropertyName);
    finalContentType = contentType || binaryData.mimeType || getMimeType(key);
  } else {
    const content = this.getNodeParameter('content', index, '') as string;
    body = content;
    finalContentType = contentType || 'text/plain';
  }

  // Get custom metadata if provided
  const metadata: Record<string, string> = {};
  const additionalFields = this.getNodeParameter('additionalFields', index, {}) as IDataObject;
  if (additionalFields.metadata) {
    const metadataItems = (additionalFields.metadata as IDataObject).metadataValues as IDataObject[];
    if (metadataItems) {
      for (const item of metadataItems) {
        metadata[item.key as string] = item.value as string;
      }
    }
  }

  const client = await createStorjClient(this);
  const response = await client.putObject(
    bucketName,
    key,
    body,
    finalContentType,
    Object.keys(metadata).length > 0 ? metadata : undefined,
    acl,
  );

  return [
    {
      json: {
        success: true,
        bucket: bucketName,
        key,
        etag: response.ETag?.toString().replace(/"/g, '') || 'uploaded',
        contentType: finalContentType,
        size: Buffer.byteLength(body),
        uploadedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function downloadObject(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index, 'data') as string;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);
  const response = await client.getObject(bucketName, key);

  // Handle the response data
  let data: Buffer;
  if (response.data) {
    if (Buffer.isBuffer(response.data)) {
      data = response.data;
    } else if (typeof response.data === 'string') {
      data = Buffer.from(response.data, 'utf-8');
    } else {
      data = Buffer.from(JSON.stringify(response.data));
    }
  } else if (Buffer.isBuffer(response)) {
    data = response;
  } else {
    data = Buffer.from(JSON.stringify(response));
  }

  const fileName = key.split('/').pop() || key;
  const mimeType = getMimeType(fileName);

  const binaryData = await this.helpers.prepareBinaryData(data, fileName, mimeType);

  return [
    {
      json: {
        bucket: bucketName,
        key,
        fileName,
        size: data.length,
        mimeType,
        downloadedAt: new Date().toISOString(),
      },
      binary: {
        [binaryPropertyName]: binaryData,
      },
      pairedItem: { item: index },
    },
  ];
}

export async function deleteObject(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const versionId = this.getNodeParameter('versionId', index, '') as string;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);
  await client.deleteObject(bucketName, key, versionId || undefined);

  return [
    {
      json: {
        success: true,
        bucket: bucketName,
        key,
        versionId: versionId || undefined,
        deletedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function copyObject(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const sourceBucket = this.getNodeParameter('sourceBucket', index) as string;
  const sourceKey = this.getNodeParameter('sourceKey', index) as string;
  const destBucket = this.getNodeParameter('destBucket', index) as string;
  const destKey = this.getNodeParameter('destKey', index) as string;

  if (!sourceBucket || !sourceKey || !destBucket || !destKey) {
    throw new NodeOperationError(
      this.getNode(),
      'Source bucket, source key, destination bucket, and destination key are required',
      { itemIndex: index },
    );
  }

  const client = await createStorjClient(this);
  const response = await client.copyObject(sourceBucket, sourceKey, destBucket, destKey);
  const copyResult = (response as IDataObject).CopyObjectResult as IDataObject || {};
  const etag = copyResult.ETag ? String(copyResult.ETag).replace(/"/g, '') : undefined;

  return [
    {
      json: {
        success: true,
        source: {
          bucket: sourceBucket,
          key: sourceKey,
        },
        destination: {
          bucket: destBucket,
          key: destKey,
        },
        etag,
        copiedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getObjectInfo(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);
  const response = await client.headObject(bucketName, key);

  return [
    {
      json: {
        bucket: bucketName,
        key,
        exists: response.exists,
        contentLength: response.contentLength,
        contentType: response.contentType,
        etag: response.etag?.toString().replace(/"/g, ''),
        lastModified: response.lastModified,
        versionId: response.versionId,
        metadata: response.metadata || {},
      },
      pairedItem: { item: index },
    },
  ];
}

export async function headObject(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);
  const response = await client.headObject(bucketName, key);

  return [
    {
      json: {
        bucket: bucketName,
        key,
        exists: response.exists || false,
      },
      pairedItem: { item: index },
    },
  ];
}

export const objectOperations = {
  listObjects,
  uploadObject,
  downloadObject,
  deleteObject,
  copyObject,
  getObjectInfo,
  headObject,
};
