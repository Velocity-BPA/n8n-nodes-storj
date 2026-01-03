/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
  Icon,
} from 'n8n-workflow';

export class StorjApi implements ICredentialType {
  name = 'storjApi';
  displayName = 'Storj API';
  documentationUrl = 'https://docs.storj.io/';
  icon: Icon = 'file:storj.svg';

  properties: INodeProperties[] = [
    {
      displayName: 'Authentication Method',
      name: 'authMethod',
      type: 'options',
      options: [
        {
          name: 'S3 Compatible Credentials',
          value: 's3',
          description: 'Use Access Key ID and Secret Access Key',
        },
        {
          name: 'Access Grant',
          value: 'accessGrant',
          description: 'Use Storj Access Grant token',
        },
      ],
      default: 's3',
    },
    {
      displayName: 'Satellite',
      name: 'satellite',
      type: 'options',
      options: [
        {
          name: 'US1 (North America)',
          value: 'us1.storj.io',
        },
        {
          name: 'EU1 (Europe)',
          value: 'eu1.storj.io',
        },
        {
          name: 'AP1 (Asia-Pacific)',
          value: 'ap1.storj.io',
        },
        {
          name: 'Custom',
          value: 'custom',
        },
      ],
      default: 'us1.storj.io',
      description: 'The Storj satellite endpoint to connect to',
    },
    {
      displayName: 'Custom Satellite URL',
      name: 'customSatellite',
      type: 'string',
      default: '',
      placeholder: 'https://custom-satellite.example.com',
      displayOptions: {
        show: {
          satellite: ['custom'],
        },
      },
      description: 'Custom satellite endpoint URL',
    },
    {
      displayName: 'Access Key ID',
      name: 'accessKeyId',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          authMethod: ['s3'],
        },
      },
      description: 'S3-compatible Access Key ID from Storj',
    },
    {
      displayName: 'Secret Access Key',
      name: 'secretAccessKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      displayOptions: {
        show: {
          authMethod: ['s3'],
        },
      },
      description: 'S3-compatible Secret Access Key from Storj',
    },
    {
      displayName: 'Access Grant',
      name: 'accessGrant',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      displayOptions: {
        show: {
          authMethod: ['accessGrant'],
        },
      },
      description: 'Storj Access Grant token for authentication',
    },
    {
      displayName: 'S3 Endpoint',
      name: 's3Endpoint',
      type: 'string',
      default: 'https://gateway.storjshare.io',
      description: 'S3-compatible gateway endpoint',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.s3Endpoint}}',
      url: '/',
      method: 'GET',
      headers: {
        'x-amz-date': '={{new Date().toISOString().replace(/[:-]|\\.[0-9]{3}/g, "")}}',
      },
    },
  };
}
