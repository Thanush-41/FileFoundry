import { gql } from '@apollo/client';

// Authentication mutations
export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      expiresAt
      user {
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
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      expiresAt
      user {
        id
        username
        email
        firstName
        lastName
        storageQuota
        storageUsed
        roles
        createdAt
      }
    }
  }
`;

export const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      firstName
      lastName
      email
    }
  }
`;

export const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input)
  }
`;

// File mutations
export const UPLOAD_FILE_MUTATION = gql`
  mutation UploadFile($input: FileUploadInput!) {
    uploadFile(input: $input) {
      id
      filename
      originalFilename
      mimeType
      size
      tags
      description
      canPreview
      createdAt
    }
  }
`;

export const UPDATE_FILE_MUTATION = gql`
  mutation UpdateFile($id: UUID!, $input: UpdateFileInput!) {
    updateFile(id: $id, input: $input) {
      id
      filename
      tags
      description
      folder {
        id
        name
      }
    }
  }
`;

export const DELETE_FILE_MUTATION = gql`
  mutation DeleteFile($id: UUID!) {
    deleteFile(id: $id)
  }
`;

// Folder mutations
export const CREATE_FOLDER_MUTATION = gql`
  mutation CreateFolder($input: CreateFolderInput!) {
    createFolder(input: $input) {
      id
      name
      path
      parent {
        id
        name
      }
      createdAt
    }
  }
`;

export const MOVE_FILE_MUTATION = gql`
  mutation MoveFile($fileId: UUID!, $folderId: UUID) {
    moveFile(fileId: $fileId, folderId: $folderId) {
      id
      filename
      folder {
        id
        name
        path
      }
    }
  }
`;

// Sharing mutations
export const SHARE_FILE_WITH_USER_MUTATION = gql`
  mutation ShareFileWithUser($fileId: UUID!, $input: ShareFileInput!) {
    shareFileWithUser(fileId: $fileId, input: $input) {
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
      }
      sharedBy {
        id
        username
        email
      }
      permission
      message
      expiresAt
      isActive
      createdAt
    }
  }
`;

export const CREATE_SHARE_LINK_MUTATION = gql`
  mutation CreateShareLink($fileId: UUID!, $input: CreateShareLinkInput!) {
    createShareLink(fileId: $fileId, input: $input) {
      id
      shareToken
      file {
        id
        filename
        originalFilename
      }
      permission
      maxDownloads
      downloadCount
      expiresAt
      isActive
      createdAt
    }
  }
`;

export const REVOKE_FILE_SHARE_MUTATION = gql`
  mutation RevokeFileShare($shareId: UUID!) {
    revokeFileShare(shareId: $shareId)
  }
`;

export const REVOKE_SHARE_LINK_MUTATION = gql`
  mutation RevokeShareLink($linkId: UUID!) {
    revokeShareLink(linkId: $linkId)
  }
`;

// Admin mutations
export const UPDATE_USER_QUOTA_MUTATION = gql`
  mutation UpdateUserQuota($userId: UUID!, $quota: Int!) {
    updateUserQuota(userId: $userId, quota: $quota) {
      id
      username
      storageQuota
      storageUsed
    }
  }
`;

export const DEACTIVATE_USER_MUTATION = gql`
  mutation DeactivateUser($userId: UUID!) {
    deactivateUser(userId: $userId) {
      id
      username
      isActive
    }
  }
`;