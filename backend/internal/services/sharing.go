package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"file-vault-system/backend/internal/models"
)

type SharingService struct {
	db *gorm.DB
}

func NewSharingService(db *gorm.DB) *SharingService {
	return &SharingService{db: db}
}

// ShareFileRequest represents a request to share a file
type ShareFileRequest struct {
	FileID     uuid.UUID              `json:"file_id" binding:"required"`
	SharedBy   uuid.UUID              `json:"shared_by" binding:"required"`
	Email      string                 `json:"email" binding:"required,email"`
	Message    string                 `json:"message"`
	ExpiresAt  *time.Time             `json:"expires_at"`
	Permission models.SharePermission `json:"permission"`
}

// CreateShareLinkRequest represents a request to create a shareable link
type CreateShareLinkRequest struct {
	FileID       uuid.UUID              `json:"file_id" binding:"required"`
	CreatedBy    uuid.UUID              `json:"created_by" binding:"required"`
	Password     string                 `json:"password"`
	MaxDownloads *int                   `json:"max_downloads"`
	ExpiresAt    *time.Time             `json:"expires_at"`
	Permission   models.SharePermission `json:"permission"`
}

// ShareFileWithUser shares a file with another user by email
func (s *SharingService) ShareFileWithUser(req ShareFileRequest) (*models.FileShare, error) {
	// Find the user by email
	var user models.User
	if err := s.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("user with email %s not found", req.Email)
		}
		return nil, fmt.Errorf("error finding user: %w", err)
	}

	// Check if file exists and belongs to the sharer
	var file models.File
	if err := s.db.Where("id = ? AND owner_id = ?", req.FileID, req.SharedBy).First(&file).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("file not found or you don't have permission to share it")
		}
		return nil, fmt.Errorf("error finding file: %w", err)
	}

	// Check if already shared with this user
	var existingShare models.FileShare
	err := s.db.Where("file_id = ? AND shared_by = ? AND shared_with = ?",
		req.FileID, req.SharedBy, user.ID).First(&existingShare).Error

	if err == nil {
		// Update existing share
		existingShare.Permission = req.Permission
		existingShare.Message = req.Message
		existingShare.ExpiresAt = req.ExpiresAt
		existingShare.IsActive = true
		existingShare.UpdatedAt = time.Now()

		if err := s.db.Save(&existingShare).Error; err != nil {
			return nil, fmt.Errorf("error updating existing share: %w", err)
		}
		return &existingShare, nil
	}

	// Create new share
	fileShare := models.FileShare{
		FileID:     req.FileID,
		SharedBy:   req.SharedBy,
		SharedWith: user.ID,
		Permission: req.Permission,
		Message:    req.Message,
		ExpiresAt:  req.ExpiresAt,
		IsActive:   true,
	}

	if err := s.db.Create(&fileShare).Error; err != nil {
		return nil, fmt.Errorf("error creating file share: %w", err)
	}

	return &fileShare, nil
}

// CreateShareLink creates a shareable link for a file
func (s *SharingService) CreateShareLink(req CreateShareLinkRequest) (*models.ShareLink, error) {
	// Check if file exists and belongs to the creator
	var file models.File
	if err := s.db.Where("id = ? AND owner_id = ?", req.FileID, req.CreatedBy).First(&file).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("file not found or you don't have permission to share it")
		}
		return nil, fmt.Errorf("error finding file: %w", err)
	}

	// Generate unique share token
	token, err := s.generateShareToken()
	if err != nil {
		return nil, fmt.Errorf("error generating share token: %w", err)
	}

	// Hash password if provided
	var passwordHash string
	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("error hashing password: %w", err)
		}
		passwordHash = string(hashedPassword)
	}

	// Create share link
	shareLink := models.ShareLink{
		FileID:        req.FileID,
		CreatedBy:     req.CreatedBy,
		ShareToken:    token,
		Permission:    req.Permission,
		PasswordHash:  passwordHash,
		MaxDownloads:  req.MaxDownloads,
		ExpiresAt:     req.ExpiresAt,
		IsActive:      true,
		DownloadCount: 0,
	}

	if err := s.db.Create(&shareLink).Error; err != nil {
		return nil, fmt.Errorf("error creating share link: %w", err)
	}

	return &shareLink, nil
}

