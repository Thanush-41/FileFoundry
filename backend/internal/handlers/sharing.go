package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"file-vault-system/backend/internal/models"
	"file-vault-system/backend/internal/services"
)

type SharingHandler struct {
	sharingService *services.SharingService
}

func NewSharingHandler(sharingService *services.SharingService) *SharingHandler {
	return &SharingHandler{
		sharingService: sharingService,
	}
}

// ShareFileWithUser shares a file with another user by email
// POST /api/files/:id/share
func (h *SharingHandler) ShareFileWithUser(c *gin.Context) {
	fileIDStr := c.Param("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	sharedBy, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Email      string  `json:"email" binding:"required,email"`
		Message    string  `json:"message"`
		ExpiresAt  *string `json:"expires_at"`
		Permission string  `json:"permission"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse expiration date if provided
	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		parsed, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expiration date format"})
			return
		}
		expiresAt = &parsed
	}

	// Set default permission
	permission := models.PermissionView
	if req.Permission == "download" {
		permission = models.PermissionDownload
	}

	shareReq := services.ShareFileRequest{
		FileID:     fileID,
		SharedBy:   sharedBy,
		Email:      req.Email,
		Message:    req.Message,
		ExpiresAt:  expiresAt,
		Permission: permission,
	}

	fileShare, err := h.sharingService.ShareFileWithUser(shareReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "File shared successfully",
		"share":   fileShare,
	})
}

// CreateShareLink creates a shareable link for a file
// POST /api/files/:id/share-link
func (h *SharingHandler) CreateShareLink(c *gin.Context) {
	fileIDStr := c.Param("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	createdBy, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Password     string  `json:"password"`
		MaxDownloads *int    `json:"max_downloads"`
		ExpiresAt    *string `json:"expires_at"`
		Permission   string  `json:"permission"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse expiration date if provided
	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		parsed, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expiration date format"})
			return
		}
		expiresAt = &parsed
	}

	// Set default permission
	permission := models.PermissionView
	if req.Permission == "download" {
		permission = models.PermissionDownload
	}

	shareReq := services.CreateShareLinkRequest{
		FileID:       fileID,
		CreatedBy:    createdBy,
		Password:     req.Password,
		MaxDownloads: req.MaxDownloads,
		ExpiresAt:    expiresAt,
		Permission:   permission,
	}

	shareLink, err := h.sharingService.CreateShareLink(shareReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Share link created successfully",
		"share_link": shareLink,
		"url":        "/share/" + shareLink.ShareToken,
	})
}

// GetSharedFiles returns files shared with the current user
// GET /api/shared-files
func (h *SharingHandler) GetSharedFiles(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	fileShares, err := h.sharingService.GetSharedFiles(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"shared_files": fileShares,
	})
}

// GetFileShares returns all shares for a specific file
// GET /api/files/:id/shares
func (h *SharingHandler) GetFileShares(c *gin.Context) {
	fileIDStr := c.Param("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	ownerID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	fileShares, err := h.sharingService.GetFileShares(fileID, ownerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"shares": fileShares,
	})
}

// GetShareLinks returns all share links for the current user's files
// GET /api/share-links
func (h *SharingHandler) GetShareLinks(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	shareLinks, err := h.sharingService.GetShareLinks(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"share_links": shareLinks,
	})
}

// AccessSharedFile handles access to files via share links
// GET /share/:token
func (h *SharingHandler) AccessSharedFile(c *gin.Context) {
	token := c.Param("token")
	password := c.Query("password")

	shareLink, err := h.sharingService.ValidateShareLink(token, password)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Record access
	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")
	h.sharingService.RecordShareLinkAccess(shareLink, ipAddress, userAgent, "view")

	c.JSON(http.StatusOK, gin.H{
		"file":       shareLink.File,
		"permission": shareLink.Permission,
		"share_info": gin.H{
			"created_at":     shareLink.CreatedAt,
			"expires_at":     shareLink.ExpiresAt,
			"download_count": shareLink.DownloadCount,
			"max_downloads":  shareLink.MaxDownloads,
		},
	})
}

// DownloadSharedFile handles downloading files via share links
// GET /share/:token/download
func (h *SharingHandler) DownloadSharedFile(c *gin.Context) {
	token := c.Param("token")
	password := c.Query("password")

	shareLink, err := h.sharingService.ValidateShareLink(token, password)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check download permission
	if shareLink.Permission != models.PermissionDownload {
		c.JSON(http.StatusForbidden, gin.H{"error": "Download not allowed for this share"})
		return
	}

	// Record download
	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")
	h.sharingService.RecordShareLinkAccess(shareLink, ipAddress, userAgent, "download")

	// Get file path from FileHash
	if shareLink.File.FileHash == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "File not found"})
		return
	}

	filePath := shareLink.File.FileHash.StoragePath
	c.Header("Content-Disposition", "attachment; filename=\""+shareLink.File.OriginalFilename+"\"")
	c.Header("Content-Type", shareLink.File.MimeType)
	c.File(filePath)
}

// RevokeFileShare revokes a file share
// DELETE /api/shares/:id
func (h *SharingHandler) RevokeFileShare(c *gin.Context) {
	shareIDStr := c.Param("id")
	shareID, err := uuid.Parse(shareIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid share ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	ownerID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	err = h.sharingService.RevokeFileShare(shareID, ownerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "File share revoked successfully",
	})
}

// RevokeShareLink revokes a share link
// DELETE /api/share-links/:id
func (h *SharingHandler) RevokeShareLink(c *gin.Context) {
	linkIDStr := c.Param("id")
	linkID, err := uuid.Parse(linkIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	ownerID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	err = h.sharingService.RevokeShareLink(linkID, ownerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Share link revoked successfully",
	})
}
