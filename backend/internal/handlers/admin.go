package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"file-vault-system/backend/internal/config"
	"file-vault-system/backend/internal/models"
)

type AdminHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAdminHandler(db *gorm.DB, cfg *config.Config) *AdminHandler {
	return &AdminHandler{
		db:  db,
		cfg: cfg,
	}
}

type SystemStats struct {
	TotalUsers           int64   `json:"totalUsers"`
	TotalFiles           int64   `json:"totalFiles"`
	TotalStorage         int64   `json:"totalStorage"`
	ActiveUsers          int64   `json:"activeUsers"`
	FilesUploadedToday   int64   `json:"filesUploadedToday"`
	TotalFolders         int64   `json:"totalFolders"`
	TotalSharedLinks     int64   `json:"totalSharedLinks"`
	TotalUploadedBytes   int64   `json:"totalUploadedBytes"`
	ActualStorageBytes   int64   `json:"actualStorageBytes"`
	GlobalSavedBytes     int64   `json:"globalSavedBytes"`
	GlobalSavingsPercent float64 `json:"globalSavingsPercent"`
}

// GetStats returns system statistics
func (h *AdminHandler) GetStats(c *gin.Context) {
	var stats SystemStats

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
	if err := h.db.Model(&models.ShareLink{}).Count(&stats.TotalSharedLinks).Error; err != nil {
		stats.TotalSharedLinks = 0
	}

	// Get global deduplication statistics
	var totalUploadedBytes, actualStorageBytes, savedBytes int64

	// Sum all users' uploaded bytes
	if err := h.db.Model(&models.User{}).Select("COALESCE(SUM(total_uploaded_bytes), 0)").Scan(&totalUploadedBytes).Error; err == nil {
		stats.TotalUploadedBytes = totalUploadedBytes
	}

	// Sum all users' actual storage bytes
	if err := h.db.Model(&models.User{}).Select("COALESCE(SUM(actual_storage_bytes), 0)").Scan(&actualStorageBytes).Error; err == nil {
		stats.ActualStorageBytes = actualStorageBytes
	}

	// Sum all users' saved bytes
	if err := h.db.Model(&models.User{}).Select("COALESCE(SUM(saved_bytes), 0)").Scan(&savedBytes).Error; err == nil {
		stats.GlobalSavedBytes = savedBytes
	}

	// Calculate global savings percentage
	if stats.TotalUploadedBytes > 0 {
		stats.GlobalSavingsPercent = (float64(stats.GlobalSavedBytes) / float64(stats.TotalUploadedBytes)) * 100
	}

	c.JSON(http.StatusOK, stats)
}

// GetUsers returns a list of users (admin only)
func (h *AdminHandler) GetUsers(c *gin.Context) {
	var users []models.User

	if err := h.db.Select("id, username, email, first_name, last_name, role, storage_quota, storage_used, is_active, email_verified, last_login, created_at").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
	})
}

// GetAllFiles returns a list of all files in the system (admin only)
func (h *AdminHandler) GetAllFiles(c *gin.Context) {
	var files []models.File

	if err := h.db.Preload("Owner", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, email, first_name, last_name")
	}).Where("is_deleted = false").Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get files"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"files": files,
	})
}

// UpdateUserRole updates a user's role (admin only)
func (h *AdminHandler) UpdateUserRole(c *gin.Context) {
	userID := c.Param("id")

	var request struct {
		Role string `json:"role" binding:"required,oneof=user admin"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse user ID
	uid, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Check if user exists and get current info
	var user models.User
	if err := h.db.First(&user, uid).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Don't allow changing the system admin user's role
	if user.Username == "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot modify the system admin user's role"})
		return
	}

	// Update user role
	if err := h.db.Model(&models.User{}).Where("id = ?", uid).Update("role", request.Role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User role updated successfully",
	})
}

// DeleteUser deletes a user account (admin only)
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	userID := c.Param("id")

	// Parse user ID
	uid, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Check if user exists
	var user models.User
	if err := h.db.First(&user, uid).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Don't allow deletion of admin user
	if user.Username == "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete the system admin user"})
		return
	}

	// Don't allow deletion of admin users
	if user.Role == models.RoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete admin users"})
		return
	}

	// Soft delete user
	if err := h.db.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User deleted successfully",
	})
}

// GetSystemHealth returns system health information (admin only)
func (h *AdminHandler) GetSystemHealth(c *gin.Context) {
	health := gin.H{
		"status":    "healthy",
		"timestamp": time.Now(),
		"database":  "connected",
		"uptime":    time.Since(startTime).String(),
	}

	// Check database connection
	if sqlDB, err := h.db.DB(); err != nil {
		health["database"] = "disconnected"
		health["status"] = "degraded"
	} else if err := sqlDB.Ping(); err != nil {
		health["database"] = "error"
		health["status"] = "degraded"
	}

	c.JSON(http.StatusOK, health)
}

var startTime = time.Now()
