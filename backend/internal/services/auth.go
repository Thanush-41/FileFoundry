package services

import (
	"fmt"
	"time"

	"file-vault-system/backend/internal/middleware"
	"file-vault-system/backend/internal/models"
	"file-vault-system/backend/pkg/utils"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AuthService handles authentication operations
type AuthService struct {
	db *gorm.DB
}

// NewAuthService creates a new AuthService instance
func NewAuthService(db *gorm.DB) *AuthService {
	return &AuthService{db: db}
}

// RegisterRequest represents user registration data
type RegisterRequest struct {
	Username  string `json:"username" binding:"required,min=3,max=50"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
	FirstName string `json:"first_name" binding:"required,min=1,max=50"`
	LastName  string `json:"last_name" binding:"required,min=1,max=50"`
}

// LoginRequest represents user login data
type LoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse represents authentication response
type AuthResponse struct {
	User         *UserResponse `json:"user"`
	Token        string        `json:"token"`
	ExpiresAt    time.Time     `json:"expires_at"`
	RefreshToken string        `json:"refresh_token,omitempty"`
}

// UserResponse represents user data in responses
type UserResponse struct {
	ID            uuid.UUID           `json:"id"`
	Username      string              `json:"username"`
	Email         string              `json:"email"`
	FirstName     string              `json:"first_name"`
	LastName      string              `json:"last_name"`
	Role          models.UserRoleType `json:"role"`
	StorageQuota  int64               `json:"storage_quota"`
	StorageUsed   int64               `json:"storage_used"`
	IsActive      bool                `json:"is_active"`
	EmailVerified bool                `json:"email_verified"`
	Roles         []string            `json:"roles"`
	CreatedAt     time.Time           `json:"created_at"`
	LastLogin     *time.Time          `json:"last_login,omitempty"`
}

// Register creates a new user account
func (s *AuthService) Register(req *RegisterRequest) (*AuthResponse, error) {
	// Prevent registration with admin username
	if req.Username == "admin" {
		return nil, fmt.Errorf("username 'admin' is reserved")
	}

	// Check if username already exists
	var existingUser models.User
	if err := s.db.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
		return nil, fmt.Errorf("username already exists")
	}

	// Check if email already exists
	if err := s.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return nil, fmt.Errorf("email already exists")
	}

	// Hash password
	passwordHash, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: passwordHash,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Role:         models.RoleUser, // All registered users are normal users
		StorageQuota: 10485760,        // 10MB default quota
		IsActive:     true,
	}

	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create user
	if err := tx.Create(user).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Assign default user role
	var userRole models.Role
	if err := tx.Where("name = ?", "user").First(&userRole).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("default user role not found: %w", err)
	}

	userRoleAssignment := &models.UserRole{
		UserID: user.ID,
		RoleID: userRole.ID,
	}

	if err := tx.Create(userRoleAssignment).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to assign user role: %w", err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Generate JWT token
	roles := []string{"user"}
	token, err := middleware.GenerateJWTToken(user, roles)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Convert to response format
	userResponse := &UserResponse{
		ID:            user.ID,
		Username:      user.Username,
		Email:         user.Email,
		FirstName:     user.FirstName,
		LastName:      user.LastName,
		Role:          user.Role,
		StorageQuota:  user.StorageQuota,
		StorageUsed:   user.StorageUsed,
		IsActive:      user.IsActive,
		EmailVerified: user.EmailVerified,
		Roles:         roles,
		CreatedAt:     user.CreatedAt,
		LastLogin:     user.LastLogin,
	}

	return &AuthResponse{
		User:      userResponse,
		Token:     token,
		ExpiresAt: time.Now().Add(24 * time.Hour), // 24 hours
	}, nil
}

// Login authenticates a user and returns a JWT token
func (s *AuthService) Login(req *LoginRequest) (*AuthResponse, error) {
	// Find user by username or email
	var user models.User
	if err := s.db.Where("username = ? OR email = ?", req.Email, req.Email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("invalid credentials")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Check if user is active
	if !user.IsActive {
		return nil, fmt.Errorf("account is deactivated")
	}

	// Special handling for admin user
	if user.Username == "admin" || user.Email == "admin@gmail.com" {
		// For admin user, check if password is "admin" (plain text)
		if req.Password != "admin" {
			return nil, fmt.Errorf("invalid credentials")
		}
		// Ensure admin user has admin role
		if user.Role != models.RoleAdmin {
			user.Role = models.RoleAdmin
			s.db.Save(&user)
		}
	} else {
		// For all other users, use normal password verification
		if !utils.CheckPassword(req.Password, user.PasswordHash) {
			return nil, fmt.Errorf("invalid credentials")
		}
		// Ensure non-admin usernames cannot have admin role
		if user.Role == models.RoleAdmin {
			user.Role = models.RoleUser
			s.db.Save(&user)
		}
	}

	// Get user roles
	var userRoles []models.UserRole
	if err := s.db.Preload("Role").Where("user_id = ?", user.ID).Find(&userRoles).Error; err != nil {
		return nil, fmt.Errorf("failed to load user roles: %w", err)
	}

	roles := make([]string, len(userRoles))
	for i, ur := range userRoles {
		roles[i] = ur.Role.Name
	}

	// Generate JWT token
	token, err := middleware.GenerateJWTToken(&user, roles)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Update last login time
	now := time.Now()
	user.LastLogin = &now
	s.db.Save(&user)

	// Convert to response format
	userResponse := &UserResponse{
		ID:            user.ID,
		Username:      user.Username,
		Email:         user.Email,
		FirstName:     user.FirstName,
		LastName:      user.LastName,
		Role:          user.Role,
		StorageQuota:  user.StorageQuota,
		StorageUsed:   user.StorageUsed,
		IsActive:      user.IsActive,
		EmailVerified: user.EmailVerified,
		Roles:         roles,
		CreatedAt:     user.CreatedAt,
		LastLogin:     user.LastLogin,
	}

	return &AuthResponse{
		User:      userResponse,
		Token:     token,
		ExpiresAt: time.Now().Add(24 * time.Hour), // 24 hours
	}, nil
}

// GetProfile returns user profile information
func (s *AuthService) GetProfile(userID uuid.UUID) (*UserResponse, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Get user roles
	var userRoles []models.UserRole
	if err := s.db.Preload("Role").Where("user_id = ?", user.ID).Find(&userRoles).Error; err != nil {
		return nil, fmt.Errorf("failed to load user roles: %w", err)
	}

	roles := make([]string, len(userRoles))
	for i, ur := range userRoles {
		roles[i] = ur.Role.Name
	}

	return &UserResponse{
		ID:            user.ID,
		Username:      user.Username,
		Email:         user.Email,
		FirstName:     user.FirstName,
		LastName:      user.LastName,
		Role:          user.Role,
		StorageQuota:  user.StorageQuota,
		StorageUsed:   user.StorageUsed,
		IsActive:      user.IsActive,
		EmailVerified: user.EmailVerified,
		Roles:         roles,
		CreatedAt:     user.CreatedAt,
		LastLogin:     user.LastLogin,
	}, nil
}

// UpdateProfile updates user profile information
func (s *AuthService) UpdateProfile(userID uuid.UUID, updates map[string]interface{}) (*UserResponse, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Update allowed fields
	allowedFields := map[string]bool{
		"first_name": true,
		"last_name":  true,
		"email":      true,
	}

	updateData := make(map[string]interface{})
	for key, value := range updates {
		if allowedFields[key] {
			updateData[key] = value
		}
	}

	// Check email uniqueness if email is being updated
	if newEmail, exists := updateData["email"]; exists {
		var existingUser models.User
		if err := s.db.Where("email = ? AND id != ?", newEmail, userID).First(&existingUser).Error; err == nil {
			return nil, fmt.Errorf("email already exists")
		}
	}

	// Update user
	if err := s.db.Model(&user).Updates(updateData).Error; err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	// Return updated profile
	return s.GetProfile(userID)
}

// ChangePassword changes user password
func (s *AuthService) ChangePassword(userID uuid.UUID, currentPassword, newPassword string) error {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Verify current password
	if !utils.CheckPassword(currentPassword, user.PasswordHash) {
		return fmt.Errorf("current password is incorrect")
	}

	// Hash new password
	newPasswordHash, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// Update password
	if err := s.db.Model(&user).Update("password_hash", newPasswordHash).Error; err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

// DeactivateAccount deactivates a user account
func (s *AuthService) DeactivateAccount(userID uuid.UUID) error {
	if err := s.db.Model(&models.User{}).Where("id = ?", userID).Update("is_active", false).Error; err != nil {
		return fmt.Errorf("failed to deactivate account: %w", err)
	}
	return nil
}

// ValidateToken validates a JWT token and returns user information
func (s *AuthService) ValidateToken(tokenString string) (*UserResponse, error) {
	// This would typically be handled by the middleware
	// but can be useful for refresh token validation
	return nil, fmt.Errorf("token validation should be handled by middleware")
}

// RefreshToken generates a new token for a user (bonus feature)
func (s *AuthService) RefreshToken(userID uuid.UUID) (*AuthResponse, error) {
	// Get user and roles
	userResponse, err := s.GetProfile(userID)
	if err != nil {
		return nil, err
	}

	// Generate new token
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	token, err := middleware.GenerateJWTToken(&user, userResponse.Roles)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		User:      userResponse,
		Token:     token,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}, nil
}
