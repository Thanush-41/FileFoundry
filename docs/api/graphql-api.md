# File Vault System - API Documentation

## Overview

The File Vault System provides a comprehensive GraphQL API for secure file storage, deduplication, sharing, and management. The API supports both authenticated and public operations with role-based access control.

## Base URLs

- **Development**: `http://localhost:8080/graphql`
- **GraphQL Playground**: `http://localhost:8080/`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Getting a Token

```graphql
mutation Login {
  login(input: {
    username: "your-username"
    password: "your-password"
  }) {
    token
    expiresAt
    user {
      id
      username
      email
      roles
    }
  }
}
```

## Core Operations

### Authentication & User Management

#### Register a New User

```graphql
mutation Register {
  register(input: {
    username: "newuser"
    email: "user@example.com"
    password: "securepassword"
    firstName: "John"
    lastName: "Doe"
  }) {
    token
    user {
      id
      username
      email
      storageQuota
      storageUsed
    }
  }
}
```

#### Get Current User Profile

```graphql
query Me {
  me {
    id
    username
    email
    firstName
    lastName
    storageQuota
    storageUsed
    roles
    createdAt
    lastLogin
  }
}
```

#### Update Profile

```graphql
mutation UpdateProfile {
  updateProfile(input: {
    firstName: "Jane"
    lastName: "Smith"
    email: "jane.smith@example.com"
  }) {
    id
    firstName
    lastName
    email
  }
}
```

#### Change Password

```graphql
mutation ChangePassword {
  changePassword(input: {
    currentPassword: "oldpassword"
    newPassword: "newsecurepassword"
  })
}
```

### File Operations

#### Upload a File

```graphql
mutation UploadFile {
  uploadFile(input: {
    file: $file  # File upload (multipart/form-data)
    folderId: "optional-folder-id"
    tags: ["document", "important"]
    description: "Important document"
  }) {
    id
    filename
    originalFilename
    mimeType
    size
    tags
    description
    createdAt
  }
}
```

#### List User Files

