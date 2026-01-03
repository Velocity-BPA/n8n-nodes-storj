/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject } from 'n8n-workflow';

// Bucket Types
export interface IStorjBucket {
  Name: string;
  CreationDate: string;
}

export interface IStorjBucketList {
  Buckets: IStorjBucket[];
  Owner: {
    DisplayName: string;
    ID: string;
  };
}

export interface IStorjBucketInfo {
  Name: string;
  CreationDate: string;
  Location?: string;
  ACL?: string;
}

// Object Types
export interface IStorjObject {
  Key: string;
  LastModified: string;
  ETag: string;
  Size: number;
  StorageClass: string;
  Owner?: {
    DisplayName: string;
    ID: string;
  };
}

export interface IStorjObjectList {
  Name: string;
  Prefix?: string;
  Marker?: string;
  MaxKeys: number;
  IsTruncated: boolean;
  Contents: IStorjObject[];
  CommonPrefixes?: { Prefix: string }[];
}

export interface IStorjObjectInfo {
  Key: string;
  ContentType: string;
  ContentLength: number;
  LastModified: string;
  ETag: string;
  Metadata: IDataObject;
  VersionId?: string;
}

// Multipart Upload Types
export interface IStorjMultipartUpload {
  UploadId: string;
  Key: string;
  Initiated: string;
}

export interface IStorjUploadPart {
  PartNumber: number;
  ETag: string;
  Size?: number;
  LastModified?: string;
}

export interface IStorjMultipartComplete {
  Location: string;
  Bucket: string;
  Key: string;
  ETag: string;
}

// Access Grant Types
export interface IStorjAccessGrant {
  accessGrant: string;
  satellite: string;
  apiKey: string;
  encryptionPassphrase: string;
  permissions: IStorjPermissions;
}

export interface IStorjPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  list: boolean;
  buckets?: string[];
  prefixes?: string[];
  notBefore?: string;
  notAfter?: string;
}

export interface IStorjAccessGrantParsed {
  satellite: string;
  apiKey: string;
  encryptionAccess: string;
  macaroon?: IDataObject;
}

// Sharing Types
export interface IStorjShareLink {
  url: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
  prefix?: string;
  expiresAt?: string;
}

export interface IStorjShareInfo {
  bucket: string;
  prefix?: string;
  permissions: IStorjPermissions;
  createdAt: string;
  expiresAt?: string;
}

// Project Types
export interface IStorjProjectInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  ownerId: string;
}

export interface IStorjUsage {
  storage: {
    used: number;
    limit: number;
  };
  bandwidth: {
    used: number;
    limit: number;
  };
  segments: {
    used: number;
    limit: number;
  };
}

export interface IStorjLimits {
  storage: number;
  bandwidth: number;
  segments: number;
  buckets: number;
}

export interface IStorjBilling {
  currentPeriod: {
    start: string;
    end: string;
  };
  storage: {
    used: number;
    cost: number;
  };
  bandwidth: {
    used: number;
    cost: number;
  };
  total: number;
  currency: string;
}

// Encryption Types
export interface IStorjEncryptionKey {
  key: string;
  salt: string;
  createdAt: string;
}

export interface IStorjEncryptedData {
  data: string;
  iv: string;
  tag: string;
  algorithm: string;
}

// Metadata Types
export interface IStorjMetadata {
  [key: string]: string;
}

export interface IStorjTags {
  TagSet: { Key: string; Value: string }[];
}

// Versioning Types
export interface IStorjObjectVersion {
  Key: string;
  VersionId: string;
  IsLatest: boolean;
  LastModified: string;
  ETag: string;
  Size: number;
  Owner?: {
    DisplayName: string;
    ID: string;
  };
}

export interface IStorjVersionList {
  Name: string;
  Prefix?: string;
  KeyMarker?: string;
  VersionIdMarker?: string;
  MaxKeys: number;
  IsTruncated: boolean;
  Versions: IStorjObjectVersion[];
  DeleteMarkers?: IStorjObjectVersion[];
}

// Utility Types
export interface IStorjPresignedUrl {
  url: string;
  expiresAt: string;
  method: string;
  bucket: string;
  key: string;
}

export interface IStorjS3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
}

export interface IStorjHealthStatus {
  satellite: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  timestamp: string;
}

// Trigger Types
export interface IStorjTriggerState {
  lastChecked: string;
  lastObjectKey?: string;
  lastModified?: string;
  processedKeys: string[];
}

// API Response Types
export interface IStorjApiResponse<T = IDataObject> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
  };
}

// Request Types
export interface IStorjListObjectsRequest {
  Bucket: string;
  Prefix?: string;
  Delimiter?: string;
  MaxKeys?: number;
  Marker?: string;
  ContinuationToken?: string;
}

export interface IStorjPutObjectRequest {
  Bucket: string;
  Key: string;
  Body: Buffer | string;
  ContentType?: string;
  Metadata?: IStorjMetadata;
  ACL?: string;
}

export interface IStorjGetObjectRequest {
  Bucket: string;
  Key: string;
  VersionId?: string;
  Range?: string;
}

export interface IStorjCopyObjectRequest {
  Bucket: string;
  Key: string;
  CopySource: string;
  MetadataDirective?: 'COPY' | 'REPLACE';
  Metadata?: IStorjMetadata;
}

export interface IStorjDeleteObjectRequest {
  Bucket: string;
  Key: string;
  VersionId?: string;
}

// Credential Types
export interface IStorjCredentials {
  authMethod: 's3' | 'accessGrant';
  satellite: string;
  customSatellite?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  accessGrant?: string;
  s3Endpoint: string;
}

// Node Options
export type StorjResource =
  | 'bucket'
  | 'object'
  | 'multipartUpload'
  | 'accessGrant'
  | 'sharing'
  | 'project'
  | 'encryption'
  | 'metadata'
  | 'versioning'
  | 'utility';

export type BucketOperation =
  | 'listBuckets'
  | 'createBucket'
  | 'deleteBucket'
  | 'getBucketInfo'
  | 'getBucketLocation'
  | 'setBucketACL';

export type ObjectOperation =
  | 'listObjects'
  | 'uploadObject'
  | 'downloadObject'
  | 'deleteObject'
  | 'copyObject'
  | 'getObjectInfo'
  | 'headObject';

export type MultipartUploadOperation =
  | 'initiateUpload'
  | 'uploadPart'
  | 'completeUpload'
  | 'abortUpload'
  | 'listParts';

export type AccessGrantOperation =
  | 'createAccessGrant'
  | 'revokeAccessGrant'
  | 'parseAccessGrant'
  | 'restrictAccessGrant';

export type SharingOperation =
  | 'createShareLink'
  | 'getShareInfo'
  | 'revokeShare'
  | 'setExpiration';

export type ProjectOperation =
  | 'getProjectInfo'
  | 'getUsage'
  | 'getLimits'
  | 'getBilling';

export type EncryptionOperation =
  | 'generateEncryptionKey'
  | 'encryptFile'
  | 'decryptFile';

export type MetadataOperation =
  | 'setObjectMetadata'
  | 'getObjectMetadata'
  | 'setObjectTags'
  | 'getObjectTags';

export type VersioningOperation =
  | 'listObjectVersions'
  | 'getObjectVersion'
  | 'deleteObjectVersion';

export type UtilityOperation =
  | 'generatePresignedURL'
  | 'convertAccessGrant'
  | 'getAPIHealth';
