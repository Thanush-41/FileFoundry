package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Base model with common fields
type BaseModel struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	CreatedAt time.Time      `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deletedAt,omitempty" gorm:"index"`
}

// Role represents user roles in the system
type Role struct {
	BaseModel
	Name        string `json:"name" gorm:"unique;not null;size:50"`
	Description string `json:"description" gorm:"type:text"`
}

// UserRoleType represents simple user role types
type UserRoleType string

const (
	RoleUser  UserRoleType = "user"
	RoleAdmin UserRoleType = "admin"
)

// User represents a user in the system
type User struct {
	BaseModel
	Username     string       `json:"username" gorm:"unique;not null;size:100"`
	Email        string       `json:"email" gorm:"unique;not null;size:255"`
	PasswordHash string       `json:"-" gorm:"not null;size:255"`
	FirstName    string       `json:"firstName" gorm:"size:100"`
	LastName     string       `json:"lastName" gorm:"size:100"`
	Role         UserRoleType `json:"role" gorm:"type:varchar(20);default:'user'"`
	StorageQuota int64        `json:"storageQuota" gorm:"default:1073741824"` // 1GB default
	StorageUsed  int64        `json:"storageUsed" gorm:"default:0"`

	// Storage savings tracking for deduplication
	TotalUploadedBytes int64 `json:"totalUploadedBytes" gorm:"default:0"` // Total bytes uploaded by user
	ActualStorageBytes int64 `json:"actualStorageBytes" gorm:"default:0"` // Actual storage used (after deduplication)
	SavedBytes         int64 `json:"savedBytes" gorm:"default:0"`          // Bytes saved through deduplication

	IsActive      bool       `json:"isActive" gorm:"default:true"`
	EmailVerified bool       `json:"emailVerified" gorm:"default:false"`
	LastLogin     *time.Time `json:"lastLogin,omitempty"`

	// Relationships
	Roles         []Role         `json:"roles" gorm:"many2many:user_roles;"`
	Files         []File         `json:"files" gorm:"foreignKey:OwnerID"`
	Folders       []Folder       `json:"folders" gorm:"foreignKey:OwnerID"`
	SharedLinks   []SharedLink   `json:"shared_links" gorm:"foreignKey:SharedBy"`
	DownloadStats []DownloadStat `json:"download_stats" gorm:"foreignKey:DownloadedBy"`
}

// UserRole represents the many-to-many relationship between users and roles
type UserRole struct {
	ID         uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID     uuid.UUID  `json:"user_id" gorm:"type:uuid;not null"`
	RoleID     uuid.UUID  `json:"role_id" gorm:"type:uuid;not null"`
	AssignedAt time.Time  `json:"assigned_at" gorm:"autoCreateTime"`
	AssignedBy *uuid.UUID `json:"assigned_by,omitempty" gorm:"type:uuid"`

	// Relationships
	User User `json:"user" gorm:"foreignKey:UserID"`
	Role Role `json:"role" gorm:"foreignKey:RoleID"`
}

// FileHash stores unique file content for deduplication (original schema)
type FileHash struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	Hash           string    `json:"hash" gorm:"unique;not null;size:64;index"` // SHA-256 hash
	Size           int64     `json:"size" gorm:"not null"`
	StoragePath    string    `json:"storage_path" gorm:"not null;type:text"`
	ReferenceCount int       `json:"reference_count" gorm:"default:0"`
	CreatedAt      time.Time `json:"created_at" gorm:"autoCreateTime"`
}

// Folder represents a folder for organizing files
type Folder struct {
	BaseModel
	Name     string     `json:"name" gorm:"not null;size:255"`
	ParentID *uuid.UUID `json:"parent_id,omitempty" gorm:"type:uuid"`
	OwnerID  uuid.UUID  `json:"owner_id" gorm:"type:uuid;not null"`
	Path     string     `json:"path" gorm:"not null"` // Full path for quick lookups

	// Relationships
	Parent      *Folder      `json:"parent,omitempty" gorm:"foreignKey:ParentID"`
	Children    []Folder     `json:"children" gorm:"foreignKey:ParentID"`
	Owner       User         `json:"owner" gorm:"foreignKey:OwnerID"`
	Files       []File       `json:"files" gorm:"foreignKey:FolderID"`
	SharedLinks []SharedLink `json:"shared_links" gorm:"foreignKey:FolderID"`
}

// File represents a file in the system
type File struct {
	BaseModel
	Filename         string     `json:"filename" gorm:"not null;size:255"`
	OriginalFilename string     `json:"original_filename" gorm:"not null;size:255"`
	MimeType         string     `json:"mime_type" gorm:"not null;size:100"`
	Size             int64      `json:"size" gorm:"not null"`
	FileHashID       uuid.UUID  `json:"file_hash_id" gorm:"type:uuid;not null;index"` // Reference to FileHash
	OwnerID          uuid.UUID  `json:"owner_id" gorm:"type:uuid;not null"`
	FolderID         *uuid.UUID `json:"folder_id,omitempty" gorm:"type:uuid"`
	Tags             []string   `json:"tags" gorm:"type:text[]"`
	Description      string     `json:"description" gorm:"type:text"`
	IsDeleted        bool       `json:"is_deleted" gorm:"default:false"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`

	// Relationships
	FileHash      *FileHash       `json:"file_hash,omitempty" gorm:"foreignKey:FileHashID"`
	Owner         User            `json:"owner" gorm:"foreignKey:OwnerID"`
	Folder        *Folder         `json:"folder,omitempty" gorm:"foreignKey:FolderID"`
	SharedLinks   []SharedLink    `json:"shared_links" gorm:"foreignKey:FileID"`
	UserShares    []UserFileShare `json:"user_shares" gorm:"foreignKey:FileID"`
	DownloadStats []DownloadStat  `json:"download_stats" gorm:"foreignKey:FileID"`
}

