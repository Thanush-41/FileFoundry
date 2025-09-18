package handlers

import (
	"crypto/sha256"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"file-vault-system/backend/internal/config"
	"file-vault-system/backend/internal/models"
	"file-vault-system/backend/pkg/utils"
)

// FileUploadInfo holds information about a file being uploaded
type FileUploadInfo struct {
	Header   *multipart.FileHeader
	Content  []byte
	Size     int64
	Hash     string
	MimeType string
	IsValid  bool
	Warning  string
}

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

// GetUserStats returns storage statistics for the authenticated user
func (h *FileHandler) GetUserStats(c *gin.Context) {
	// Get user from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get user with storage stats
	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	// Count user's files
	var fileCount int64
	h.db.Model(&models.File{}).Where("owner_id = ? AND is_deleted = false", userID).Count(&fileCount)

	// Calculate storage efficiency
	storageEfficiency := float64(0)
	if user.TotalUploadedBytes > 0 {
		storageEfficiency = (float64(user.SavedBytes) / float64(user.TotalUploadedBytes)) * 100
	}

	// Calculate remaining storage
	remainingStorage := user.StorageQuota - user.StorageUsed
	if remainingStorage < 0 {
		remainingStorage = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"total_uploaded_bytes": user.TotalUploadedBytes,
		"actual_storage_bytes": user.ActualStorageBytes,
		"saved_bytes":          user.SavedBytes,
		"storage_used":         user.StorageUsed,
		"storage_quota":        user.StorageQuota,
		"remaining_storage":    remainingStorage,
		"file_count":           fileCount,
		"storage_efficiency":   storageEfficiency,
	})
}

// UploadFile handles single and multiple file uploads with deduplication and MIME validation
func (h *FileHandler) UploadFile(c *gin.Context) {
	// Get user from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Initialize MIME type validator
	validator := utils.NewMimeTypeValidator()

	// Parse multipart form with max memory (32MB)
	err := c.Request.ParseMultipartForm(32 << 20)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse multipart form"})
		return
	}

	// Check if files were uploaded
	form := c.Request.MultipartForm
	if form == nil || form.File == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files uploaded"})
		return
	}

	// Get files from both 'file' (single) and 'files' (multiple) fields
	var allFiles []*multipart.FileHeader

	// Single file upload (field name: "file")
	if files, exists := form.File["file"]; exists {
		allFiles = append(allFiles, files...)
	}

	// Multiple file upload (field name: "files")
	if files, exists := form.File["files"]; exists {
		allFiles = append(allFiles, files...)
	}

	if len(allFiles) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files found in upload"})
		return
	}

	// Check user storage quota and limits
	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	// Validate each file and calculate total size
	var uploadFiles []FileUploadInfo
	var totalSize int64

	for _, fileHeader := range allFiles {
		// Open file
		file, err := fileHeader.Open()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Failed to open file %s", fileHeader.Filename),
			})
			return
		}

		// Read file content
		content, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to read file %s", fileHeader.Filename),
			})
			return
		}

		fileSize := int64(len(content))

		// Validate file size
		if fileSize > h.cfg.MaxFileSize {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":     fmt.Sprintf("File %s exceeds size limit", fileHeader.Filename),
				"max_size":  h.cfg.MaxFileSize,
				"file_size": fileSize,
			})
			return
		}

		// Validate MIME type
		declaredMimeType := fileHeader.Header.Get("Content-Type")
		if declaredMimeType == "" {
			declaredMimeType = "application/octet-stream"
		}

		isValid, actualMimeType, warning := validator.ValidateMimeType(content, declaredMimeType, fileHeader.Filename)

		if !isValid {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":             fmt.Sprintf("Invalid file type for %s", fileHeader.Filename),
				"filename":          fileHeader.Filename,
				"declared_mimetype": declaredMimeType,
				"actual_mimetype":   actualMimeType,
				"warning":           warning,
			})
			return
		}

		// Check if MIME type is allowed (if configured)
		if len(h.cfg.AllowedMimeTypes) > 0 && !validator.IsAllowedMimeType(actualMimeType, h.cfg.AllowedMimeTypes) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":         fmt.Sprintf("File type not allowed for %s", fileHeader.Filename),
				"filename":      fileHeader.Filename,
				"mimetype":      actualMimeType,
				"allowed_types": h.cfg.AllowedMimeTypes,
			})
			return
		}

		uploadFiles = append(uploadFiles, FileUploadInfo{
			Header:   fileHeader,
			Content:  content,
			Size:     fileSize,
			Hash:     h.calculateContentHash(content),
			MimeType: actualMimeType,
			IsValid:  isValid,
			Warning:  warning,
		})

		totalSize += fileSize
	}

	// Check total storage quota
	if user.StorageUsed+totalSize > user.StorageQuota {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":         "Total upload size exceeds storage quota",
			"total_size":    totalSize,
			"storage_used":  user.StorageUsed,
			"storage_quota": user.StorageQuota,
			"available":     user.StorageQuota - user.StorageUsed,
		})
		return
	}

	// Process each file upload
	var results []map[string]interface{}
	var totalSavedBytes int64
	var totalActualStorage int64
	var totalUploadedBytes int64

	// Start transaction for atomic operation
	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for _, uploadFile := range uploadFiles {
		result, savedBytes, actualStorageUsed, err := h.processFileUpload(tx, uploadFile, userID.(uuid.UUID))
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":    "Failed to process file upload",
				"filename": uploadFile.Header.Filename,
				"details":  err.Error(),
			})
			return
		}

		results = append(results, result)
		totalSavedBytes += savedBytes
		totalActualStorage += actualStorageUsed
		totalUploadedBytes += uploadFile.Size
	}

	// Update user storage statistics
	if err := h.updateUserStorageStats(tx, userID.(uuid.UUID), totalUploadedBytes, totalActualStorage, totalSavedBytes); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user storage stats"})
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit upload transaction"})
		return
	}

	// Return results
	response := gin.H{
		"message":              "Files uploaded successfully",
		"uploaded_files_count": len(results),
		"total_size":           totalUploadedBytes,
		"total_saved_bytes":    totalSavedBytes,
		"files":                results,
	}

	// Add warnings if any
	warnings := []string{}
	for _, uploadFile := range uploadFiles {
		if uploadFile.Warning != "" {
			warnings = append(warnings, fmt.Sprintf("%s: %s", uploadFile.Header.Filename, uploadFile.Warning))
		}
	}
	if len(warnings) > 0 {
		response["warnings"] = warnings
	}

	c.JSON(http.StatusOK, response)
}

