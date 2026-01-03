/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createStorjClient } from '../../transport/s3Client';
import type { IStorjCredentials } from '../../utils/types';
import { parseAccessGrant, convertToS3Credentials, validateAccessGrant } from '../../utils/accessGrant';

export async function generatePresignedURL(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const bucket = this.getNodeParameter('bucket', index) as string;
  const key = this.getNodeParameter('key', index) as string;
  const operation = this.getNodeParameter('presignedOperation', index, 'getObject') as string;
  const expiresIn = this.getNodeParameter('expiresIn', index, 3600) as number;

  const client = await createStorjClient(this);

  const method: 'GET' | 'PUT' = operation === 'putObject' ? 'PUT' : 'GET';

  const presignedUrl = await client.generatePresignedUrl(
    bucket,
    key,
    method,
    expiresIn,
  );

  return [
    {
      json: {
        url: presignedUrl,
        bucket,
        key,
        operation,
        method,
        expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        generatedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function convertAccessGrant(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const accessGrant = this.getNodeParameter('accessGrantToConvert', index) as string;

  // Validate the access grant first
  const isValid = validateAccessGrant(accessGrant);
  if (!isValid) {
    throw new NodeOperationError(
      this.getNode(),
      'Invalid access grant format. Please provide a valid Storj access grant.',
      { itemIndex: index },
    );
  }

  // Parse to get info
  const parsed = parseAccessGrant(accessGrant);

  // Convert to S3 credentials
  const s3Credentials = convertToS3Credentials(accessGrant);

  return [
    {
      json: {
        s3Credentials: {
          accessKeyId: s3Credentials.accessKeyId,
          secretAccessKey: s3Credentials.secretAccessKey,
          endpoint: s3Credentials.endpoint,
        },
        grantInfo: {
          satellite: parsed.satellite,
          apiKey: parsed.apiKey ? '***' + parsed.apiKey.slice(-8) : 'hidden',
          encryptionAccess: parsed.encryptionAccess ? 'present' : 'absent',
        },
        usage: {
          note: 'Use these S3-compatible credentials with any S3 client',
          endpoint: s3Credentials.endpoint,
          region: 'global',
          pathStyle: true,
        },
        convertedAt: new Date().toISOString(),
      },
      pairedItem: { item: index },
    },
  ];
}

export async function getAPIHealth(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const credentials = (await this.getCredentials('storjApi')) as unknown as IStorjCredentials;
  const client = await createStorjClient(this);

  const satellite =
    credentials.satellite === 'custom'
      ? credentials.customSatellite
      : credentials.satellite;

  const healthChecks: IDataObject = {
    satellite,
    endpoint: credentials.s3Endpoint,
    timestamp: new Date().toISOString(),
  };

  // Check S3 API connectivity by listing buckets
  const startTime = Date.now();
  try {
    await client.listBuckets();
    const latency = Date.now() - startTime;
    
    healthChecks.s3Api = {
      status: 'healthy',
      latencyMs: latency,
      message: 'Successfully connected to Storj S3 gateway',
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    healthChecks.s3Api = {
      status: 'unhealthy',
      latencyMs: latency,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }

  // Check satellite endpoint
  const satelliteUrl = satellite?.includes('.')
    ? `https://${satellite}`
    : `https://${satellite}.storj.io`;
  
  healthChecks.satelliteEndpoint = satelliteUrl;
  
  // Provide overall status
  const s3Status = (healthChecks.s3Api as IDataObject)?.status;
  const isHealthy = s3Status === 'healthy';
  
  healthChecks.overall = {
    status: isHealthy ? 'healthy' : 'degraded',
    message: isHealthy 
      ? 'All Storj services are operational'
      : 'Some services may be experiencing issues',
  };

  // Add service URLs
  healthChecks.serviceUrls = {
    s3Gateway: credentials.s3Endpoint,
    linkshare: `https://link.${satellite?.replace('.storj.io', '') || 'us1'}.storjshare.io`,
    console: `https://${satellite}`,
    statusPage: 'https://status.storj.io',
  };

  return [
    {
      json: healthChecks,
      pairedItem: { item: index },
    },
  ];
}

export const utilityOperations = {
  generatePresignedURL,
  convertAccessGrant,
  getAPIHealth,
};
