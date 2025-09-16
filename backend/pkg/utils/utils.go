package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedBytes), nil
}

// CheckPassword verifies a password against its hash
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateRandomToken generates a cryptographically secure random token
func GenerateRandomToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// GenerateShareToken generates a secure token for file sharing
func GenerateShareToken() (string, error) {
	return GenerateRandomToken(32) // 64 character hex string
}

// CalculateFileHash calculates SHA-256 hash of a file
func CalculateFileHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// CalculateReaderHash calculates SHA-256 hash from an io.Reader
func CalculateReaderHash(reader io.Reader) (string, error) {
	hasher := sha256.New()
	if _, err := io.Copy(hasher, reader); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// DetectMimeType detects the MIME type of a file from its content
func DetectMimeType(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// Read the first 512 bytes for MIME type detection
	buffer := make([]byte, 512)
	_, err = file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", err
	}

	// Detect MIME type from content
	mimeType := http.DetectContentType(buffer)
	
	// Fall back to extension-based detection if content detection fails
	if mimeType == "application/octet-stream" {
		ext := filepath.Ext(filePath)
		if ext != "" {
			if detectedType := mime.TypeByExtension(ext); detectedType != "" {
				mimeType = detectedType
			}
		}
	}

	return mimeType, nil
}

// DetectMimeTypeFromReader detects MIME type from an io.Reader
func DetectMimeTypeFromReader(reader io.Reader) (string, error) {
	buffer := make([]byte, 512)
	n, err := reader.Read(buffer)
	if err != nil && err != io.EOF {
		return "", err
	}

	return http.DetectContentType(buffer[:n]), nil
}

// ValidateMimeType checks if a MIME type is in the allowed list
func ValidateMimeType(mimeType string, allowedTypes []string) bool {
	for _, allowed := range allowedTypes {
		if mimeType == allowed {
			return true
		}
		// Support wildcard matching (e.g., "image/*")
		if strings.HasSuffix(allowed, "/*") {
			prefix := strings.TrimSuffix(allowed, "/*")
			if strings.HasPrefix(mimeType, prefix+"/") {
				return true
			}
		}
	}
	return false
}

// SanitizeFilename removes potentially dangerous characters from filenames
func SanitizeFilename(filename string) string {
	// Remove path separators and other dangerous characters
	dangerous := []string{"/", "\\", "..", ":", "*", "?", "\"", "<", ">", "|"}
	
	sanitized := filename
	for _, char := range dangerous {
		sanitized = strings.ReplaceAll(sanitized, char, "_")
	}
	
	// Trim whitespace and dots from start/end
	sanitized = strings.Trim(sanitized, " .")
	
	// Ensure filename is not empty
	if sanitized == "" {
		sanitized = "untitled"
	}
	
	return sanitized
}

// GenerateUniqueFilename generates a unique filename to prevent conflicts
func GenerateUniqueFilename(originalName, storageDir string) (string, error) {
	// Sanitize the original filename
	sanitized := SanitizeFilename(originalName)
	
	// Get file extension
	ext := filepath.Ext(sanitized)
	nameWithoutExt := strings.TrimSuffix(sanitized, ext)
	
	// Try the original filename first
	fullPath := filepath.Join(storageDir, sanitized)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return sanitized, nil
	}
	
	// Generate unique filename with counter
	for i := 1; i < 1000; i++ {
		newName := fmt.Sprintf("%s_%d%s", nameWithoutExt, i, ext)
		fullPath := filepath.Join(storageDir, newName)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			return newName, nil
		}
	}
	
	// If we can't find a unique name, use timestamp
	timestamp := fmt.Sprintf("%d", getCurrentTimestamp())
	return fmt.Sprintf("%s_%s%s", nameWithoutExt, timestamp, ext), nil
}

// FormatFileSize formats file size in human-readable format
func FormatFileSize(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}
	
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	
	units := []string{"KB", "MB", "GB", "TB", "PB"}
	return fmt.Sprintf("%.1f %s", float64(size)/float64(div), units[exp])
}

// ParseFileSize parses human-readable file size to bytes
func ParseFileSize(sizeStr string) (int64, error) {
	sizeStr = strings.TrimSpace(strings.ToUpper(sizeStr))
	
	// Extract number and unit
	var number string
	var unit string
	
	for i, char := range sizeStr {
		if char >= '0' && char <= '9' || char == '.' {
			number += string(char)
		} else {
			unit = sizeStr[i:]
			break
		}
	}
	
	if number == "" {
		return 0, fmt.Errorf("invalid size format: %s", sizeStr)
	}
	
	size, err := strconv.ParseFloat(number, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid number in size: %s", number)
	}
	
	// Convert based on unit
	switch unit {
	case "", "B":
		return int64(size), nil
	case "KB":
		return int64(size * 1024), nil
	case "MB":
		return int64(size * 1024 * 1024), nil
	case "GB":
		return int64(size * 1024 * 1024 * 1024), nil
	case "TB":
		return int64(size * 1024 * 1024 * 1024 * 1024), nil
	default:
		return 0, fmt.Errorf("unknown unit: %s", unit)
	}
}

// EnsureDir creates directory if it doesn't exist
func EnsureDir(dirPath string) error {
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		return os.MkdirAll(dirPath, 0755)
	}
	return nil
}

// GetEnv gets environment variable with default value
func GetEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getCurrentTimestamp returns current Unix timestamp
func getCurrentTimestamp() int64 {
	return int64(1000000) // Placeholder for actual timestamp
}

// IsImageFile checks if a file is an image based on MIME type
func IsImageFile(mimeType string) bool {
	return strings.HasPrefix(mimeType, "image/")
}

// IsVideoFile checks if a file is a video based on MIME type
func IsVideoFile(mimeType string) bool {
	return strings.HasPrefix(mimeType, "video/")
}

// IsAudioFile checks if a file is audio based on MIME type
func IsAudioFile(mimeType string) bool {
	return strings.HasPrefix(mimeType, "audio/")
}

// IsPDFFile checks if a file is a PDF
func IsPDFFile(mimeType string) bool {
	return mimeType == "application/pdf"
}

// IsTextFile checks if a file is text-based
func IsTextFile(mimeType string) bool {
	return strings.HasPrefix(mimeType, "text/") || 
		   mimeType == "application/json" ||
		   mimeType == "application/xml"
}

// CalculateDeduplicationSavings calculates storage savings from deduplication
func CalculateDeduplicationSavings(originalSize, actualSize int64) (int64, float64) {
	if originalSize == 0 {
		return 0, 0
	}
	
	saved := originalSize - actualSize
	percentage := float64(saved) / float64(originalSize) * 100
	
	return saved, percentage
}