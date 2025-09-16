package handlers

import (
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"file-vault-system/backend/internal/config"
	"file-vault-system/backend/internal/models"
)

type FileHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewFileHandler(db *gorm.DB, cfg *config.Config) *FileHandler {
	return &FileHandler{
		db:  db,
		cfg: cfg,
	}
}

// UploadFile handles file upload
func (h *FileHandler) UploadFile(c *gin.Context) {
	// Get user from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse multipart form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get file from request"})
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > h.cfg.MaxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size exceeds limit"})
		return
	}

	// Check user storage quota
	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	if user.StorageUsed+header.Size > user.StorageQuota {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Storage quota exceeded"})
		return
	}

	// Calculate file hash
	file.Seek(0, 0) // Reset file pointer
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate file hash"})
		return
	}
	fileHash := fmt.Sprintf("%x", hash.Sum(nil))

	// Check if file already exists (deduplication)
	var existingFileHash models.FileHash
	err = h.db.Where("hash = ?", fileHash).First(&existingFileHash).Error

	var fileHashID uuid.UUID
	var storagePath string

	if err == gorm.ErrRecordNotFound {
		// File doesn't exist, create new file hash record and save file
		fileHashID = uuid.New()

		// Create storage directory if it doesn't exist
		if err := os.MkdirAll(h.cfg.StoragePath, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create storage directory"})
			return
		}

		// Generate unique filename for storage
		storagePath = filepath.Join(h.cfg.StoragePath, fileHashID.String())

		// Save file to disk
		file.Seek(0, 0) // Reset file pointer
		dst, err := os.Create(storagePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file"})
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}

		// Create file hash record
		fileHashRecord := models.FileHash{
			BaseModel: models.BaseModel{
				ID: fileHashID,
			},
			Hash:           fileHash,
			Size:           header.Size,
			StoragePath:    storagePath,
			ReferenceCount: 1,
		}

		if err := h.db.Create(&fileHashRecord).Error; err != nil {
			// Clean up file if database insert fails
			os.Remove(storagePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file hash"})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	} else {
		// File already exists, use existing hash record
		fileHashID = existingFileHash.ID
		storagePath = existingFileHash.StoragePath

		// Increment reference count
		if err := h.db.Model(&existingFileHash).Update("reference_count", gorm.Expr("reference_count + 1")).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update reference count"})
			return
		}
	}

	// Create file record
	fileRecord := models.File{
		BaseModel: models.BaseModel{
			ID: uuid.New(),
		},
		Filename:         generateUniqueFilename(header.Filename),
		OriginalFilename: header.Filename,
		MimeType:         header.Header.Get("Content-Type"),
		Size:             header.Size,
		FileHashID:       fileHashID,
		OwnerID:          userID.(uuid.UUID),
	}

	if err := h.db.Create(&fileRecord).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file record"})
		return
	}

	// Update user storage usage (this will be handled by database trigger)

	c.JSON(http.StatusOK, gin.H{
		"message": "File uploaded successfully",
		"file": gin.H{
			"id":               fileRecord.ID,
			"filename":         fileRecord.Filename,
			"originalFilename": fileRecord.OriginalFilename,
			"size":             fileRecord.Size,
			"mimeType":         fileRecord.MimeType,
			"createdAt":        fileRecord.CreatedAt,
		},
	})
}

// ListFiles handles listing user files
func (h *FileHandler) ListFiles(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var files []models.File
	if err := h.db.Where("owner_id = ? AND is_deleted = false", userID).Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get files"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"files": files,
	})
}

// GetFile handles getting a specific file
func (h *FileHandler) GetFile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	fileID := c.Param("id")

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND is_deleted = false", fileID, userID).First(&file).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"file": file,
	})
}

