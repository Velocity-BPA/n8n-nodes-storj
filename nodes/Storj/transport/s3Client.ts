/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, IPollFunctions, IHttpRequestMethods, IDataObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import * as crypto from 'crypto';
import type { IStorjCredentials } from '../utils/types';
import { STORJ_REGIONS } from '../constants/constants';

// Type for functions that can get credentials
type CredentialFunctions = IExecuteFunctions | IPollFunctions;

export class StorjS3Client {
  private credentials: IStorjCredentials;
  private executeFunctions: CredentialFunctions;

  constructor(executeFunctions: CredentialFunctions, credentials: IStorjCredentials) {
    this.executeFunctions = executeFunctions;
    this.credentials = credentials;
  }

  private getRegion(): string {
    const satellite = this.credentials.satellite === 'custom' 
      ? this.credentials.customSatellite || 'us1.storj.io'
      : this.credentials.satellite;
    return STORJ_REGIONS[satellite as keyof typeof STORJ_REGIONS] || 'us-east-1';
  }

  private getEndpoint(): string {
    return this.credentials.s3Endpoint || 'https://gateway.storjshare.io';
  }

  private sha256(data: string | Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private hmacSha256(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data).digest();
  }

  private getSignatureKey(dateStamp: string, region: string, service: string): Buffer {
    const kDate = this.hmacSha256('AWS4' + this.credentials.secretAccessKey!, dateStamp);
    const kRegion = this.hmacSha256(kDate, region);
    const kService = this.hmacSha256(kRegion, service);
    return this.hmacSha256(kService, 'aws4_request');
  }