```graphql
query UserFiles {
  files(
    filter: {
      mimeType: "application/pdf"
      minSize: 1024
      maxSize: 10485760
      dateFrom: "2024-01-01T00:00:00Z"
      hasShares: true
    }
    sort: {
      field: CREATED_AT
      direction: DESC
    }
    first: 20
    after: "cursor-string"
  ) {
    edges {
      node {
        id
        filename
        mimeType
        size
        tags
        downloadCount
        canPreview
        createdAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

#### Get File Details

```graphql
query FileDetails {
  file(id: "file-uuid") {
    id
    filename
    originalFilename
    mimeType
    size
    tags
    description
    downloadCount
    canPreview
    owner {
      username
      email
    }
    folder {
      name
      path
    }
    sharedLinks {
      token
      shareType
      expiresAt
      downloadCount
    }
    createdAt
    updatedAt
  }
}
```

#### Update File Metadata

```graphql
mutation UpdateFile {
  updateFile(
    id: "file-uuid"
    input: {
      filename: "new-filename.pdf"
      tags: ["updated", "document"]
      description: "Updated description"
      folderId: "new-folder-id"
    }
  ) {
    id
    filename
    tags
    description
    folder {
      name
    }
  }
}
```

#### Delete File

```graphql
mutation DeleteFile {
  deleteFile(id: "file-uuid")
}
```

#### Download File

```graphql
query DownloadFile {
  downloadFile(id: "file-uuid")  # Returns signed download URL
}
```

### Folder Operations

#### Create Folder

```graphql
mutation CreateFolder {
  createFolder(input: {
    name: "Documents"
    parentId: "parent-folder-id"  # Optional
  }) {
    id
    name
    path
    parent {
      name
    }
    createdAt
  }
}
```

#### List Folders

```graphql
query UserFolders {
  folders {
    id
    name
    path
    parent {
      name
    }
    children {
      id
      name
    }
    files {
      id
      filename
    }
  }
}
```

#### Move File to Folder

```graphql
mutation MoveFile {
  moveFile(
    fileId: "file-uuid"
    folderId: "folder-uuid"
  ) {
    id
    filename
    folder {
      name
      path
    }
  }
}
```

### Sharing Operations

#### Create Share Link

```graphql
mutation CreateShareLink {
  createShareLink(input: {
    fileId: "file-uuid"
    shareType: PUBLIC
    expiresAt: "2024-12-31T23:59:59Z"
    maxDownloads: 100
  }) {
    id
    token
    shareType
    expiresAt
    maxDownloads
    downloadCount
    createdAt
  }
}
```

#### Share with Specific User

```graphql
mutation ShareWithUser {
  shareWithUser(input: {
    fileId: "file-uuid"
    userId: "target-user-uuid"
    permission: READ
    expiresAt: "2024-12-31T23:59:59Z"
  }) {
    id
    file {
      filename
    }
    sharedWith {
      username
      email
    }
    permission
    expiresAt
  }
}
```

#### Get Shared Link

```graphql
query SharedLink {
  sharedLink(token: "share-token") {
    id
    file {
      filename
      mimeType
      size
      canPreview
    }
    folder {
      name
      files {
        filename
        size
      }
    }
    shareType
    expiresAt
    maxDownloads
    downloadCount
  }
}
```

#### List My Shared Links

```graphql
query MySharedLinks {
  mySharedLinks {
    id
    token
    file {
      filename
    }
    shareType
    downloadCount
    expiresAt
    isActive
    createdAt
  }
}
```

#### Files Shared With Me

```graphql
query FilesSharedWithMe {
  filesSharedWithMe {
    id
    filename
    mimeType
    size
    owner {
      username
    }
    sharedBy {
      username
    }
    permission
    createdAt
  }
}
```

### Search Operations

#### Search Files

```graphql
query SearchFiles {
  searchFiles(
    query: "important document"
    limit: 20
  ) {
    id
    filename
    mimeType
    size
    tags
    description
    owner {
      username
    }
    createdAt
  }
}
```

### Statistics (Admin Only)

#### Storage Statistics

```graphql
query StorageStats {
  storageStats {
    totalFiles
    totalSize
    deduplicatedSize
    savedBytes
    savedPercentage
    userCount
    activeShares
  }
}
```

#### User Statistics

```graphql
query UserStats {
  userStats(userId: "user-uuid") {
    fileCount
    totalSize
    quotaUsed
    recentUploads
    downloadCount
    sharedFiles
  }
}
```

#### Top Files

```graphql
query TopFiles {
  topFiles(limit: 10) {
    id
    filename
    downloadCount
    shareCount
    lastDownloaded
    size
  }
}
```

### Admin Operations

#### List All Users

```graphql
query AllUsers {
  allUsers {
    id
    username
    email
    storageQuota
    storageUsed
    isActive
    roles
    createdAt
    lastLogin
  }
}
```

#### Update User Quota

```graphql
mutation UpdateUserQuota {
  updateUserQuota(
    userId: "user-uuid"
    quota: 104857600  # 100MB
  ) {
    id
    username
    storageQuota
    storageUsed
  }
}
```

#### Deactivate User

```graphql
mutation DeactivateUser {
  deactivateUser(userId: "user-uuid") {
    id
    username
    isActive
  }
}
```

## Error Handling

The API returns structured error responses:

```json
{
  "errors": [
    {
      "message": "File not found or access denied",
      "locations": [{"line": 2, "column": 3}],
      "path": ["file"],
      "extensions": {
        "code": "NOT_FOUND",
        "timestamp": "2024-01-15T10:30:00Z"
      }
    }
  ],
  "data": null
}
```

### Common Error Codes

- `UNAUTHENTICATED` - No valid authentication token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `QUOTA_EXCEEDED` - Storage quota exceeded
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `FILE_TOO_LARGE` - File exceeds size limit
- `INVALID_MIME_TYPE` - File type not allowed

## Rate Limits

- **Default**: 2 requests per second per user
- **Burst**: Up to 5 requests in burst
- **Admin users**: Higher limits apply

Rate limit headers are included in responses:
- `X-RateLimit-Limit` - Requests allowed per window
- `X-RateLimit-Remaining` - Requests remaining in window
- `X-RateLimit-Reset` - Window reset time

## File Upload Guidelines

### Supported MIME Types

- **Images**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- **Documents**: `application/pdf`, `text/plain`, `text/csv`
- **Data**: `application/json`, `application/xml`
- **Archives**: `application/zip`, `application/x-rar-compressed`
- **Media**: `video/mp4`, `video/webm`, `audio/mpeg`, `audio/wav`

### Size Limits

- **Default**: 100MB per file
- **User quota**: 10MB default (configurable by admin)
- **Admin quota**: 1GB default

### Security Notes

- All uploads are scanned for MIME type validation
- File content is hashed for deduplication
- Virus scanning recommended for production

## GraphQL Subscriptions (Bonus)

Real-time updates for enhanced user experience:

```graphql
subscription FileUploaded {
  fileUploaded(userId: "user-uuid") {
    id
    filename
    size
    createdAt
  }
}

subscription DownloadHappened {
  downloadHappened(fileId: "file-uuid")  # Returns new count
}

subscription StorageStatsUpdated {
  storageStatsUpdated {
    totalFiles
    totalSize
    savedBytes
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:8080/graphql',
  cache: new InMemoryCache(),
  headers: {
    Authorization: `Bearer ${token}`
  }
});

const GET_FILES = gql`
  query GetFiles {
    files(first: 10) {
      edges {
        node {
          id
          filename
          size
        }
      }
    }
  }
`;

const { data } = await client.query({ query: GET_FILES });
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { login(input: {username: \"admin\", password: \"admin123\"}) { token user { username } } }"
  }'

# Get files with authentication
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "query { files(first: 5) { edges { node { id filename size } } } }"
  }'
```

## Testing

Use the GraphQL Playground at `http://localhost:8080/` for interactive API testing and exploration.

## API Versioning

Currently using v1 of the API. Future versions will be backward compatible or provide migration paths.