// ShareType represents the type of sharing
type ShareType string

const (
	ShareTypePublic   ShareType = "public"
	ShareTypePrivate  ShareType = "private"
	ShareTypePassword ShareType = "password"
)

// SharedLink represents a sharing link for files or folders
type SharedLink struct {
	BaseModel
	Token         string     `json:"token" gorm:"unique;not null;size:255"`
	FileID        *uuid.UUID `json:"file_id,omitempty" gorm:"type:uuid"`
	FolderID      *uuid.UUID `json:"folder_id,omitempty" gorm:"type:uuid"`
	SharedBy      uuid.UUID  `json:"shared_by" gorm:"type:uuid;not null"`
	ShareType     ShareType  `json:"share_type" gorm:"not null;size:20"`
	PasswordHash  string     `json:"-" gorm:"size:255"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	MaxDownloads  *int       `json:"max_downloads,omitempty"`
	DownloadCount int        `json:"download_count" gorm:"default:0"`
	IsActive      bool       `json:"is_active" gorm:"default:true"`

	// Relationships
	File          *File          `json:"file,omitempty" gorm:"foreignKey:FileID"`
	Folder        *Folder        `json:"folder,omitempty" gorm:"foreignKey:FolderID"`
	SharedByUser  User           `json:"shared_by_user" gorm:"foreignKey:SharedBy"`
	DownloadStats []DownloadStat `json:"download_stats" gorm:"foreignKey:SharedLinkID"`
}

// Permission represents access permissions
type Permission string

const (
	PermissionRead  Permission = "read"
	PermissionWrite Permission = "write"
	PermissionAdmin Permission = "admin"
)

// UserFileShare represents direct sharing between users
type UserFileShare struct {
	BaseModel
	FileID     uuid.UUID  `json:"file_id" gorm:"type:uuid;not null"`
	SharedBy   uuid.UUID  `json:"shared_by" gorm:"type:uuid;not null"`
	SharedWith uuid.UUID  `json:"shared_with" gorm:"type:uuid;not null"`
	Permission Permission `json:"permission" gorm:"default:'read';size:20"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`

	// Relationships
	File           File `json:"file" gorm:"foreignKey:FileID"`
	SharedByUser   User `json:"shared_by_user" gorm:"foreignKey:SharedBy"`
	SharedWithUser User `json:"shared_with_user" gorm:"foreignKey:SharedWith"`
}

// DownloadStat tracks file download statistics
type DownloadStat struct {
	ID           uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	FileID       uuid.UUID  `json:"file_id" gorm:"type:uuid;not null"`
	DownloadedBy *uuid.UUID `json:"downloaded_by,omitempty" gorm:"type:uuid"`
	SharedLinkID *uuid.UUID `json:"shared_link_id,omitempty" gorm:"type:uuid"`
	IPAddress    string     `json:"ip_address" gorm:"type:inet"`
	UserAgent    string     `json:"user_agent" gorm:"type:text"`
	DownloadSize int64      `json:"download_size"`
	DownloadedAt time.Time  `json:"downloaded_at" gorm:"autoCreateTime"`

	// Relationships
	File       File        `json:"file" gorm:"foreignKey:FileID"`
	User       *User       `json:"user,omitempty" gorm:"foreignKey:DownloadedBy"`
	SharedLink *SharedLink `json:"shared_link,omitempty" gorm:"foreignKey:SharedLinkID"`
}

// AuditLog tracks system activities for auditing
type AuditLog struct {
	ID           uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID       *uuid.UUID  `json:"user_id,omitempty" gorm:"type:uuid"`
	Action       string      `json:"action" gorm:"not null;size:50"`
	ResourceType string      `json:"resource_type" gorm:"not null;size:50"`
	ResourceID   *uuid.UUID  `json:"resource_id,omitempty" gorm:"type:uuid"`
	OldValues    interface{} `json:"old_values,omitempty" gorm:"type:jsonb"`
	NewValues    interface{} `json:"new_values,omitempty" gorm:"type:jsonb"`
	IPAddress    string      `json:"ip_address" gorm:"type:inet"`
	UserAgent    string      `json:"user_agent" gorm:"type:text"`
	CreatedAt    time.Time   `json:"created_at" gorm:"autoCreateTime"`

	// Relationships
	User *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// APIRateLimit tracks API rate limiting per user
type APIRateLimit struct {
	ID             uuid.UUID     `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID         uuid.UUID     `json:"user_id" gorm:"type:uuid;not null"`
	Endpoint       string        `json:"endpoint" gorm:"not null;size:255"`
	RequestCount   int           `json:"request_count" gorm:"default:0"`
	WindowStart    time.Time     `json:"window_start" gorm:"autoCreateTime"`
	WindowDuration time.Duration `json:"window_duration" gorm:"default:1000000000"` // 1 second in nanoseconds
	MaxRequests    int           `json:"max_requests" gorm:"default:2"`

	// Relationships
	User User `json:"user" gorm:"foreignKey:UserID"`
}