// DeleteFile handles file deletion
func (h *FileHandler) DeleteFile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	fileID := c.Param("id")

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND is_deleted = false", fileID, userID).First(&file).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get file"})
		return
	}

	// Mark file as deleted
	if err := h.db.Model(&file).Updates(map[string]interface{}{
		"is_deleted": true,
		"deleted_at": time.Now(),
		"updated_at": time.Now(),
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	// Decrease reference count (this will be handled by database trigger)

	c.JSON(http.StatusOK, gin.H{
		"message": "File deleted successfully",
	})
}

// Helper function to generate unique filename
func generateUniqueFilename(originalFilename string) string {
	ext := filepath.Ext(originalFilename)
	name := strings.TrimSuffix(originalFilename, ext)
	timestamp := time.Now().Unix()
	return fmt.Sprintf("%s_%d%s", name, timestamp, ext)
}

// UserStats represents user-specific statistics
type UserStats struct {
	TotalFiles     int64   `json:"totalFiles"`
	StorageUsed    int64   `json:"storageUsed"`
	StorageQuota   int64   `json:"storageQuota"`
	FoldersCreated int64   `json:"foldersCreated"`
	FilesShared    int64   `json:"filesShared"`
	RecentUploads  int64   `json:"recentUploads"`  // Files uploaded in last 7 days
	StoragePercent float64 `json:"storagePercent"` // Percentage of quota used
}

// GetUserStats returns statistics for the authenticated user
func (h *FileHandler) GetUserStats(c *gin.Context) {
	// Get user from context
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	uid, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Check if user is admin - if so, return global stats
	role, _ := c.Get("role")
	if userRole, ok := role.(string); ok && userRole == "admin" {
		h.GetGlobalStats(c)
		return
	}

	var stats UserStats

	// Get user info for storage quota
	var user models.User
	if err := h.db.First(&user, uid).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user information"})
		return
	}

	// Get total files for this user
	h.db.Model(&models.File{}).Where("owner_id = ? AND is_deleted = false", uid).Count(&stats.TotalFiles)

	// Get storage used and quota
	stats.StorageUsed = user.StorageUsed
	stats.StorageQuota = user.StorageQuota

	// Calculate storage percentage
	if stats.StorageQuota > 0 {
		stats.StoragePercent = float64(stats.StorageUsed) / float64(stats.StorageQuota) * 100
	}

	// Get folders created by user
	h.db.Model(&models.Folder{}).Where("owner_id = ?", uid).Count(&stats.FoldersCreated)

	// Get shared files count
	h.db.Model(&models.SharedLink{}).Where("shared_by = ?", uid).Count(&stats.FilesShared)

	// Get recent uploads (last 7 days)
	h.db.Model(&models.File{}).Where("owner_id = ? AND created_at > ? AND is_deleted = false", uid, time.Now().AddDate(0, 0, -7)).Count(&stats.RecentUploads)

	c.JSON(http.StatusOK, stats)
}

// GlobalStats represents system-wide statistics (admin only)
type GlobalStats struct {
	TotalUsers         int64 `json:"totalUsers"`
	TotalFiles         int64 `json:"totalFiles"`
	TotalStorage       int64 `json:"totalStorage"`
	ActiveUsers        int64 `json:"activeUsers"`
	FilesUploadedToday int64 `json:"filesUploadedToday"`
	TotalFolders       int64 `json:"totalFolders"`
	TotalSharedLinks   int64 `json:"totalSharedLinks"`
}

// GetGlobalStats returns system-wide statistics (admin only)
func (h *FileHandler) GetGlobalStats(c *gin.Context) {
	var stats GlobalStats

	// Get total users - handle potential errors
	if err := h.db.Model(&models.User{}).Count(&stats.TotalUsers).Error; err != nil {
		stats.TotalUsers = 0
	}

	// Get total files - handle potential errors
	if err := h.db.Model(&models.File{}).Where("is_deleted = false").Count(&stats.TotalFiles).Error; err != nil {
		stats.TotalFiles = 0
	}

	// Get total storage used - handle potential errors
	var totalStorage int64
	if err := h.db.Model(&models.User{}).Select("COALESCE(SUM(storage_used), 0)").Scan(&totalStorage).Error; err == nil {
		stats.TotalStorage = totalStorage
	} else {
		stats.TotalStorage = 0
	}

	// Get active users (users who logged in within last 30 days) - handle potential errors
	if err := h.db.Model(&models.User{}).Where("last_login > ?", time.Now().AddDate(0, 0, -30)).Count(&stats.ActiveUsers).Error; err != nil {
		stats.ActiveUsers = 0
	}

	// Get files uploaded today - handle potential errors
	today := time.Now().Truncate(24 * time.Hour)
	if err := h.db.Model(&models.File{}).Where("created_at >= ? AND is_deleted = false", today).Count(&stats.FilesUploadedToday).Error; err != nil {
		stats.FilesUploadedToday = 0
	}

	// Get total folders - handle potential errors
	if err := h.db.Model(&models.Folder{}).Count(&stats.TotalFolders).Error; err != nil {
		stats.TotalFolders = 0
	}

	// Get total shared links - handle potential errors
	if err := h.db.Model(&models.SharedLink{}).Count(&stats.TotalSharedLinks).Error; err != nil {
		stats.TotalSharedLinks = 0
	}

	c.JSON(http.StatusOK, stats)
}
