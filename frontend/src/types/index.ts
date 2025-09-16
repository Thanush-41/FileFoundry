// Common types for GraphQL operations
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  storageQuota: number;
  storageUsed: number;
  roles: string[];
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface File {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  tags: string[];
  description?: string;
  canPreview: boolean;
  folder?: Folder;
  owner?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  parent?: Folder;
  children?: Folder[];
  fileCount?: number;
  createdAt: string;
}

export interface SharedFile {
  id: string;
  file: File;
  sharedWith?: User;
  owner?: User;
  permission: SharePermission;
  expiresAt?: string;
  createdAt: string;
  sharedAt?: string;
}

export interface ShareLink {
  id: string;
  token: string;
  shareType: ShareType;
  file: File;
  expiresAt?: string;
  maxDownloads?: number;
  downloadCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface DownloadStat {
  id: string;
  file: File;
  downloadedBy?: User;
  ipAddress: string;
  userAgent: string;
  downloadedAt: string;
}

export interface AuditLog {
  id: string;
  user?: User;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalFiles: number;
  totalStorage: number;
  storageUsed: number;
  avgFileSize: number;
  topFileTypes: FileTypeStats[];
  recentActivity: ActivityStats[];
}

export interface FileTypeStats {
  mimeType: string;
  count: number;
  totalSize: number;
}

export interface ActivityStats {
  date: string;
  uploads: number;
  downloads: number;
  uniqueUsers: number;
}

// Enums
export enum SharePermission {
  READ = 'READ',
  WRITE = 'WRITE'
}

export enum ShareType {
  DOWNLOAD = 'DOWNLOAD',
  VIEW = 'VIEW'
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

// Input types for mutations
export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface FileUploadInput {
  file: File;
  filename?: string;
  description?: string;
  tags?: string[];
  folderId?: string;
}

export interface UpdateFileInput {
  filename?: string;
  description?: string;
  tags?: string[];
  folderId?: string;
}

export interface CreateFolderInput {
  name: string;
  parentId?: string;
}

export interface CreateShareLinkInput {
  fileId: string;
  shareType: ShareType;
  expiresAt?: string;
  maxDownloads?: number;
}

export interface ShareWithUserInput {
  fileId: string;
  username: string;
  permission: SharePermission;
  expiresAt?: string;
}

// Response types
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface PaginatedFiles {
  files: File[];
  total: number;
  hasMore: boolean;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  hasMore: boolean;
}

export interface PaginatedSharedFiles {
  files: SharedFile[];
  total: number;
  hasMore: boolean;
}

export interface PaginatedAuditLogs {
  activities: AuditLog[];
  total: number;
  hasMore: boolean;
}

// Error types
export interface GraphQLError {
  message: string;
  code?: string;
  path?: string[];
}

// UI state types
export interface FileUploadProgress {
  id: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface SearchFilters {
  search?: string;
  mimeType?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  minSize?: number;
  maxSize?: number;
  folderId?: string;
}

export interface SortOptions {
  field: 'filename' | 'size' | 'createdAt' | 'mimeType';
  direction: 'asc' | 'desc';
}

export interface ViewMode {
  type: 'grid' | 'list';
  itemsPerPage: number;
}