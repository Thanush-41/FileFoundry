package utils

import (
	"mime"
	"net/http"
	"path/filepath"
	"strings"
)

// MimeTypeValidator provides MIME type validation functionality
type MimeTypeValidator struct{}

// NewMimeTypeValidator creates a new MIME type validator
func NewMimeTypeValidator() *MimeTypeValidator {
	return &MimeTypeValidator{}
}

// DetectMimeType detects the actual MIME type of file content
func (v *MimeTypeValidator) DetectMimeType(content []byte) string {
	return http.DetectContentType(content)
}

// GetMimeTypeFromExtension gets the MIME type based on file extension
func (v *MimeTypeValidator) GetMimeTypeFromExtension(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		return "application/octet-stream"
	}
	return mimeType
}

// ValidateMimeType validates that the actual content matches the declared MIME type
func (v *MimeTypeValidator) ValidateMimeType(content []byte, declaredMimeType string, filename string) (bool, string, string) {
	// Detect actual MIME type from content
	actualMimeType := v.DetectMimeType(content)

	// Get expected MIME type from file extension
	expectedMimeType := v.GetMimeTypeFromExtension(filename)

	// Define common MIME type mappings and acceptable variations
	mimeTypeGroups := map[string][]string{
		"image": {
			"image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp",
			"image/webp", "image/svg+xml", "image/tiff", "image/x-icon",
		},
		"document": {
			"application/pdf", "application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.ms-excel",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.ms-powerpoint",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
			"text/plain", "text/csv", "text/rtf", "application/json",
			"application/vnd.ms-excel.sheet.macroEnabled.12",
			"application/vnd.ms-excel.template.macroEnabled.12",
		},
		"video": {
			"video/mp4", "video/avi", "video/mov", "video/wmv", "video/flv",
			"video/webm", "video/mkv", "video/m4v",
		},
		"audio": {
			"audio/mp3", "audio/wav", "audio/flac", "audio/aac", "audio/ogg",
			"audio/m4a", "audio/wma", "audio/mpeg",
		},
		"archive": {
			"application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
			"application/x-tar", "application/gzip",
		},
	}

	// Normalize MIME types (remove charset, etc.)
	actualMimeType = strings.Split(actualMimeType, ";")[0]
	declaredMimeType = strings.Split(declaredMimeType, ";")[0]
	expectedMimeType = strings.Split(expectedMimeType, ";")[0]

	// Check if actual content matches expected extension
	if v.isMimeTypeCompatible(actualMimeType, expectedMimeType, mimeTypeGroups) {
		// Check if declared MIME type is also compatible
		if v.isMimeTypeCompatible(declaredMimeType, expectedMimeType, mimeTypeGroups) {
			return true, actualMimeType, ""
		}
		// Declared MIME type doesn't match, but content is valid for extension
		return true, actualMimeType, "Declared MIME type doesn't match file extension, but content is valid"
	}

	// Content doesn't match the file extension - potential security risk
	return false, actualMimeType, "File content doesn't match the file extension - possible file type mismatch or security threat"
}

// isMimeTypeCompatible checks if two MIME types are compatible within the same group
func (v *MimeTypeValidator) isMimeTypeCompatible(mimeType1, mimeType2 string, groups map[string][]string) bool {
	// Exact match
	if mimeType1 == mimeType2 {
		return true
	}

	// Check if both MIME types belong to the same group
	for _, group := range groups {
		type1InGroup := false
		type2InGroup := false

		for _, mt := range group {
			if mt == mimeType1 {
				type1InGroup = true
			}
			if mt == mimeType2 {
				type2InGroup = true
			}
		}

		if type1InGroup && type2InGroup {
			return true
		}
	}

	// Check generic types (e.g., image/* matches image/png)
	type1Parts := strings.Split(mimeType1, "/")
	type2Parts := strings.Split(mimeType2, "/")

	if len(type1Parts) == 2 && len(type2Parts) == 2 {
		// Same primary type (e.g., both are image/*)
		if type1Parts[0] == type2Parts[0] {
			return true
		}
	}

	// Special cases for common mismatches that are acceptable
	acceptableMismatches := map[string][]string{
		"application/octet-stream": {"application/pdf", "application/zip", "image/png", "image/jpeg"},
		"text/plain":               {"text/csv", "application/json", "application/xml"},
	}

	if matches, exists := acceptableMismatches[mimeType1]; exists {
		for _, match := range matches {
			if match == mimeType2 {
				return true
			}
		}
	}

	return false
}

// IsAllowedMimeType checks if a MIME type is in the allowed list
func (v *MimeTypeValidator) IsAllowedMimeType(mimeType string, allowedTypes []string) bool {
	if len(allowedTypes) == 0 {
		return true // No restrictions
	}

	mimeType = strings.Split(mimeType, ";")[0] // Remove charset, etc.

	for _, allowed := range allowedTypes {
		if allowed == mimeType {
			return true
		}
		// Support wildcard matching (e.g., image/*)
		if strings.HasSuffix(allowed, "/*") {
			prefix := strings.TrimSuffix(allowed, "*")
			if strings.HasPrefix(mimeType, prefix) {
				return true
			}
		}
	}

	return false
}