// processFileUpload handles the upload of a single file within a transaction
func (h *FileHandler) processFileUpload(tx *gorm.DB, uploadFile FileUploadInfo, userID uuid.UUID) (map[string]interface{}, int64, int64, error) {
	// Check if file hash already exists (deduplication)
	var existingHash models.FileHash
	isNewContent := false
	err := tx.Where("hash = ?", uploadFile.Hash).First(&existingHash).Error

	if err == gorm.ErrRecordNotFound {
		// Content doesn't exist, create new hash record
		isNewContent = true

		// Store file physically only if it's new content
		storagePath := fmt.Sprintf("storage/%s", uploadFile.Hash)

		newHash := models.FileHash{
			ID:             uuid.New(),
			Hash:           uploadFile.Hash,
			Size:           uploadFile.Size,
			StoragePath:    storagePath,
			ReferenceCount: 1,
		}

		if err := tx.Create(&newHash).Error; err != nil {
			return nil, 0, 0, fmt.Errorf("failed to save file hash: %v", err)
		}
		existingHash = newHash
	} else if err != nil {
		return nil, 0, 0, fmt.Errorf("database error: %v", err)
	} else {
		// Content already exists, increment reference count
		if err := tx.Model(&existingHash).Update("reference_count", gorm.Expr("reference_count + 1")).Error; err != nil {
			return nil, 0, 0, fmt.Errorf("failed to update reference count: %v", err)
		}
	}

	// Create file record
	fileRecord := models.File{
		BaseModel: models.BaseModel{
			ID: uuid.New(),
		},
		Filename:         generateUniqueFilename(uploadFile.Header.Filename),
		OriginalFilename: uploadFile.Header.Filename,
		MimeType:         uploadFile.MimeType,
		Size:             uploadFile.Size,
		FileHashID:       existingHash.ID,
		OwnerID:          userID,
	}

	if err := tx.Create(&fileRecord).Error; err != nil {
		// If file record creation fails and this was new content, decrement reference count
		if isNewContent {
			tx.Model(&models.FileHash{}).Where("hash = ?", uploadFile.Hash).Update("reference_count", gorm.Expr("reference_count - 1"))
		}
		return nil, 0, 0, fmt.Errorf("failed to create file record: %v", err)
	}

	// Calculate savings and storage
	savedBytes := int64(0)
	actualStorageUsed := int64(0)

	if !isNewContent {
		savedBytes = uploadFile.Size // User saved the full file size due to deduplication
	} else {
		actualStorageUsed = uploadFile.Size // New storage used
	}

	result := map[string]interface{}{
		"file_id":       fileRecord.ID,
		"filename":      fileRecord.Filename,
		"original_name": fileRecord.OriginalFilename,
		"size":          fileRecord.Size,
		"mime_type":     fileRecord.MimeType,
		"content_hash":  uploadFile.Hash,
		"is_duplicate":  !isNewContent,
		"saved_bytes":   savedBytes,
	}

	if uploadFile.Warning != "" {
		result["warning"] = uploadFile.Warning
	}

	return result, savedBytes, actualStorageUsed, nil
}

