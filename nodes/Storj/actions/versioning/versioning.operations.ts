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

export async function listObjectVersions(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const prefix = this.getNodeParameter('prefix', index, '') as string;
  const maxKeys = this.getNodeParameter('maxKeys', index, 1000) as number;

  if (!bucketName) {
    throw new NodeOperationError(this.getNode(), 'Bucket name is required', { itemIndex: index });
  }

  const client = await createStorjClient(this);
  const response = await client.listObjectVersions(
    bucketName,
    prefix || undefined,
    undefined,
    undefined,
    maxKeys,
  );

  const result = (response as IDataObject).ListVersionsResult || response;
  const resultData = result as IDataObject;
  const versions = resultData.Version || [];
  const versionList = Array.isArray(versions) ? versions : [versions];

  const deleteMarkers = resultData.DeleteMarker || [];
  const deleteMarkerList = Array.isArray(deleteMarkers) ? deleteMarkers : [deleteMarkers];

  const items: INodeExecutionData[] = [];

  // Add versions
  for (const version of versionList as IDataObject[]) {
    if (!version.Key) continue;
    items.push({
      json: {
        type: 'version',
        key: version.Key,
        versionId: version.VersionId,
        isLatest: version.IsLatest === 'true',
        lastModified: version.LastModified,
        etag: version.ETag?.toString().replace(/"/g, ''),
        size: parseInt(version.Size as string, 10) || 0,
        storageClass: version.StorageClass || 'STANDARD',
      },
      pairedItem: { item: index },
    });
  }

  // Add delete markers
  for (const marker of deleteMarkerList as IDataObject[]) {
    if (!marker.Key) continue;
    items.push({
      json: {
        type: 'deleteMarker',
        key: marker.Key,
        versionId: marker.VersionId,
        isLatest: marker.IsLatest === 'true',
        lastModified: marker.LastModified,
      },
      pairedItem: { item: index },
    });
  }

  if (items.length === 0) {
    return [
      {
        json: {
          bucket: bucketName,
          prefix: prefix || '/',
          message: 'No versions found. Versioning may not be enabled on this bucket.',
          queriedAt: new Date().toISOString(),
        },
        pairedItem: { item: index },
      },
    ];
  }

  return items;
}

export async function getObjectVersion(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const versionId = this.getNodeParameter('versionId', index) as string;
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index, 'data') as string;

  if (!bucketName || !key || !versionId) {
    throw new NodeOperationError(this.getNode(), 'Bucket name, key, and version ID are required', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);
  const response = await client.getObject(bucketName, key, versionId);

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
        versionId,
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

export async function deleteObjectVersion(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const versionId = this.getNodeParameter('versionId', index) as string;

  if (!bucketName || !key || !versionId) {
    throw new NodeOperationError(this.getNode(), 'Bucket name, key, and version ID are required', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);
  await client.deleteObject(bucketName, key, versionId);

  return [
    {
      json: {
        success: true,
        bucket: bucketName,
        key,
        versionId,
        deletedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export const versioningOperations = {
  listObjectVersions,
  getObjectVersion,
  deleteObjectVersion,
};
