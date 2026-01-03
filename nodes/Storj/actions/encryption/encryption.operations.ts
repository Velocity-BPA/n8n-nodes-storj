/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
  generateEncryptionKey,
  encryptFile,
  decryptFile,
  generatePassphrase,
} from '../../utils/encryption';

export async function generateEncryptionKeyOperation(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const usePassphrase = this.getNodeParameter('usePassphrase', index, false) as boolean;
  const passphrase = usePassphrase
    ? (this.getNodeParameter('passphrase', index, '') as string)
    : undefined;

  let encryptionKey;
  let generatedPassphrase: string | undefined;

  if (usePassphrase && !passphrase) {
    // Generate a random passphrase
    generatedPassphrase = generatePassphrase(32);
    encryptionKey = generateEncryptionKey(generatedPassphrase);
  } else if (usePassphrase && passphrase) {
    encryptionKey = generateEncryptionKey(passphrase);
  } else {
    encryptionKey = generateEncryptionKey();
  }

  return [
    {
      json: {
        key: encryptionKey.key,
        salt: encryptionKey.salt,
        passphrase: generatedPassphrase || (usePassphrase ? '[user-provided]' : undefined),
        algorithm: 'aes-256-gcm',
        createdAt: encryptionKey.createdAt,
        warning: 'Store this key securely. It cannot be recovered if lost.',
      },
      pairedItem: { item: index },
    },
  ];
}

export async function encryptFileOperation(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index, 'data') as string;
  const passphrase = this.getNodeParameter('passphrase', index) as string;
  const outputPropertyName = this.getNodeParameter(
    'outputPropertyName',
    index,
    'encryptedData',
  ) as string;

  if (!passphrase) {
    throw new NodeOperationError(this.getNode(), 'Encryption passphrase is required', {
      itemIndex: index,
    });
  }

  // Get the binary data
  const binaryData = this.helpers.assertBinaryData(index, binaryPropertyName);
  const fileBuffer = await this.helpers.getBinaryDataBuffer(index, binaryPropertyName);

  // Encrypt the file
  const { encrypted, metadata, salt } = encryptFile(fileBuffer, passphrase);

  // Prepare encrypted binary data
  const encryptedBinaryData = await this.helpers.prepareBinaryData(
    encrypted,
    `${binaryData.fileName || 'file'}.encrypted`,
    'application/octet-stream',
  );

  return [
    {
      json: {
        originalFileName: binaryData.fileName,
        originalSize: fileBuffer.length,
        encryptedSize: encrypted.length,
        salt,
        iv: metadata.iv,
        algorithm: metadata.algorithm,
        encryptedAt: new Date().toISOString(),
        note: 'Store the salt with the encrypted file for decryption',
      },
      binary: {
        [outputPropertyName]: encryptedBinaryData,
      },
      pairedItem: { item: index },
    },
  ];
}

export async function decryptFileOperation(
  this: IExecuteFunctions,
  index: number,
): Promise<INodeExecutionData[]> {
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index, 'data') as string;
  const passphrase = this.getNodeParameter('passphrase', index) as string;
  const salt = this.getNodeParameter('salt', index) as string;
  const outputPropertyName = this.getNodeParameter(
    'outputPropertyName',
    index,
    'decryptedData',
  ) as string;
  const outputFileName = this.getNodeParameter('outputFileName', index, '') as string;

  if (!passphrase) {
    throw new NodeOperationError(this.getNode(), 'Decryption passphrase is required', {
      itemIndex: index,
    });
  }

  if (!salt) {
    throw new NodeOperationError(this.getNode(), 'Encryption salt is required for decryption', {
      itemIndex: index,
    });
  }

  // Get the encrypted binary data
  const binaryData = this.helpers.assertBinaryData(index, binaryPropertyName);
  const encryptedBuffer = await this.helpers.getBinaryDataBuffer(index, binaryPropertyName);

  try {
    // Decrypt the file
    const decrypted = decryptFile(encryptedBuffer, passphrase, salt);

    // Determine output filename
    let fileName = outputFileName;
    if (!fileName) {
      // Try to restore original filename by removing .encrypted extension
      fileName = binaryData.fileName?.replace(/\.encrypted$/, '') || 'decrypted_file';
    }

    // Guess mime type from filename
    const mimeType = getMimeTypeFromFileName(fileName);

    // Prepare decrypted binary data
    const decryptedBinaryData = await this.helpers.prepareBinaryData(decrypted, fileName, mimeType);

    return [
      {
        json: {
          fileName,
          originalEncryptedSize: encryptedBuffer.length,
          decryptedSize: decrypted.length,
          mimeType,
          decryptedAt: new Date().toISOString(),
        },
        binary: {
          [outputPropertyName]: decryptedBinaryData,
        },
        pairedItem: { item: index },
      },
    ];
  } catch (error) {
    throw new NodeOperationError(
      this.getNode(),
      'Decryption failed. Please verify the passphrase and salt are correct.',
      { itemIndex: index },
    );
  }
}

function getMimeTypeFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    pdf: 'application/pdf',
    txt: 'text/plain',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    csv: 'text/csv',
    zip: 'application/zip',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export const encryptionOperations = {
  generateEncryptionKey: generateEncryptionKeyOperation,
  encryptFile: encryptFileOperation,
  decryptFile: decryptFileOperation,
};
