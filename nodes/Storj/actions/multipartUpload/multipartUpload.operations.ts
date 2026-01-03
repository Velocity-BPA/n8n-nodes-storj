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

export async function initiateUpload(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const contentType = this.getNodeParameter('contentType', index, '') as string;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  const finalContentType = contentType || getMimeType(key);

  const client = await createStorjClient(this);
  const response = await client.initiateMultipartUpload(bucketName, key, finalContentType);

  const result = (response as IDataObject).InitiateMultipartUploadResult || response;
  const resultData = result as IDataObject;

  return [
    {
      json: {
        bucket: resultData.Bucket || bucketName,
        key: resultData.Key || key,
        uploadId: resultData.UploadId,
        contentType: finalContentType,
        initiatedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function uploadPart(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const uploadId = this.getNodeParameter('uploadId', index) as string;
  const partNumber = this.getNodeParameter('partNumber', index) as number;
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index, 'data') as string;

  if (!bucketName || !key || !uploadId || !partNumber) {
    throw new NodeOperationError(
      this.getNode(),
      'Bucket name, key, upload ID, and part number are required',
      { itemIndex: index },
    );
  }

  if (partNumber < 1 || partNumber > 10000) {
    throw new NodeOperationError(this.getNode(), 'Part number must be between 1 and 10000', {
      itemIndex: index,
    });
  }

  const body = await this.helpers.getBinaryDataBuffer(index, binaryPropertyName);

  const client = await createStorjClient(this);
  const response = await client.uploadPart(bucketName, key, uploadId, partNumber, body);

  return [
    {
      json: {
        bucket: bucketName,
        key,
        uploadId,
        partNumber,
        etag: response.ETag?.toString().replace(/"/g, '') || 'uploaded',
        size: body.length,
        uploadedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function completeUpload(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const uploadId = this.getNodeParameter('uploadId', index) as string;
  const partsJson = this.getNodeParameter('parts', index) as string;

  if (!bucketName || !key || !uploadId || !partsJson) {
    throw new NodeOperationError(
      this.getNode(),
      'Bucket name, key, upload ID, and parts are required',
      { itemIndex: index },
    );
  }

  let parts: { PartNumber: number; ETag: string }[];
  try {
    parts = JSON.parse(partsJson);
  } catch {
    throw new NodeOperationError(
      this.getNode(),
      'Parts must be a valid JSON array of {PartNumber, ETag} objects',
      { itemIndex: index },
    );
  }

  if (!Array.isArray(parts) || parts.length === 0) {
    throw new NodeOperationError(this.getNode(), 'Parts must be a non-empty array', {
      itemIndex: index,
    });
  }

  // Sort parts by part number
  parts.sort((a, b) => a.PartNumber - b.PartNumber);

  const client = await createStorjClient(this);
  const response = await client.completeMultipartUpload(bucketName, key, uploadId, parts);

  const result = (response as IDataObject).CompleteMultipartUploadResult || response;
  const resultData = result as IDataObject;
  const etag = resultData.ETag ? String(resultData.ETag).replace(/"/g, '') : undefined;

  return [
    {
      json: {
        success: true,
        location: resultData.Location,
        bucket: resultData.Bucket || bucketName,
        key: resultData.Key || key,
        etag,
        completedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function abortUpload(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const uploadId = this.getNodeParameter('uploadId', index) as string;

  if (!bucketName || !key || !uploadId) {
    throw new NodeOperationError(this.getNode(), 'Bucket name, key, and upload ID are required', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);
  await client.abortMultipartUpload(bucketName, key, uploadId);

  return [
    {
      json: {
        success: true,
        bucket: bucketName,
        key,
        uploadId,
        abortedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function listParts(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const uploadId = this.getNodeParameter('uploadId', index) as string;
  const maxParts = this.getNodeParameter('maxParts', index, 1000) as number;

  if (!bucketName || !key || !uploadId) {
    throw new NodeOperationError(this.getNode(), 'Bucket name, key, and upload ID are required', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);
  const response = await client.listParts(bucketName, key, uploadId, maxParts);

  const result = (response as IDataObject).ListPartsResult || response;
  const partsData = (result as IDataObject).Part || [];
  const parts = Array.isArray(partsData) ? partsData : [partsData];

  return (parts as IDataObject[])
    .filter((part: IDataObject) => part.PartNumber)
    .map((part: IDataObject) => ({
      json: {
        partNumber: parseInt(part.PartNumber as string, 10),
        etag: part.ETag ? String(part.ETag).replace(/"/g, '') : undefined,
        size: parseInt(part.Size as string, 10) || 0,
        lastModified: part.LastModified,
      },
      pairedItem: { item: index },
    }));
}

export const multipartUploadOperations = {
  initiateUpload,
  uploadPart,
  completeUpload,
  abortUpload,
  listParts,
};
