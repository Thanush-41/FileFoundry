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
  query GetSharedFiles($limit: Int, $offset: Int) {
    sharedFiles(limit: $limit, offset: $offset) {
      files {
        id
        filename
        mimeType
        size
        sharedWith {
          id
          username
          email
        }
        permission
        expiresAt
        createdAt
      }
      total
      hasMore
    }
  }
`;

export const GET_FILES_SHARED_WITH_ME = gql`
  query GetFilesSharedWithMe($limit: Int, $offset: Int) {
    filesSharedWithMe(limit: $limit, offset: $offset) {
      files {
        id
        filename
        mimeType
        size
        owner {
          id
          username
          firstName
          lastName
        }
        permission
        expiresAt
        sharedAt
      }
      total
      hasMore
    }
  }
`;

export const GET_SHARE_LINKS = gql`
  query GetShareLinks($fileId: UUID!) {
    shareLinks(fileId: $fileId) {
      id
      token
      shareType
      expiresAt
      maxDownloads
      downloadCount
      isActive
      createdAt
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