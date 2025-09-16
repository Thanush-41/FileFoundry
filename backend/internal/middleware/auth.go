package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"file-vault-system/backend/internal/models"
	"file-vault-system/backend/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// JWTClaims represents the claims in a JWT token
type JWTClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	Email    string    `json:"email"`
	Role     string    `json:"role"`  // Simple role field
	Roles    []string  `json:"roles"` // Complex roles array (keeping for backward compatibility)
	jwt.RegisteredClaims
}

// AuthMiddleware validates JWT tokens and sets user context
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip auth for health check and public endpoints
		if c.Request.URL.Path == "/health" || c.Request.URL.Path == "/" {
			c.Next()
			return
		}

		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header required",
			})
			c.Abort()
			return
		}

		// Check Bearer prefix
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token format. Use: Bearer <token>",
			})
			c.Abort()
			return
		}

		// Parse and validate token
		claims, err := ValidateJWTToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token: " + err.Error(),
			})
			c.Abort()
			return
		}

		// Set user context
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Set("roles", claims.Roles)

		c.Next()
	}
}

// RequireRole middleware that ensures the user has the required role
func RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user role from context (set by AuthMiddleware)
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User role not found in context",
			})
			c.Abort()
			return
		}

		userRole, ok := role.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid user role format",
			})
			c.Abort()
			return
		}

		// Check if user has required role
		if userRole != requiredRole {
			c.JSON(http.StatusForbidden, gin.H{
				"error": fmt.Sprintf("Access denied. Required role: %s, User role: %s", requiredRole, userRole),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAdmin middleware that ensures the user is an admin
func RequireAdmin() gin.HandlerFunc {
	return RequireRole("admin")
}

// AdminMiddleware validates admin access
func AdminMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// First ensure user is authenticated
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User not authenticated",
			})
			c.Abort()
			return
		}

		// Check user role from context
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User role not found",
			})
			c.Abort()
			return
		}

		userRole, ok := role.(string)
		if !ok || userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Admin access required",
			})
			c.Abort()
			return
		}

		// Verify admin status in database
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User not found",
			})
			c.Abort()
			return
		}

		if user.Role != models.RoleAdmin {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Admin privileges required",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// ValidateJWTToken validates a JWT token and returns claims
func ValidateJWTToken(tokenString string) (*JWTClaims, error) {
	jwtSecret := utils.GetEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")

	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// RefreshJWTToken refreshes a JWT token
func RefreshJWTToken(tokenString string) (string, error) {
	claims, err := ValidateJWTToken(tokenString)
	if err != nil {
		return "", err
	}

	// Check if token is close to expiry (within 1 hour)
	if time.Until(claims.ExpiresAt.Time) > time.Hour {
		return "", fmt.Errorf("token is still valid for more than 1 hour")
	}

	// Create new token with extended expiry
	newClaims := &JWTClaims{
		UserID:   claims.UserID,
		Username: claims.Username,
		Email:    claims.Email,
		Role:     claims.Role,
		Roles:    claims.Roles,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "file-vault-system",
			Subject:   claims.UserID.String(),
		},
	}

	jwtSecret := utils.GetEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, newClaims)
	return token.SignedString([]byte(jwtSecret))
}

// GenerateJWTToken creates a new JWT token for a user
func GenerateJWTToken(user *models.User, roles []string) (string, error) {
	jwtSecret := utils.GetEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
	expirationHours := 24 // Default 24 hours

	if expStr := utils.GetEnv("JWT_EXPIRATION", "24"); expStr != "" {
		if hours, err := strconv.Atoi(expStr); err == nil {
			expirationHours = hours
		}
	}

	claims := &JWTClaims{
		UserID:   user.ID,
		Username: user.Username,
		Email:    user.Email,
		Role:     string(user.Role), // Add simple role
		Roles:    roles,             // Keep complex roles for backward compatibility
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expirationHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "file-vault-system",
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// GetUserFromContext extracts user information from Gin context
func GetUserFromContext(c *gin.Context) (*UserContext, error) {
	userID, exists := c.Get("user_id")
	if !exists {
		return nil, fmt.Errorf("user not found in context")
	}

	uid, ok := userID.(uuid.UUID)
	if !ok {
		return nil, fmt.Errorf("invalid user ID format")
	}

	username, _ := c.Get("username")
	email, _ := c.Get("email")
	role, _ := c.Get("role")
	roles, _ := c.Get("roles")

	return &UserContext{
		ID:       uid,
		Username: username.(string),
		Email:    email.(string),
		Role:     role.(string),
		Roles:    roles.([]string),
	}, nil
}

// UserContext represents authenticated user context
type UserContext struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
	Email    string    `json:"email"`
	Role     string    `json:"role"`
	Roles    []string  `json:"roles"`
}

// HasRole checks if user has a specific role
func (u *UserContext) HasRole(role string) bool {
	for _, r := range u.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// IsAdmin checks if user has admin role
func (u *UserContext) IsAdmin() bool {
	return u.Role == "admin" || u.HasRole("admin")
}
