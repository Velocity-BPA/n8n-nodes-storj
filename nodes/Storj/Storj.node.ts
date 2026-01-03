/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { logLicensingNotice } from './constants/constants';

// Import operations
import { bucketOperations } from './actions/bucket/bucket.operations';
import { objectOperations } from './actions/object/object.operations';
import { multipartUploadOperations } from './actions/multipartUpload/multipartUpload.operations';
import { accessGrantOperations } from './actions/accessGrant/accessGrant.operations';
import { sharingOperations } from './actions/sharing/sharing.operations';
import { projectOperations } from './actions/project/project.operations';
import { encryptionOperations } from './actions/encryption/encryption.operations';
import { metadataOperations } from './actions/metadata/metadata.operations';
import { versioningOperations } from './actions/versioning/versioning.operations';
import { utilityOperations } from './actions/utility/utility.operations';

// Log licensing notice once on module load
logLicensingNotice();

export class Storj implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Storj',
    name: 'storj',
    icon: 'file:storj.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with Storj decentralized cloud storage',
    defaults: {
      name: 'Storj',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'storjApi',
        required: true,
      },
    ],
    properties: [
      // Resource selector
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Access Grant', value: 'accessGrant' },
          { name: 'Bucket', value: 'bucket' },
          { name: 'Encryption', value: 'encryption' },
          { name: 'Metadata', value: 'metadata' },
          { name: 'Multipart Upload', value: 'multipartUpload' },
          { name: 'Object', value: 'object' },
          { name: 'Project', value: 'project' },
          { name: 'Sharing', value: 'sharing' },
          { name: 'Utility', value: 'utility' },
          { name: 'Versioning', value: 'versioning' },
        ],
        default: 'bucket',
      },

      // ============== BUCKET OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['bucket'],
          },
        },
        options: [
          { name: 'Create Bucket', value: 'createBucket', action: 'Create a bucket' },
          { name: 'Delete Bucket', value: 'deleteBucket', action: 'Delete a bucket' },
          { name: 'Get Bucket Info', value: 'getBucketInfo', action: 'Get bucket info' },
          { name: 'Get Bucket Location', value: 'getBucketLocation', action: 'Get bucket location' },
          { name: 'List Buckets', value: 'listBuckets', action: 'List all buckets' },
          { name: 'Set Bucket ACL', value: 'setBucketACL', action: 'Set bucket ACL' },
        ],
        default: 'listBuckets',
      },

      // ============== OBJECT OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['object'],
          },
        },
        options: [
          { name: 'Copy Object', value: 'copyObject', action: 'Copy an object' },
          { name: 'Delete Object', value: 'deleteObject', action: 'Delete an object' },
          { name: 'Download Object', value: 'downloadObject', action: 'Download an object' },
          { name: 'Get Object Info', value: 'getObjectInfo', action: 'Get object info' },
          { name: 'Head Object', value: 'headObject', action: 'Check if object exists' },
          { name: 'List Objects', value: 'listObjects', action: 'List objects in bucket' },
          { name: 'Upload Object', value: 'uploadObject', action: 'Upload an object' },
        ],
        default: 'listObjects',
      },

      // ============== MULTIPART UPLOAD OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['multipartUpload'],
          },
        },
        options: [
          { name: 'Abort Upload', value: 'abortUpload', action: 'Abort multipart upload' },
          { name: 'Complete Upload', value: 'completeUpload', action: 'Complete multipart upload' },
          { name: 'Initiate Upload', value: 'initiateUpload', action: 'Initiate multipart upload' },
          { name: 'List Parts', value: 'listParts', action: 'List uploaded parts' },
          { name: 'Upload Part', value: 'uploadPart', action: 'Upload a part' },
        ],
        default: 'initiateUpload',
      },

      // ============== ACCESS GRANT OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['accessGrant'],
          },
        },
        options: [
          { name: 'Create Access Grant', value: 'createAccessGrant', action: 'Create access grant' },
          { name: 'Parse Access Grant', value: 'parseAccessGrant', action: 'Parse access grant' },
          { name: 'Restrict Access Grant', value: 'restrictAccessGrant', action: 'Restrict access grant' },
          { name: 'Revoke Access Grant', value: 'revokeAccessGrant', action: 'Revoke access grant' },
        ],
        default: 'parseAccessGrant',
      },

      // ============== SHARING OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['sharing'],
          },
        },
        options: [
          { name: 'Create Share Link', value: 'createShareLink', action: 'Create share link' },
          { name: 'Get Share Info', value: 'getShareInfo', action: 'Get share info' },
          { name: 'Revoke Share', value: 'revokeShare', action: 'Revoke share link' },
          { name: 'Set Expiration', value: 'setExpiration', action: 'Set share expiration' },
        ],
        default: 'createShareLink',
      },

      // ============== PROJECT OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['project'],
          },
        },
        options: [
          { name: 'Get Billing', value: 'getBilling', action: 'Get billing info' },
          { name: 'Get Limits', value: 'getLimits', action: 'Get account limits' },
          { name: 'Get Project Info', value: 'getProjectInfo', action: 'Get project info' },
          { name: 'Get Usage', value: 'getUsage', action: 'Get usage stats' },
        ],
        default: 'getProjectInfo',
      },

      // ============== ENCRYPTION OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['encryption'],
          },
        },
        options: [
          { name: 'Decrypt File', value: 'decryptFile', action: 'Decrypt file' },
          { name: 'Encrypt File', value: 'encryptFile', action: 'Encrypt file' },
          { name: 'Generate Encryption Key', value: 'generateEncryptionKey', action: 'Generate encryption key' },
        ],
        default: 'generateEncryptionKey',
      },

      // ============== METADATA OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['metadata'],
          },
        },
        options: [
          { name: 'Get Object Metadata', value: 'getObjectMetadata', action: 'Get object metadata' },
          { name: 'Get Object Tags', value: 'getObjectTags', action: 'Get object tags' },
          { name: 'Set Object Metadata', value: 'setObjectMetadata', action: 'Set object metadata' },
          { name: 'Set Object Tags', value: 'setObjectTags', action: 'Set object tags' },
        ],
        default: 'getObjectMetadata',
      },

      // ============== VERSIONING OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['versioning'],
          },
        },
        options: [
          { name: 'Delete Object Version', value: 'deleteObjectVersion', action: 'Delete object version' },
          { name: 'Get Object Version', value: 'getObjectVersion', action: 'Get object version' },
          { name: 'List Object Versions', value: 'listObjectVersions', action: 'List object versions' },
        ],
        default: 'listObjectVersions',
      },

      // ============== UTILITY OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['utility'],
          },
        },
        options: [
          { name: 'Convert Access Grant', value: 'convertAccessGrant', action: 'Convert access grant to S3 credentials' },
          { name: 'Generate Presigned URL', value: 'generatePresignedURL', action: 'Generate presigned URL' },
          { name: 'Get API Health', value: 'getAPIHealth', action: 'Check API health' },
        ],
        default: 'getAPIHealth',
      },

      // ============== COMMON PARAMETERS ==============

      // Bucket name (used by many operations)
      {
        displayName: 'Bucket Name',
        name: 'bucket',
        type: 'string',
        default: '',
        required: true,
        description: 'Name of the bucket',
        displayOptions: {
          show: {
            resource: ['bucket', 'object', 'multipartUpload', 'sharing', 'metadata', 'versioning', 'utility'],
            operation: [
              'createBucket', 'deleteBucket', 'getBucketInfo', 'getBucketLocation', 'setBucketACL',
              'listObjects', 'uploadObject', 'downloadObject', 'deleteObject', 'copyObject', 'getObjectInfo', 'headObject',
              'initiateUpload', 'uploadPart', 'completeUpload', 'abortUpload', 'listParts',
              'createShareLink', 'getShareInfo', 'revokeShare', 'setExpiration',
              'setObjectMetadata', 'getObjectMetadata', 'setObjectTags', 'getObjectTags',
              'listObjectVersions', 'getObjectVersion', 'deleteObjectVersion',
              'generatePresignedURL',
            ],
          },
        },
      },

      // Object key (used by object operations)
      {
        displayName: 'Object Key',
        name: 'key',
        type: 'string',
        default: '',
        required: true,
        description: 'Key (path) of the object',
        displayOptions: {
          show: {
            resource: ['object', 'multipartUpload', 'sharing', 'metadata', 'versioning', 'utility'],
            operation: [
              'uploadObject', 'downloadObject', 'deleteObject', 'copyObject', 'getObjectInfo', 'headObject',
              'initiateUpload', 'uploadPart', 'completeUpload', 'abortUpload', 'listParts',
              'createShareLink', 'getShareInfo', 'revokeShare', 'setExpiration',
              'setObjectMetadata', 'getObjectMetadata', 'setObjectTags', 'getObjectTags',
              'listObjectVersions', 'getObjectVersion', 'deleteObjectVersion',
              'generatePresignedURL',
            ],
          },
        },
      },

      // Upload ID (multipart)
      {
        displayName: 'Upload ID',
        name: 'uploadId',
        type: 'string',
        default: '',
        required: true,
        description: 'The upload ID from initiateUpload',
        displayOptions: {
          show: {
            resource: ['multipartUpload'],
            operation: ['uploadPart', 'completeUpload', 'abortUpload', 'listParts'],
          },
        },
      },

      // Part number (multipart)
      {
        displayName: 'Part Number',
        name: 'partNumber',
        type: 'number',
        default: 1,
        required: true,
        description: 'Part number (1-10000)',
        displayOptions: {
          show: {
            resource: ['multipartUpload'],
            operation: ['uploadPart'],
          },
        },
      },

      // Binary data input property
      {
        displayName: 'Binary Property',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        description: 'Name of the binary property containing the data',
        displayOptions: {
          show: {
            operation: ['uploadObject', 'uploadPart', 'encryptFile', 'decryptFile'],
          },
        },
      },

      // Binary data output property
      {
        displayName: 'Output Binary Property',
        name: 'outputBinaryPropertyName',
        type: 'string',
        default: 'data',
        description: 'Name of the binary property to store the output',
        displayOptions: {
          show: {
            operation: ['downloadObject', 'getObjectVersion', 'encryptFile', 'decryptFile'],
          },
        },
      },

      // Copy source
      {
        displayName: 'Source Bucket',
        name: 'sourceBucket',
        type: 'string',
        default: '',
        required: true,
        description: 'Source bucket name',
        displayOptions: {
          show: {
            operation: ['copyObject'],
          },
        },
      },
      {
        displayName: 'Source Key',
        name: 'sourceKey',
        type: 'string',
        default: '',
        required: true,
        description: 'Source object key',
        displayOptions: {
          show: {
            operation: ['copyObject'],
          },
        },
      },

      // Access grant parameters
      {
        displayName: 'Access Grant',
        name: 'accessGrantInput',
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '',
        required: true,
        description: 'The access grant to parse or modify',
        displayOptions: {
          show: {
            resource: ['accessGrant'],
            operation: ['parseAccessGrant', 'restrictAccessGrant', 'revokeAccessGrant'],
          },
        },
      },

      {
        displayName: 'Access Grant to Convert',
        name: 'accessGrantToConvert',
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '',
        required: true,
        description: 'The access grant to convert to S3 credentials',
        displayOptions: {
          show: {
            resource: ['utility'],
            operation: ['convertAccessGrant'],
          },
        },
      },

      // Sharing link ID
      {
        displayName: 'Share Link ID',
        name: 'shareLinkId',
        type: 'string',
        default: '',
        required: true,
        description: 'The share link ID',
        displayOptions: {
          show: {
            resource: ['sharing'],
            operation: ['getShareInfo', 'revokeShare', 'setExpiration'],
          },
        },
      },

      // Encryption key
      {
        displayName: 'Encryption Key',
        name: 'encryptionKey',
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '',
        required: true,
        description: 'The encryption key (hex encoded)',
        displayOptions: {
          show: {
            resource: ['encryption'],
            operation: ['encryptFile', 'decryptFile'],
          },
        },
      },

      // Version ID
      {
        displayName: 'Version ID',
        name: 'versionId',
        type: 'string',
        default: '',
        required: true,
        description: 'The version ID of the object',
        displayOptions: {
          show: {
            resource: ['versioning'],
            operation: ['getObjectVersion', 'deleteObjectVersion'],
          },
        },
      },

      // Presigned URL operation
      {
        displayName: 'Presigned Operation',
        name: 'presignedOperation',
        type: 'options',
        options: [
          { name: 'Download (GET)', value: 'getObject' },
          { name: 'Upload (PUT)', value: 'putObject' },
        ],
        default: 'getObject',
        description: 'The operation for the presigned URL',
        displayOptions: {
          show: {
            resource: ['utility'],
            operation: ['generatePresignedURL'],
          },
        },
      },

      // Expires in (presigned URL)
      {
        displayName: 'Expires In (Seconds)',
        name: 'expiresIn',
        type: 'number',
        default: 3600,
        description: 'How long the presigned URL is valid (in seconds)',
        displayOptions: {
          show: {
            resource: ['utility'],
            operation: ['generatePresignedURL'],
          },
        },
      },

      // ============== ADDITIONAL OPTIONS ==============

      // List objects options
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['object'],
            operation: ['listObjects'],
          },
        },
        options: [
          {
            displayName: 'Prefix',
            name: 'prefix',
            type: 'string',
            default: '',
            description: 'Filter objects by prefix',
          },
          {
            displayName: 'Delimiter',
            name: 'delimiter',
            type: 'string',
            default: '',
            description: 'Delimiter for grouping objects',
          },
          {
            displayName: 'Max Keys',
            name: 'maxKeys',
            type: 'number',
            default: 1000,
            description: 'Maximum number of keys to return',
          },
          {
            displayName: 'Start After',
            name: 'startAfter',
            type: 'string',
            default: '',
            description: 'Start listing after this key',
          },
        ],
      },

      // Upload object options
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['object'],
            operation: ['uploadObject'],
          },
        },
        options: [
          {
            displayName: 'Content Type',
            name: 'contentType',
            type: 'string',
            default: '',
            description: 'MIME type of the content',
          },
          {
            displayName: 'Content Disposition',
            name: 'contentDisposition',
            type: 'string',
            default: '',
            description: 'Content disposition header',
          },
          {
            displayName: 'Cache Control',
            name: 'cacheControl',
            type: 'string',
            default: '',
            description: 'Cache control header',
          },
          {
            displayName: 'Content Encoding',
            name: 'contentEncoding',
            type: 'string',
            default: '',
            description: 'Content encoding header',
          },
        ],
      },

      // Create bucket options
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['bucket'],
            operation: ['createBucket'],
          },
        },
        options: [
          {
            displayName: 'Location Constraint',
            name: 'locationConstraint',
            type: 'string',
            default: '',
            description: 'Region constraint for the bucket',
          },
        ],
      },

      // ACL options
      {
        displayName: 'ACL',
        name: 'acl',
        type: 'options',
        options: [
          { name: 'Private', value: 'private' },
          { name: 'Public Read', value: 'public-read' },
          { name: 'Public Read Write', value: 'public-read-write' },
          { name: 'Authenticated Read', value: 'authenticated-read' },
        ],
        default: 'private',
        description: 'Access control list setting',
        displayOptions: {
          show: {
            operation: ['setBucketACL'],
          },
        },
      },

      // Access grant restriction options
      {
        displayName: 'Restrictions',
        name: 'restrictions',
        type: 'collection',
        placeholder: 'Add Restriction',
        default: {},
        displayOptions: {
          show: {
            resource: ['accessGrant'],
            operation: ['restrictAccessGrant', 'createAccessGrant'],
          },
        },
        options: [
          {
            displayName: 'Allowed Buckets',
            name: 'buckets',
            type: 'string',
            default: '',
            description: 'Comma-separated list of allowed bucket names',
          },
          {
            displayName: 'Path Prefix',
            name: 'pathPrefix',
            type: 'string',
            default: '',
            description: 'Restrict access to objects with this prefix',
          },
          {
            displayName: 'Expires At',
            name: 'expiresAt',
            type: 'dateTime',
            default: '',
            description: 'When the grant expires',
          },
          {
            displayName: 'Allow Read',
            name: 'allowRead',
            type: 'boolean',
            default: true,
            description: 'Allow read operations',
          },
          {
            displayName: 'Allow Write',
            name: 'allowWrite',
            type: 'boolean',
            default: false,
            description: 'Allow write operations',
          },
          {
            displayName: 'Allow Delete',
            name: 'allowDelete',
            type: 'boolean',
            default: false,
            description: 'Allow delete operations',
          },
          {
            displayName: 'Allow List',
            name: 'allowList',
            type: 'boolean',
            default: true,
            description: 'Allow list operations',
          },
        ],
      },

      // Share expiration
      {
        displayName: 'Expires At',
        name: 'expiresAt',
        type: 'dateTime',
        default: '',
        description: 'When the share link expires',
        displayOptions: {
          show: {
            resource: ['sharing'],
            operation: ['createShareLink', 'setExpiration'],
          },
        },
      },

      // Metadata (key-value pairs)
      {
        displayName: 'Metadata',
        name: 'metadata',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        displayOptions: {
          show: {
            operation: ['setObjectMetadata'],
          },
        },
        options: [
          {
            displayName: 'Metadata Items',
            name: 'metadataItems',
            values: [
              {
                displayName: 'Key',
                name: 'key',
                type: 'string',
                default: '',
                description: 'Metadata key',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                description: 'Metadata value',
              },
            ],
          },
        ],
      },

      // Tags (key-value pairs)
      {
        displayName: 'Tags',
        name: 'tags',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        displayOptions: {
          show: {
            operation: ['setObjectTags'],
          },
        },
        options: [
          {
            displayName: 'Tag Items',
            name: 'tagItems',
            values: [
              {
                displayName: 'Key',
                name: 'key',
                type: 'string',
                default: '',
                description: 'Tag key',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                description: 'Tag value',
              },
            ],
          },
        ],
      },

      // Multipart parts (for completeUpload)
      {
        displayName: 'Parts',
        name: 'parts',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        displayOptions: {
          show: {
            operation: ['completeUpload'],
          },
        },
        options: [
          {
            displayName: 'Part Items',
            name: 'partItems',
            values: [
              {
                displayName: 'Part Number',
                name: 'partNumber',
                type: 'number',
                default: 1,
                description: 'Part number',
              },
              {
                displayName: 'ETag',
                name: 'etag',
                type: 'string',
                default: '',
                description: 'ETag of the part',
              },
            ],
          },
        ],
      },

      // Presigned URL additional options
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['utility'],
            operation: ['generatePresignedURL'],
          },
        },
        options: [
          {
            displayName: 'Content Type',
            name: 'contentType',
            type: 'string',
            default: '',
            description: 'Content type (for PUT operations)',
          },
          {
            displayName: 'Content Disposition',
            name: 'contentDisposition',
            type: 'string',
            default: '',
            description: 'Content disposition header',
          },
          {
            displayName: 'Response Content Type',
            name: 'responseContentType',
            type: 'string',
            default: '',
            description: 'Override content type in response',
          },
          {
            displayName: 'Response Content Disposition',
            name: 'responseContentDisposition',
            type: 'string',
            default: '',
            description: 'Override content disposition in response',
          },
        ],
      },

      // Encryption key length
      {
        displayName: 'Key Length',
        name: 'keyLength',
        type: 'options',
        options: [
          { name: '128 bits', value: 128 },
          { name: '192 bits', value: 192 },
          { name: '256 bits', value: 256 },
        ],
        default: 256,
        description: 'Length of the encryption key',
        displayOptions: {
          show: {
            resource: ['encryption'],
            operation: ['generateEncryptionKey'],
          },
        },
      },

      // Return passphrase option
      {
        displayName: 'Return as Passphrase',
        name: 'returnAsPassphrase',
        type: 'boolean',
        default: false,
        description: 'Whether to also return a human-readable passphrase',
        displayOptions: {
          show: {
            resource: ['encryption'],
            operation: ['generateEncryptionKey'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        let result: INodeExecutionData[] = [];

        // Route to appropriate operation
        switch (resource) {
          case 'bucket':
            switch (operation) {
              case 'listBuckets':
                result = await bucketOperations.listBuckets.call(this, i);
                break;
              case 'createBucket':
                result = await bucketOperations.createBucket.call(this, i);
                break;
              case 'deleteBucket':
                result = await bucketOperations.deleteBucket.call(this, i);
                break;
              case 'getBucketInfo':
                result = await bucketOperations.getBucketInfo.call(this, i);
                break;
              case 'getBucketLocation':
                result = await bucketOperations.getBucketLocation.call(this, i);
                break;
              case 'setBucketACL':
                result = await bucketOperations.setBucketACL.call(this, i);
                break;
            }
            break;

          case 'object':
            switch (operation) {
              case 'listObjects':
                result = await objectOperations.listObjects.call(this, i);
                break;
              case 'uploadObject':
                result = await objectOperations.uploadObject.call(this, i);
                break;
              case 'downloadObject':
                result = await objectOperations.downloadObject.call(this, i);
                break;
              case 'deleteObject':
                result = await objectOperations.deleteObject.call(this, i);
                break;
              case 'copyObject':
                result = await objectOperations.copyObject.call(this, i);
                break;
              case 'getObjectInfo':
                result = await objectOperations.getObjectInfo.call(this, i);
                break;
              case 'headObject':
                result = await objectOperations.headObject.call(this, i);
                break;
            }
            break;

          case 'multipartUpload':
            switch (operation) {
              case 'initiateUpload':
                result = await multipartUploadOperations.initiateUpload.call(this, i);
                break;
              case 'uploadPart':
                result = await multipartUploadOperations.uploadPart.call(this, i);
                break;
              case 'completeUpload':
                result = await multipartUploadOperations.completeUpload.call(this, i);
                break;
              case 'abortUpload':
                result = await multipartUploadOperations.abortUpload.call(this, i);
                break;
              case 'listParts':
                result = await multipartUploadOperations.listParts.call(this, i);
                break;
            }
            break;

          case 'accessGrant':
            switch (operation) {
              case 'createAccessGrant':
                result = await accessGrantOperations.createAccessGrant.call(this, i);
                break;
              case 'revokeAccessGrant':
                result = await accessGrantOperations.revokeAccessGrant.call(this, i);
                break;
              case 'parseAccessGrant':
                result = await accessGrantOperations.parseAccessGrant.call(this, i);
                break;
              case 'restrictAccessGrant':
                result = await accessGrantOperations.restrictAccessGrant.call(this, i);
                break;
            }
            break;

          case 'sharing':
            switch (operation) {
              case 'createShareLink':
                result = await sharingOperations.createShareLink.call(this, i);
                break;
              case 'getShareInfo':
                result = await sharingOperations.getShareInfo.call(this, i);
                break;
              case 'revokeShare':
                result = await sharingOperations.revokeShare.call(this, i);
                break;
              case 'setExpiration':
                result = await sharingOperations.setExpiration.call(this, i);
                break;
            }
            break;

          case 'project':
            switch (operation) {
              case 'getProjectInfo':
                result = await projectOperations.getProjectInfo.call(this, i);
                break;
              case 'getUsage':
                result = await projectOperations.getUsage.call(this, i);
                break;
              case 'getLimits':
                result = await projectOperations.getLimits.call(this, i);
                break;
              case 'getBilling':
                result = await projectOperations.getBilling.call(this, i);
                break;
            }
            break;

          case 'encryption':
            switch (operation) {
              case 'generateEncryptionKey':
                result = await encryptionOperations.generateEncryptionKey.call(this, i);
                break;
              case 'encryptFile':
                result = await encryptionOperations.encryptFile.call(this, i);
                break;
              case 'decryptFile':
                result = await encryptionOperations.decryptFile.call(this, i);
                break;
            }
            break;

          case 'metadata':
            switch (operation) {
              case 'setObjectMetadata':
                result = await metadataOperations.setObjectMetadata.call(this, i);
                break;
              case 'getObjectMetadata':
                result = await metadataOperations.getObjectMetadata.call(this, i);
                break;
              case 'setObjectTags':
                result = await metadataOperations.setObjectTags.call(this, i);
                break;
              case 'getObjectTags':
                result = await metadataOperations.getObjectTags.call(this, i);
                break;
            }
            break;

          case 'versioning':
            switch (operation) {
              case 'listObjectVersions':
                result = await versioningOperations.listObjectVersions.call(this, i);
                break;
              case 'getObjectVersion':
                result = await versioningOperations.getObjectVersion.call(this, i);
                break;
              case 'deleteObjectVersion':
                result = await versioningOperations.deleteObjectVersion.call(this, i);
                break;
            }
            break;

          case 'utility':
            switch (operation) {
              case 'generatePresignedURL':
                result = await utilityOperations.generatePresignedURL.call(this, i);
                break;
              case 'convertAccessGrant':
                result = await utilityOperations.convertAccessGrant.call(this, i);
                break;
              case 'getAPIHealth':
                result = await utilityOperations.getAPIHealth.call(this, i);
                break;
            }
            break;

          default:
            throw new NodeOperationError(
              this.getNode(),
              `Unknown resource: ${resource}`,
              { itemIndex: i },
            );
        }

        returnData.push(...result);
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