  private formatAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  private formatDateStamp(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private signRequest(
    method: string,
    uri: string,
    queryParams: Record<string, string>,
    headers: Record<string, string>,
    payload: string | Buffer,
  ): Record<string, string> {
    const date = new Date();
    const amzDate = this.formatAmzDate(date);
    const dateStamp = this.formatDateStamp(date);
    const region = this.getRegion();
    const service = 's3';
    const endpoint = new URL(this.getEndpoint());
    const host = endpoint.host;

    headers['host'] = host;
    headers['x-amz-date'] = amzDate;
    headers['x-amz-content-sha256'] = this.sha256(payload || '');

    const sortedHeaders = Object.keys(headers).sort();
    const signedHeaders = sortedHeaders.join(';');
    const canonicalHeaders = sortedHeaders
      .map((key) => `${key.toLowerCase()}:${headers[key].trim()}\n`)
      .join('');

    const sortedQueryParams = Object.keys(queryParams).sort();
    const canonicalQueryString = sortedQueryParams
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const payloadHash = this.sha256(payload || '');
    const canonicalRequest = [
      method,
      uri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n');

    const signingKey = this.getSignatureKey(dateStamp, region, service);
    const signature = this.hmacSha256(signingKey, stringToSign).toString('hex');

    headers['Authorization'] = [
      `AWS4-HMAC-SHA256 Credential=${this.credentials.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ');

    return headers;
  }

  async request(
    method: IHttpRequestMethods,
    path: string,
    queryParams: Record<string, string> = {},
    body?: string | Buffer | IDataObject,
    additionalHeaders: Record<string, string> = {},
  ): Promise<IDataObject> {
    const endpoint = this.getEndpoint();
    const uri = path.startsWith('/') ? path : `/${path}`;
    
    let payload: string | Buffer = '';
    const headers: Record<string, string> = { ...additionalHeaders };

    if (body) {
      if (Buffer.isBuffer(body)) {
        payload = body;
        headers['Content-Type'] = headers['Content-Type'] || 'application/octet-stream';
      } else if (typeof body === 'string') {
        payload = body;
        headers['Content-Type'] = headers['Content-Type'] || 'application/xml';
      } else {
        payload = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
      }
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const signedHeaders = this.signRequest(method, uri, queryParams, headers, payload);
    
    const queryString = Object.keys(queryParams).length > 0
      ? '?' + Object.entries(queryParams)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&')
      : '';

    try {
      const response = await this.executeFunctions.helpers.httpRequest({
        method,
        url: `${endpoint}${uri}${queryString}`,
        headers: signedHeaders,
        body: payload || undefined,
        returnFullResponse: true,
        ignoreHttpStatusErrors: true,
        encoding: 'arraybuffer',
      });

      const statusCode = response.statusCode || 200;
      let responseBody = response.body;

      if (Buffer.isBuffer(responseBody)) {
        const bodyString = responseBody.toString('utf-8');
        if (bodyString.startsWith('<?xml') || bodyString.startsWith('<')) {
          responseBody = this.parseXmlResponse(bodyString);
        } else {
          try {
            responseBody = JSON.parse(bodyString);
          } catch {
            responseBody = { data: bodyString };
          }
        }
      }

      if (statusCode >= 400) {
        const errorCode = responseBody?.Error?.Code || responseBody?.code || 'UnknownError';
        const errorMessage = responseBody?.Error?.Message || responseBody?.message || 'An error occurred';
        
        throw new NodeApiError(
          this.executeFunctions.getNode(),
          {
            message: errorMessage,
            code: errorCode,
            httpCode: statusCode,
          },
        );
      }

      return responseBody as IDataObject;
    } catch (error) {
      if (error instanceof NodeApiError) {
        throw error;
      }
      const err = error as Error;
      throw new NodeApiError(
        this.executeFunctions.getNode(),
        {
          message: err.message || 'Request failed',
        },
      );
    }
  }

  private parseXmlResponse(xml: string): IDataObject {
    // Simple XML parser for S3 responses
    const parseElement = (xmlString: string): IDataObject => {
      const obj: IDataObject = {};
      const tagRegex = /<(\w+)(?:\s[^>]*)?>([^<]*(?:<(?!\/\1>)[^<]*)*)<\/\1>/gs;
      let match;

      while ((match = tagRegex.exec(xmlString)) !== null) {
        const [, tagName, content] = match;
        const trimmedContent = content.trim();

        if (trimmedContent.includes('<')) {
          // Nested elements
          const nested = parseElement(trimmedContent);
          if (obj[tagName]) {
            if (!Array.isArray(obj[tagName])) {
              obj[tagName] = [obj[tagName]];
            }
            (obj[tagName] as IDataObject[]).push(nested);
          } else {
            obj[tagName] = nested;
          }
        } else {
          // Simple value
          if (obj[tagName]) {
            if (!Array.isArray(obj[tagName])) {
              obj[tagName] = [obj[tagName]];
            }
            (obj[tagName] as string[]).push(trimmedContent);
          } else {
            obj[tagName] = trimmedContent;
          }
        }
      }

      return obj;
    };

    // Remove XML declaration
    const cleanXml = xml.replace(/<\?xml[^?]*\?>/g, '');
    const parsed = parseElement(cleanXml);
    
    return parsed;
  }

  async listBuckets(): Promise<IDataObject> {
    return this.request('GET', '/');
  }

  async createBucket(bucketName: string, acl?: string): Promise<IDataObject> {
    const headers: Record<string, string> = {};
    if (acl) {
      headers['x-amz-acl'] = acl;
    }
    return this.request('PUT', `/${bucketName}`, {}, undefined, headers);
  }

  async deleteBucket(bucketName: string): Promise<IDataObject> {
    return this.request('DELETE', `/${bucketName}`);
  }

  async getBucketLocation(bucketName: string): Promise<IDataObject> {
    return this.request('GET', `/${bucketName}`, { location: '' });
  }

  async setBucketACL(bucketName: string, acl: string): Promise<IDataObject> {
    return this.request('PUT', `/${bucketName}`, { acl: '' }, undefined, { 'x-amz-acl': acl });
  }

  async listObjects(
    bucketName: string,
    prefix?: string,
    delimiter?: string,
    maxKeys?: number,
    marker?: string,
  ): Promise<IDataObject> {
    const queryParams: Record<string, string> = {};
    if (prefix) queryParams['prefix'] = prefix;
    if (delimiter) queryParams['delimiter'] = delimiter;
    if (maxKeys) queryParams['max-keys'] = maxKeys.toString();
    if (marker) queryParams['marker'] = marker;

    return this.request('GET', `/${bucketName}`, queryParams);
  }

  async putObject(
    bucketName: string,
    key: string,
    body: Buffer | string,
    contentType?: string,
    metadata?: Record<string, string>,
    acl?: string,
  ): Promise<IDataObject> {
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = contentType;
    if (acl) headers['x-amz-acl'] = acl;
    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        headers[`x-amz-meta-${k}`] = v;
      }
    }

    return this.request('PUT', `/${bucketName}/${encodeURIComponent(key)}`, {}, body, headers);
  }

  async getObject(bucketName: string, key: string, versionId?: string): Promise<IDataObject> {
    const queryParams: Record<string, string> = {};
    if (versionId) queryParams['versionId'] = versionId;

    return this.request('GET', `/${bucketName}/${encodeURIComponent(key)}`, queryParams);
  }

  async deleteObject(bucketName: string, key: string, versionId?: string): Promise<IDataObject> {
    const queryParams: Record<string, string> = {};
    if (versionId) queryParams['versionId'] = versionId;

    return this.request('DELETE', `/${bucketName}/${encodeURIComponent(key)}`, queryParams);
  }

  async headObject(bucketName: string, key: string, versionId?: string): Promise<IDataObject> {
    const queryParams: Record<string, string> = {};
    if (versionId) queryParams['versionId'] = versionId;

    const endpoint = this.getEndpoint();
    const uri = `/${bucketName}/${encodeURIComponent(key)}`;
    const headers: Record<string, string> = {};
    
    const signedHeaders = this.signRequest('HEAD', uri, queryParams, headers, '');

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + Object.entries(queryParams)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&')
      : '';

    const response = await this.executeFunctions.helpers.httpRequest({
      method: 'HEAD',
      url: `${endpoint}${uri}${queryString}`,
      headers: signedHeaders,
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    });

    const statusCode = response.statusCode || 200;

    if (statusCode === 404) {
      return { exists: false };
    }

    if (statusCode >= 400) {
      throw new NodeApiError(
        this.executeFunctions.getNode(),
        {
          message: 'Failed to check object existence',
          httpCode: statusCode,
        },
      );
    }

    return {
      exists: true,
      contentLength: response.headers?.['content-length'],
      contentType: response.headers?.['content-type'],
      etag: response.headers?.['etag'],
      lastModified: response.headers?.['last-modified'],
      versionId: response.headers?.['x-amz-version-id'],
      metadata: this.extractMetadata(response.headers as Record<string, string>),
    };
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
    metadata?: Record<string, string>,
    metadataDirective?: 'COPY' | 'REPLACE',
  ): Promise<IDataObject> {
    const headers: Record<string, string> = {
      'x-amz-copy-source': `/${sourceBucket}/${encodeURIComponent(sourceKey)}`,
    };
    
    if (metadataDirective) {
      headers['x-amz-metadata-directive'] = metadataDirective;
    }
    
    if (metadata && metadataDirective === 'REPLACE') {
      for (const [k, v] of Object.entries(metadata)) {
        headers[`x-amz-meta-${k}`] = v;
      }
    }

    return this.request('PUT', `/${destBucket}/${encodeURIComponent(destKey)}`, {}, undefined, headers);
  }

  async initiateMultipartUpload(
    bucketName: string,
    key: string,
    contentType?: string,
    metadata?: Record<string, string>,
  ): Promise<IDataObject> {
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = contentType;
    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        headers[`x-amz-meta-${k}`] = v;
      }
    }

    return this.request('POST', `/${bucketName}/${encodeURIComponent(key)}`, { uploads: '' }, undefined, headers);
  }

  async uploadPart(
    bucketName: string,
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<IDataObject> {
    return this.request(
      'PUT',
      `/${bucketName}/${encodeURIComponent(key)}`,
      { uploadId, partNumber: partNumber.toString() },
      body,
    );
  }

  async completeMultipartUpload(
    bucketName: string,
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
  ): Promise<IDataObject> {
    const partsXml = parts
      .map((p) => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`)
      .join('');
    const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

    return this.request(
      'POST',
      `/${bucketName}/${encodeURIComponent(key)}`,
      { uploadId },
      body,
      { 'Content-Type': 'application/xml' },
    );
  }

  async abortMultipartUpload(bucketName: string, key: string, uploadId: string): Promise<IDataObject> {
    return this.request('DELETE', `/${bucketName}/${encodeURIComponent(key)}`, { uploadId });
  }

  async listParts(
    bucketName: string,
    key: string,
    uploadId: string,
    maxParts?: number,
    partNumberMarker?: number,
  ): Promise<IDataObject> {
    const queryParams: Record<string, string> = { uploadId };
    if (maxParts) queryParams['max-parts'] = maxParts.toString();
    if (partNumberMarker) queryParams['part-number-marker'] = partNumberMarker.toString();

    return this.request('GET', `/${bucketName}/${encodeURIComponent(key)}`, queryParams);
  }

  async getObjectTagging(bucketName: string, key: string): Promise<IDataObject> {
    return this.request('GET', `/${bucketName}/${encodeURIComponent(key)}`, { tagging: '' });
  }

  async putObjectTagging(
    bucketName: string,
    key: string,
    tags: { Key: string; Value: string }[],
  ): Promise<IDataObject> {
    const tagsXml = tags.map((t) => `<Tag><Key>${t.Key}</Key><Value>${t.Value}</Value></Tag>`).join('');
    const body = `<Tagging><TagSet>${tagsXml}</TagSet></Tagging>`;

    return this.request(
      'PUT',
      `/${bucketName}/${encodeURIComponent(key)}`,
      { tagging: '' },
      body,
      { 'Content-Type': 'application/xml' },
    );
  }

  async listObjectVersions(
    bucketName: string,
    prefix?: string,
    keyMarker?: string,
    versionIdMarker?: string,
    maxKeys?: number,
  ): Promise<IDataObject> {
    const queryParams: Record<string, string> = { versions: '' };
    if (prefix) queryParams['prefix'] = prefix;
    if (keyMarker) queryParams['key-marker'] = keyMarker;
    if (versionIdMarker) queryParams['version-id-marker'] = versionIdMarker;
    if (maxKeys) queryParams['max-keys'] = maxKeys.toString();

    return this.request('GET', `/${bucketName}`, queryParams);
  }

  generatePresignedUrl(
    bucketName: string,
    key: string,
    method: 'GET' | 'PUT',
    expiresIn: number,
  ): string {
    const date = new Date();
    const amzDate = this.formatAmzDate(date);
    const dateStamp = this.formatDateStamp(date);
    const region = this.getRegion();
    const service = 's3';
    const endpoint = this.getEndpoint();

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const uri = `/${bucketName}/${encodeURIComponent(key)}`;

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.credentials.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expiresIn.toString(),
      'X-Amz-SignedHeaders': 'host',
    };

    const sortedParams = Object.keys(queryParams).sort();
    const canonicalQueryString = sortedParams
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    const host = new URL(endpoint).host;
    const canonicalRequest = [
      method,
      uri,
      canonicalQueryString,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n');

    const signingKey = this.getSignatureKey(dateStamp, region, service);
    const signature = this.hmacSha256(signingKey, stringToSign).toString('hex');

    return `${endpoint}${uri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  private extractMetadata(headers: Record<string, string>): Record<string, string> {
    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase().startsWith('x-amz-meta-')) {
        metadata[key.slice(11)] = value;
      }
    }
    return metadata;
  }
}

export async function createStorjClient(
  executeFunctions: CredentialFunctions,
): Promise<StorjS3Client> {
  const credentials = await executeFunctions.getCredentials('storjApi') as unknown as IStorjCredentials;
  return new StorjS3Client(executeFunctions, credentials);
}
