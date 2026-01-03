# n8n-nodes-storj

> [Velocity BPA Licensing Notice]
>
> This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
>
> Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.
>
> For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.

A comprehensive n8n community node for [Storj](https://storj.io), the decentralized cloud storage network. This node provides full S3-compatible operations, access grant management, client-side encryption, and file sharing capabilities.

![n8n](https://img.shields.io/badge/n8n-community%20node-ff6d5a)
![Storj](https://img.shields.io/badge/Storj-S3%20Compatible-2683ff)
![License](https://img.shields.io/badge/license-BSL--1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6)

## Features

- **10 Resource Categories** with 43+ operations
- **S3-Compatible API** - Works with existing S3 tools and workflows
- **Access Grant Management** - Create, parse, restrict, and revoke access grants
- **Client-Side Encryption** - AES-256-GCM encryption utilities
- **Multipart Uploads** - Handle large files up to 5TB
- **Presigned URLs** - Generate temporary access URLs
- **File Sharing** - Create shareable links with expiration
- **Object Versioning** - Manage object versions
- **Metadata & Tagging** - Set custom metadata and tags
- **Poll-Based Triggers** - Monitor for new uploads, deletions, and usage thresholds

## Installation

### Community Nodes (Recommended)

1. Open n8n
2. Go to **Settings** > **Community Nodes**
3. Click **Install a community node**
4. Enter `n8n-nodes-storj`
5. Click **Install**

### Manual Installation

```bash
# Navigate to your n8n installation directory
cd ~/.n8n

# Install the package
npm install n8n-nodes-storj

# Restart n8n
```

### Development Installation

```bash
# Clone or extract the package
git clone https://github.com/Velocity-BPA/n8n-nodes-storj.git
cd n8n-nodes-storj

# Install dependencies
npm install

# Build the project
npm run build

# Create symlink to n8n custom nodes directory
mkdir -p ~/.n8n/custom
ln -s $(pwd) ~/.n8n/custom/n8n-nodes-storj

# Restart n8n
n8n start
```

## Credentials Setup

### S3 Compatible Authentication (Recommended)

| Field | Description |
|-------|-------------|
| Authentication Method | Select "S3 Compatible" |
| Access Key ID | Your Storj S3 access key |
| Secret Access Key | Your Storj S3 secret key |
| Satellite | Select your satellite (us1, eu1, ap1, or custom) |
| S3 Endpoint | Auto-populated based on satellite |

### Access Grant Authentication

| Field | Description |
|-------|-------------|
| Authentication Method | Select "Access Grant" |
| Access Grant | Your full Storj access grant string |
| Satellite | Select your satellite |

### Getting Credentials

1. Log in to your [Storj satellite console](https://us1.storj.io)
2. Navigate to **Access** > **Create S3 Credentials**
3. Copy the Access Key and Secret Key
4. Or generate an Access Grant for more granular control

## Resources & Operations

### Bucket Operations

| Operation | Description |
|-----------|-------------|
| List Buckets | Get all buckets in your project |
| Create Bucket | Create a new bucket |
| Delete Bucket | Remove an empty bucket |
| Get Bucket Info | Get bucket details |
| Get Bucket Location | Get bucket region |
| Set Bucket ACL | Set access control list |

### Object Operations

| Operation | Description |
|-----------|-------------|
| List Objects | List objects in a bucket with optional prefix/delimiter |
| Upload Object | Upload a file to Storj |
| Download Object | Download a file from Storj |
| Delete Object | Remove an object |
| Copy Object | Copy an object within or between buckets |
| Get Object Info | Get object metadata |
| Head Object | Check if an object exists |

### Multipart Upload Operations

| Operation | Description |
|-----------|-------------|
| Initiate Upload | Start a multipart upload |
| Upload Part | Upload a chunk (5MB-5GB each) |
| Complete Upload | Finish and assemble the multipart upload |
| Abort Upload | Cancel a multipart upload |
| List Parts | List uploaded parts |

### Access Grant Operations

| Operation | Description |
|-----------|-------------|
| Create Access Grant | Create a new access grant with restrictions |
| Parse Access Grant | Decode and inspect an access grant |
| Restrict Access Grant | Add restrictions to an existing grant |
| Revoke Access Grant | Invalidate an access grant |

### Sharing Operations

| Operation | Description |
|-----------|-------------|
| Create Share Link | Generate a public share URL |
| Get Share Info | Get details about a share |
| Revoke Share | Disable a share link |
| Set Expiration | Update share expiration time |

### Project Operations

| Operation | Description |
|-----------|-------------|
| Get Project Info | Get account/project details |
| Get Usage | Get storage and bandwidth usage |
| Get Limits | Get account limits |
| Get Billing | Get pricing and billing info |

### Encryption Operations

| Operation | Description |
|-----------|-------------|
| Generate Encryption Key | Create a new AES-256 encryption key |
| Encrypt File | Encrypt data before upload |
| Decrypt File | Decrypt data after download |

### Metadata Operations

| Operation | Description |
|-----------|-------------|
| Set Object Metadata | Set custom metadata |
| Get Object Metadata | Retrieve metadata |
| Set Object Tags | Add key-value tags |
| Get Object Tags | Retrieve tags |

### Versioning Operations

| Operation | Description |
|-----------|-------------|
| List Object Versions | Get all versions of an object |
| Get Object Version | Download a specific version |
| Delete Object Version | Remove a specific version |

### Utility Operations

| Operation | Description |
|-----------|-------------|
| Generate Presigned URL | Create temporary access URLs |
| Convert Access Grant | Convert access grant to S3 credentials |
| Get API Health | Check Storj service connectivity |

## Trigger Node

The Storj Trigger node monitors your Storj storage for events using polling.

| Trigger Type | Description |
|--------------|-------------|
| New Object Uploaded | Fires when new objects are uploaded |
| Object Deleted | Fires when objects are removed |
| Bucket Created | Fires when new buckets are created |
| Usage Threshold Alert | Fires when usage exceeds a threshold |

### Trigger Configuration

- **Bucket Name**: Bucket to monitor (for object triggers)
- **Prefix**: Filter by object prefix
- **Suffix Filter**: Filter by file extension
- **Include Content**: Download object content with trigger
- **Threshold Type**: Storage size or object count
- **Threshold Value**: Trigger threshold

## Usage Examples

### Upload a File

```javascript
// In n8n, use the Storj node with:
// Resource: Object
// Operation: Upload Object
// Bucket: my-bucket
// Key: documents/report.pdf
// Binary Property: data (from previous node)
```

### Create a Share Link with Expiration

```javascript
// Resource: Sharing
// Operation: Create Share Link
// Bucket: my-bucket
// Key: images/photo.jpg
// Expires At: 2024-12-31T23:59:59Z
```

### Generate Presigned URL for Download

```javascript
// Resource: Utility
// Operation: Generate Presigned URL
// Bucket: my-bucket
// Key: files/document.pdf
// Presigned Operation: Download (GET)
// Expires In: 3600 (1 hour)
```

### Encrypt and Upload a File

```javascript
// Step 1: Generate encryption key
// Resource: Encryption
// Operation: Generate Encryption Key
// Key Length: 256 bits

// Step 2: Encrypt the file
// Resource: Encryption
// Operation: Encrypt File
// Binary Property: data
// Encryption Key: (from step 1)

// Step 3: Upload encrypted file
// Resource: Object
// Operation: Upload Object
// Binary Property: data (encrypted)
```

## Storj Concepts

| Concept | Description |
|---------|-------------|
| **Bucket** | Storage container for objects |
| **Object** | Individual file stored in a bucket |
| **Access Grant** | Encoded permission token with satellite, API key, and encryption info |
| **Satellite** | Metadata coordinator node (us1, eu1, ap1) |
| **Storage Node** | Distributed nodes that store encrypted data pieces |
| **Encryption Key** | Client-side encryption key for data privacy |
| **Linkshare** | Service for generating public share URLs |
| **STORJ Token** | Payment/utility token for the network |

## Satellites

| Satellite | Region | S3 Gateway |
|-----------|--------|------------|
| us1.storj.io | United States | gateway.us1.storj.io |
| eu1.storj.io | Europe | gateway.eu1.storj.io |
| ap1.storj.io | Asia Pacific | gateway.ap1.storj.io |

## Error Handling

The node provides detailed error messages for common issues:

- **Invalid credentials**: Check your access key and secret
- **Bucket not found**: Verify the bucket name exists
- **Access denied**: Check your access grant permissions
- **Object not found**: Verify the object key
- **Network errors**: Check your satellite endpoint

Enable "Continue on Fail" to process remaining items when errors occur.

## Security Best Practices

1. **Use Access Grants** - More granular control than S3 keys
2. **Restrict Permissions** - Grant only necessary access (read/write/delete/list)
3. **Set Expirations** - Use time-limited access grants and share links
4. **Path Restrictions** - Limit access to specific bucket prefixes
5. **Client-Side Encryption** - Add extra encryption layer for sensitive data
6. **Rotate Credentials** - Regularly rotate access keys and grants

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Watch mode for development
npm run dev
```

## Author

**Velocity BPA**
- Website: [velobpa.com](https://velobpa.com)
- GitHub: [Velocity-BPA](https://github.com/Velocity-BPA)

## Licensing

This n8n community node is licensed under the **Business Source License 1.1**.

### Free Use
Permitted for personal, educational, research, and internal business use.

### Commercial Use
Use of this node within any SaaS, PaaS, hosted platform, managed service,
or paid automation offering requires a commercial license.

For licensing inquiries:
**licensing@velobpa.com**

See [LICENSE](LICENSE), [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md), and [LICENSING_FAQ.md](LICENSING_FAQ.md) for details.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Documentation**: [Storj Docs](https://docs.storj.io)
- **Issues**: [GitHub Issues](https://github.com/Velocity-BPA/n8n-nodes-storj/issues)
- **n8n Community**: [n8n Community Forum](https://community.n8n.io)
- **Storj Support**: [Storj Support](https://support.storj.io)

## Acknowledgments

- [Storj Labs](https://storj.io) for the decentralized storage network
- [n8n](https://n8n.io) for the workflow automation platform
- The open source community for continuous inspiration
