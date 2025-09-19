import { gql } from '@apollo/client';

// User queries
export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      username
      email
      firstName
      lastName
      storageQuota
      storageUsed
      roles
      isActive
      createdAt
      lastLogin
    }
  }
`;

export const GET_USER_PROFILE = gql`
  query GetUserProfile {
    me {
      id
      username
      email
      firstName
      lastName
      storageQuota
      storageUsed
      createdAt
    }
  }
`;

// File queries
export const GET_FILES = gql`
  query GetFiles($limit: Int, $offset: Int, $search: String, $folderId: UUID) {
    files(limit: $limit, offset: $offset, search: $search, folderId: $folderId) {
      files {
        id
        filename
        originalFilename
        mimeType
        size
        tags
        description
        canPreview
        folder {
          id
          name
          path
        }
        createdAt
        updatedAt
      }
      total
      hasMore
    }
  }
`;

export const GET_FILE_DETAILS = gql`
  query GetFileDetails($id: UUID!) {
    file(id: $id) {
      id
      filename
      originalFilename
      mimeType
      size
      tags
      description
      canPreview
      folder {
        id
        name
        path
      }
      owner {
        id
        username
        firstName
        lastName
      }
      createdAt
      updatedAt
    }
  }
`;

export const SEARCH_FILES = gql`
  query SearchFiles($query: String!, $limit: Int, $offset: Int) {
    searchFiles(query: $query, limit: $limit, offset: $offset) {
      files {
        id
        filename
        originalFilename
        mimeType
        size
        tags
        description
        folder {
          id
          name
          path
        }
        createdAt
      }
      total
      hasMore
    }
  }
`;

// Folder queries
export const GET_FOLDERS = gql`
  query GetFolders($parentId: UUID) {
    folders(parentId: $parentId) {
      id
      name
      path
      parent {
        id
        name
      }
      fileCount
      createdAt
    }
  }
`;

export const GET_FOLDER_TREE = gql`
  query GetFolderTree {
    folderTree {
      id
      name
      path
      children {
        id
        name
        path
        children {
          id
          name
          path
        }
      }
    }
  }
`;

// Sharing queries
export const GET_SHARED_FILES = gql`
  query GetSharedFiles {
    sharedFiles {
      id
      file {
        id
        filename
        originalFilename
        mimeType
        size
        canPreview
        createdAt
      }
      sharedBy {
        id
        username
        email
        firstName
        lastName
      }
      permission
      message
      expiresAt
      createdAt
    }
  }
`;

export const GET_FILE_SHARES = gql`
  query GetFileShares($fileId: UUID!) {
    fileShares(fileId: $fileId) {
      id
      file {
        id
        filename
        originalFilename
      }
      sharedWith {
        id
        username
        email
        firstName
        lastName
      }
      permission
      message
      expiresAt
      isActive
      createdAt
    }
  }
`;

export const GET_SHARE_LINKS = gql`
  query GetShareLinks {
    shareLinks {
      id
      shareToken
      file {
        id
        filename
        originalFilename
        mimeType
        size
      }
      permission
      maxDownloads
      downloadCount
      expiresAt
      isActive
      lastAccessedAt
      createdAt
    }
  }
`;

export const GET_SHARED_FILE_BY_TOKEN = gql`
  query GetSharedFileByToken($token: String!, $password: String) {
    sharedFileByToken(token: $token, password: $password) {
      file {
        id
        filename
        originalFilename
        mimeType
        size
        canPreview
      }
      permission
      shareInfo {
        createdAt
        expiresAt
        downloadCount
        maxDownloads
      }
    }
  }
`;

// Admin queries
export const GET_USERS = gql`
  query GetUsers($limit: Int, $offset: Int, $search: String) {
    users(limit: $limit, offset: $offset, search: $search) {
      users {
        id
        username
        email
        firstName
        lastName
        storageQuota
        storageUsed
        roles
        isActive
        createdAt
        lastLogin
      }
      total
      hasMore
    }
  }
`;

export const GET_SYSTEM_STATS = gql`
  query GetSystemStats {
    systemStats {
      totalUsers
      activeUsers
      totalFiles
      totalStorage
      storageUsed
      avgFileSize
      topFileTypes {
        mimeType
        count
        totalSize
      }
      recentActivity {
        date
        uploads
        downloads
        uniqueUsers
      }
    }
  }
`;

export const GET_USER_ACTIVITY = gql`
  query GetUserActivity($userId: UUID!, $limit: Int, $offset: Int) {
    userActivity(userId: $userId, limit: $limit, offset: $offset) {
      activities {
        id
        action
        resourceType
        resourceId
        details
        ipAddress
        userAgent
        createdAt
      }
      total
      hasMore
    }
  }
`;

export const GET_DOWNLOAD_STATS = gql`
  query GetDownloadStats($fileId: UUID) {
    downloadStats(fileId: $fileId) {
      id
      file {
        id
        filename
      }
      downloadedBy {
        id
        username
      }
      ipAddress
      userAgent
      downloadedAt
    }
  }
`;