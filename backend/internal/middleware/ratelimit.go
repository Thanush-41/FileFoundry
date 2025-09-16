package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"file-vault-system/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/time/rate"
	"gorm.io/gorm"
)

// RateLimiter stores rate limiters for different users and endpoints
type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	rate     rate.Limit
	burst    int
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(r rate.Limit, b int) *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     r,
		burst:    b,
	}
}

// GetLimiter returns a rate limiter for a specific key
func (rl *RateLimiter) GetLimiter(key string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.limiters[key]
	if !exists {
		limiter = rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[key] = limiter
	}

	return limiter
}

// CleanupOldLimiters removes unused limiters to prevent memory leaks
func (rl *RateLimiter) CleanupOldLimiters() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	for key, limiter := range rl.limiters {
		// Remove limiters that haven't been used in the last hour
		if limiter.Tokens() == float64(rl.burst) {
			delete(rl.limiters, key)
		}
	}
}

// Global rate limiter instance
var globalRateLimiter = NewRateLimiter(2, 5) // 2 requests per second, burst of 5

// Start cleanup routine
func init() {
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			globalRateLimiter.CleanupOldLimiters()
		}
	}()
}

// RateLimit middleware implements rate limiting per user
func RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip rate limiting for health check
		if c.Request.URL.Path == "/health" {
			c.Next()
			return
		}

		// Get user ID from context (if authenticated)
		var userID string
		if uid, exists := c.Get("user_id"); exists {
			if id, ok := uid.(uuid.UUID); ok {
				userID = id.String()
			}
		}

		// Use IP address if no user ID available
		if userID == "" {
			userID = c.ClientIP()
		}

		// Create a unique key for this user and endpoint
		key := fmt.Sprintf("%s:%s", userID, c.Request.URL.Path)

		// Get rate limiter for this key
		limiter := globalRateLimiter.GetLimiter(key)

		// Check if request is allowed
		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"message":     "Too many requests. Please try again later.",
				"retry_after": int(limiter.Reserve().Delay().Seconds()) + 1,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// DatabaseRateLimit middleware uses database to track rate limits
func DatabaseRateLimit(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip rate limiting for health check
		if c.Request.URL.Path == "/health" {
			c.Next()
			return
		}

		// Get user ID from context
		userIDInterface, exists := c.Get("user_id")
		if !exists {
			// For unauthenticated requests, use IP-based rate limiting
			c.Next()
			return
		}

		userID, ok := userIDInterface.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
			c.Abort()
			return
		}

		endpoint := c.Request.URL.Path
		now := time.Now()

		// Check current rate limit status
		var rateLimit models.APIRateLimit
		result := db.Where("user_id = ? AND endpoint = ?", userID, endpoint).First(&rateLimit)

		if result.Error == gorm.ErrRecordNotFound {
			// Create new rate limit record
			rateLimit = models.APIRateLimit{
				UserID:         userID,
				Endpoint:       endpoint,
				RequestCount:   1,
				WindowStart:    now,
				WindowDuration: time.Second,
				MaxRequests:    2,
			}
			db.Create(&rateLimit)
			c.Next()
			return
		} else if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			c.Abort()
			return
		}

		// Check if window has expired
		windowEnd := rateLimit.WindowStart.Add(rateLimit.WindowDuration)
		if now.After(windowEnd) {
			// Reset the window
			rateLimit.RequestCount = 1
			rateLimit.WindowStart = now
			db.Save(&rateLimit)
			c.Next()
			return
		}

		// Check if limit exceeded
		if rateLimit.RequestCount >= rateLimit.MaxRequests {
			retryAfter := int(windowEnd.Sub(now).Seconds()) + 1
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"message":     fmt.Sprintf("Maximum %d requests per %v exceeded", rateLimit.MaxRequests, rateLimit.WindowDuration),
				"retry_after": retryAfter,
			})
			c.Abort()
			return
		}

		// Increment request count
		rateLimit.RequestCount++
		db.Save(&rateLimit)

		c.Next()
	}
}

// StorageQuotaMiddleware checks if user has exceeded storage quota
func StorageQuotaMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only check for file upload endpoints
		if c.Request.Method != "POST" || !contains(c.Request.URL.Path, []string{"/upload", "/files"}) {
			c.Next()
			return
		}

		userIDInterface, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}

		userID, ok := userIDInterface.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
			c.Abort()
			return
		}

		// Get user's current storage usage and quota
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

		// Calculate remaining quota
		remainingQuota := user.StorageQuota - user.StorageUsed
		if remainingQuota <= 0 {
			c.JSON(http.StatusForbidden, gin.H{
				"error":     "Storage quota exceeded",
				"quota":     user.StorageQuota,
				"used":      user.StorageUsed,
				"remaining": 0,
				"message":   "Please delete some files or contact administrator to increase quota",
			})
			c.Abort()
			return
		}

		// Set remaining quota in context for upload handlers
		c.Set("remaining_quota", remainingQuota)
		c.Set("user_quota", user.StorageQuota)
		c.Set("used_quota", user.StorageUsed)

		c.Next()
	}
}

// AdminOnlyMiddleware restricts access to admin users only
func AdminOnlyMiddleware() gin.HandlerFunc {
	return RequireAdmin()
}

// FileUploadSizeLimit middleware checks file size before processing
func FileUploadSizeLimit(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "POST" && c.Request.Header.Get("Content-Type") != "" {
			contentLength := c.Request.ContentLength
			if contentLength > maxSize {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{
					"error":    "File too large",
					"max_size": maxSize,
					"received": contentLength,
				})
				c.Abort()
				return
			}
		}
		c.Next()
	}
}

// contains checks if a string contains any of the provided substrings
func contains(s string, substrings []string) bool {
	for _, substring := range substrings {
		if len(s) >= len(substring) {
			for i := 0; i <= len(s)-len(substring); i++ {
				if s[i:i+len(substring)] == substring {
					return true
				}
			}
		}
	}
	return false
}
