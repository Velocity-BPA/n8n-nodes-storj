/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createStorjClient } from '../../transport/s3Client';

export async function setObjectMetadata(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const metadataInput = this.getNodeParameter('metadata', index) as IDataObject;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  // Parse metadata
  const metadata: Record<string, string> = {};
  if (metadataInput.metadataValues) {
    const values = metadataInput.metadataValues as IDataObject[];
    for (const item of values) {
      metadata[item.key as string] = item.value as string;
    }
  }

  if (Object.keys(metadata).length === 0) {
    throw new NodeOperationError(this.getNode(), 'At least one metadata key-value pair is required', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);

  // To set metadata, we need to copy the object to itself with new metadata
  await client.copyObject(bucketName, key, bucketName, key, metadata, 'REPLACE');

  return [
    {
      json: {
        success: true,
        bucket: bucketName,
        key,
        metadata,
        updatedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getObjectMetadata(
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

  if (!response.exists) {
    throw new NodeOperationError(this.getNode(), `Object not found: ${bucketName}/${key}`, {
      itemIndex: index,
    });
  }

  return [
    {
      json: {
        bucket: bucketName,
        key,
        contentType: response.contentType,
        contentLength: response.contentLength,
        etag: response.etag,
        lastModified: response.lastModified,
        metadata: response.metadata || {},
        queriedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function setObjectTags(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucketName = this.getNodeParameter('bucketName', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const tagsInput = this.getNodeParameter('tags', index) as IDataObject;

  if (!bucketName || !key) {
    throw new NodeOperationError(this.getNode(), 'Bucket name and key are required', {
      itemIndex: index,
    });
  }

  // Parse tags
  const tags: { Key: string; Value: string }[] = [];
  if (tagsInput.tagValues) {
    const values = tagsInput.tagValues as IDataObject[];
    for (const item of values) {
      tags.push({
        Key: item.key as string,
        Value: item.value as string,
      });
    }
  }

  if (tags.length === 0) {
    throw new NodeOperationError(this.getNode(), 'At least one tag key-value pair is required', {
      itemIndex: index,
    });
  }

  if (tags.length > 10) {
    throw new NodeOperationError(this.getNode(), 'Maximum of 10 tags allowed per object', {
      itemIndex: index,
    });
  }

  const client = await createStorjClient(this);
  await client.putObjectTagging(bucketName, key, tags);

  return [
    {
      json: {
        success: true,
        bucket: bucketName,
        key,
        tags: tags.reduce(
          (acc, t) => {
            acc[t.Key] = t.Value;
            return acc;
          },
          {} as Record<string, string>,
        ),
        tagCount: tags.length,
        updatedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getObjectTags(
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
  const response = await client.getObjectTagging(bucketName, key);

  const tagging = (response as IDataObject).Tagging || response;
  const taggingData = tagging as IDataObject;
  const tagSetContainer = taggingData.TagSet as IDataObject || {};
  const tagSet = tagSetContainer.Tag || [];
  const tags = Array.isArray(tagSet) ? tagSet : [tagSet];

  const tagObject = (tags as IDataObject[]).reduce(
    (acc: Record<string, string>, tag: IDataObject) => {
      if (tag.Key && tag.Value) {
        acc[tag.Key as string] = tag.Value as string;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  return [
    {
      json: {
        bucket: bucketName,
        key,
        tags: tagObject,
        tagCount: Object.keys(tagObject).length,
        queriedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export const metadataOperations = {
  setObjectMetadata,
  getObjectMetadata,
  setObjectTags,
  getObjectTags,
};