// GetSharedFiles returns files shared with a user
func (s *SharingService) GetSharedFiles(userID uuid.UUID) ([]models.FileShare, error) {
	var fileShares []models.FileShare

	err := s.db.Preload("File").Preload("File.FileHash").Preload("SharedByUser").
		Where("shared_with = ? AND is_active = true", userID).
		Where("expires_at IS NULL OR expires_at > ?", time.Now()).
		Find(&fileShares).Error

	if err != nil {
		return nil, fmt.Errorf("error getting shared files: %w", err)
	}

	return fileShares, nil
}

// GetFileShares returns all shares for a specific file
func (s *SharingService) GetFileShares(fileID uuid.UUID, ownerID uuid.UUID) ([]models.FileShare, error) {
	var fileShares []models.FileShare

	err := s.db.Preload("SharedWithUser").
		Where("file_id = ? AND shared_by = ? AND is_active = true", fileID, ownerID).
		Find(&fileShares).Error

	if err != nil {
		return nil, fmt.Errorf("error getting file shares: %w", err)
	}

	return fileShares, nil
}

// GetShareLinks returns all share links for a user's files
func (s *SharingService) GetShareLinks(userID uuid.UUID) ([]models.ShareLink, error) {
	var shareLinks []models.ShareLink

	err := s.db.Preload("File").
		Where("created_by = ? AND is_active = true", userID).
		Find(&shareLinks).Error

	if err != nil {
		return nil, fmt.Errorf("error getting share links: %w", err)
	}

	return shareLinks, nil
}

// ValidateShareLink validates and returns a share link by token
func (s *SharingService) ValidateShareLink(token string, password string) (*models.ShareLink, error) {
	var shareLink models.ShareLink

	err := s.db.Preload("File").Preload("File.FileHash").
		Where("share_token = ? AND is_active = true", token).First(&shareLink).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("share link not found or expired")
		}
		return nil, fmt.Errorf("error finding share link: %w", err)
	}

	// Check if expired
	if shareLink.ExpiresAt != nil && shareLink.ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("share link has expired")
	}

	// Check download limit
	if shareLink.MaxDownloads != nil && shareLink.DownloadCount >= *shareLink.MaxDownloads {
		return nil, fmt.Errorf("share link download limit exceeded")
	}

	// Check password if required
	if shareLink.PasswordHash != "" {
		if password == "" {
			return nil, fmt.Errorf("password required")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(shareLink.PasswordHash), []byte(password)); err != nil {
			return nil, fmt.Errorf("invalid password")
		}
	}

	// Update last accessed time
	shareLink.LastAccessedAt = &[]time.Time{time.Now()}[0]
	s.db.Save(&shareLink)

	return &shareLink, nil
}

// RevokeFileShare revokes a file share
func (s *SharingService) RevokeFileShare(shareID uuid.UUID, ownerID uuid.UUID) error {
	result := s.db.Model(&models.FileShare{}).
		Where("id = ? AND shared_by = ?", shareID, ownerID).
		Update("is_active", false)

	if result.Error != nil {
		return fmt.Errorf("error revoking file share: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("file share not found or you don't have permission to revoke it")
	}

	return nil
}

// RevokeShareLink revokes a share link
func (s *SharingService) RevokeShareLink(linkID uuid.UUID, ownerID uuid.UUID) error {
	result := s.db.Model(&models.ShareLink{}).
		Where("id = ? AND created_by = ?", linkID, ownerID).
		Update("is_active", false)

	if result.Error != nil {
		return fmt.Errorf("error revoking share link: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("share link not found or you don't have permission to revoke it")
	}

	return nil
}

// RecordShareLinkAccess records an access to a share link
func (s *SharingService) RecordShareLinkAccess(shareLink *models.ShareLink, ipAddress, userAgent, action string) error {
	accessLog := models.ShareLinkAccessLog{
		ShareLinkID: shareLink.ID,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
		Action:      action,
		AccessedAt:  time.Now(),
	}

	if err := s.db.Create(&accessLog).Error; err != nil {
		return fmt.Errorf("error recording access log: %w", err)
	}

	// Update download count if action is download
	if action == "download" {
		if err := s.db.Model(shareLink).Update("download_count", gorm.Expr("download_count + 1")).Error; err != nil {
			return fmt.Errorf("error updating download count: %w", err)
		}
	}

	return nil
}

// generateShareToken generates a secure random token for share links
func (s *SharingService) generateShareToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	hash := sha256.Sum256(bytes)
	return hex.EncodeToString(hash[:]), nil
}