// updateUserStorageStats updates user storage statistics within a transaction
func (h *FileHandler) updateUserStorageStats(tx *gorm.DB, userID uuid.UUID, totalUploadedBytes, totalActualStorage, totalSavedBytes int64) error {
	var user models.User
	if err := tx.First(&user, userID).Error; err != nil {
		return fmt.Errorf("failed to find user: %v", err)
	}

	// Update user storage statistics
	user.TotalUploadedBytes += totalUploadedBytes
	user.ActualStorageBytes += totalActualStorage
	user.StorageUsed += totalActualStorage
	user.SavedBytes += totalSavedBytes

	if err := tx.Save(&user).Error; err != nil {
		return fmt.Errorf("failed to update user storage stats: %v", err)
	}

	return nil
}

// calculateContentHash calculates SHA-256 hash of file content
func (h *FileHandler) calculateContentHash(data []byte) string {
	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash[:])
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

// DeleteFile handles file deletion with deduplication cleanup
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

	// Start transaction for consistent deduplication cleanup
	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Mark file as deleted
	if err := tx.Model(&file).Updates(map[string]interface{}{
		"is_deleted": true,
		"deleted_at": time.Now(),
		"updated_at": time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	// Decrease reference count for the file hash
	var fileHash models.FileHash
	if err := tx.Where("id = ?", file.FileHashID).First(&fileHash).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find file hash"})
		return
	}

	// Decrement reference count
	newRefCount := fileHash.ReferenceCount - 1
	if err := tx.Model(&fileHash).Update("reference_count", newRefCount).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update reference count"})
		return
	}

	// If no more references, delete the hash record
	actualStorageFreed := int64(0)
	if newRefCount <= 0 {
		if err := tx.Delete(&fileHash).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file hash"})
			return
		}
		actualStorageFreed = file.Size
	}

	// Update user storage statistics
	var user models.User
	if err := tx.First(&user, "id = ?", userID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	updates := map[string]interface{}{
		"storage_used":         gorm.Expr("storage_used - ?", file.Size),
		"actual_storage_bytes": gorm.Expr("actual_storage_bytes - ?", actualStorageFreed),
	}

	if err := tx.Model(&user).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user storage stats"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":               "File deleted successfully",
		"actual_storage_freed":  actualStorageFreed,
		"logical_storage_freed": file.Size,
	})
}

// GetStorageSavings returns storage savings information for a user
func (h *FileHandler) GetStorageSavings(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	savingsPercent := float64(0)
	if user.TotalUploadedBytes > 0 {
		savingsPercent = (float64(user.SavedBytes) / float64(user.TotalUploadedBytes)) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"total_uploaded_bytes": user.TotalUploadedBytes,
		"actual_storage_bytes": user.ActualStorageBytes,
		"saved_bytes":          user.SavedBytes,
		"savings_percent":      savingsPercent,
	})
}

// Helper function to generate unique filename
func generateUniqueFilename(originalFilename string) string {
	ext := filepath.Ext(originalFilename)
	name := strings.TrimSuffix(originalFilename, ext)
	timestamp := time.Now().Unix()
	return fmt.Sprintf("%s_%d%s", name, timestamp, ext)
}
