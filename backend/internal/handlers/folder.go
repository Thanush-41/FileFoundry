package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"file-vault-system/backend/internal/config"
	"file-vault-system/backend/internal/models"
)

type FolderHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewFolderHandler(db *gorm.DB, cfg *config.Config) *FolderHandler {
	return &FolderHandler{
		db:  db,
		cfg: cfg,
	}
}

// CreateFolder creates a new folder
func (h *FolderHandler) CreateFolder(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req struct {
		Name     string     `json:"name" binding:"required"`
		ParentID *uuid.UUID `json:"parent_id,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input", "details": err.Error()})
		return
	}

	// Validate folder name
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Folder name cannot be empty"})
		return
	}

	// Sanitize folder name (remove invalid characters)
	sanitizedName := sanitizeFolderName(req.Name)
	if sanitizedName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder name"})
		return
	}

	var parentPath string
	var parentFolder *models.Folder

	// If parent ID is provided, validate it exists and user owns it
	if req.ParentID != nil {
		if err := h.db.Where("id = ? AND owner_id = ?", req.ParentID, userID).First(&parentFolder).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Parent folder not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify parent folder"})
			return
		}
		parentPath = parentFolder.Path
	} else {
		parentPath = "/"
	}

	// Build the full path
	var fullPath string
	if parentPath == "/" {
		fullPath = "/" + sanitizedName
	} else {
		fullPath = parentPath + "/" + sanitizedName
	}

	// Check if folder with same name already exists in the same parent
	var existingFolder models.Folder
	err := h.db.Where("name = ? AND parent_id = ? AND owner_id = ?", sanitizedName, req.ParentID, userID).First(&existingFolder).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Folder with this name already exists in the same location"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing folders"})
		return
	}

	// Create the folder
	folder := models.Folder{
		BaseModel: models.BaseModel{
			ID: uuid.New(),
		},
		Name:     sanitizedName,
		ParentID: req.ParentID,
		OwnerID:  userID.(uuid.UUID),
		Path:     fullPath,
	}

	if err := h.db.Create(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create folder"})
		return
	}

	// Load the created folder with relationships
	h.db.Preload("Parent").Preload("Owner").First(&folder, folder.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Folder created successfully",
		"folder":  folder,
	})
}

// ListFolders lists all folders for the authenticated user
func (h *FolderHandler) ListFolders(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	parentID := c.Query("parent_id")
	includeFiles := c.Query("include_files") == "true"

	var folders []models.Folder
	query := h.db.Where("owner_id = ?", userID)

	// Filter by parent folder if specified
	if parentID != "" {
		if parentID == "root" || parentID == "null" {
			query = query.Where("parent_id IS NULL")
		} else {
			parentUUID, err := uuid.Parse(parentID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parent_id format"})
				return
			}
			query = query.Where("parent_id = ?", parentUUID)
		}
	}

	// Load relationships
	query = query.Preload("Parent").Preload("Owner")
	if includeFiles {
		query = query.Preload("Files", "is_deleted = false")
	}

	if err := query.Order("name ASC").Find(&folders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve folders"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"folders": folders,
		"count":   len(folders),
	})
}

// GetFolder gets a specific folder by ID
func (h *FolderHandler) GetFolder(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	folderID := c.Param("id")
	folderUUID, err := uuid.Parse(folderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
		return
	}

	includeFiles := c.Query("include_files") == "true"
	includeChildren := c.Query("include_children") == "true"

	var folder models.Folder
	query := h.db.Where("id = ? AND owner_id = ?", folderUUID, userID)

	// Load relationships
	query = query.Preload("Parent").Preload("Owner")
	if includeFiles {
		query = query.Preload("Files", "is_deleted = false")
	}
	if includeChildren {
		query = query.Preload("Children")
	}

	if err := query.First(&folder).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve folder"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"folder": folder})
}

// UpdateFolder updates a folder's name
func (h *FolderHandler) UpdateFolder(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	folderID := c.Param("id")
	folderUUID, err := uuid.Parse(folderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input", "details": err.Error()})
		return
	}

	// Sanitize folder name
	sanitizedName := sanitizeFolderName(req.Name)
	if sanitizedName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder name"})
		return
	}

	// Get the folder
	var folder models.Folder
	if err := h.db.Where("id = ? AND owner_id = ?", folderUUID, userID).First(&folder).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve folder"})
		return
	}

	// Check if folder with same name already exists in the same parent
	var existingFolder models.Folder
	err = h.db.Where("name = ? AND parent_id = ? AND owner_id = ? AND id != ?", sanitizedName, folder.ParentID, userID, folderUUID).First(&existingFolder).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Folder with this name already exists in the same location"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing folders"})
		return
	}

	// Start transaction to update folder and all children paths
	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Update the folder path
	oldPath := folder.Path
	var newPath string
	if folder.ParentID == nil {
		newPath = "/" + sanitizedName
	} else {
		parentPath := strings.TrimSuffix(oldPath, "/"+folder.Name)
		newPath = parentPath + "/" + sanitizedName
	}

	// Update the folder
	if err := tx.Model(&folder).Updates(map[string]interface{}{
		"name": sanitizedName,
		"path": newPath,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update folder"})
		return
	}

	// Update all children paths recursively
	if err := h.updateChildrenPaths(tx, folderUUID, oldPath, newPath); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update children paths"})
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit changes"})
		return
	}

	// Reload the updated folder
	h.db.Preload("Parent").Preload("Owner").First(&folder, folderUUID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Folder updated successfully",
		"folder":  folder,
	})
}

// MoveFolder moves a folder to a different parent
func (h *FolderHandler) MoveFolder(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	folderID := c.Param("id")
	folderUUID, err := uuid.Parse(folderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
		return
	}

	var req struct {
		ParentID *uuid.UUID `json:"parent_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input", "details": err.Error()})
		return
	}

	// Get the folder to move
	var folder models.Folder
	if err := h.db.Where("id = ? AND owner_id = ?", folderUUID, userID).First(&folder).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve folder"})
		return
	}

	// Validate new parent if provided
	var newParentPath string
	if req.ParentID != nil {
		// Check if trying to move to itself or its own child (circular reference)
		if *req.ParentID == folderUUID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot move folder to itself"})
			return
		}

		// Check if new parent exists and is owned by user
		var parentFolder models.Folder
		if err := h.db.Where("id = ? AND owner_id = ?", req.ParentID, userID).First(&parentFolder).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Target parent folder not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify parent folder"})
			return
		}

		// Check for circular reference (parent is not a child of the folder being moved)
		if strings.HasPrefix(parentFolder.Path, folder.Path+"/") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot move folder to its own child"})
			return
		}

		newParentPath = parentFolder.Path
	} else {
		newParentPath = "/"
	}

	// Check if folder with same name already exists in target location
	var existingFolder models.Folder
	err = h.db.Where("name = ? AND parent_id = ? AND owner_id = ? AND id != ?", folder.Name, req.ParentID, userID, folderUUID).First(&existingFolder).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Folder with this name already exists in the target location"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing folders"})
		return
	}

	// Start transaction
	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Calculate new path
	oldPath := folder.Path
	var newPath string
	if newParentPath == "/" {
		newPath = "/" + folder.Name
	} else {
		newPath = newParentPath + "/" + folder.Name
	}

	// Update the folder
	if err := tx.Model(&folder).Updates(map[string]interface{}{
		"parent_id": req.ParentID,
		"path":      newPath,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to move folder"})
		return
	}

	// Update all children paths recursively
	if err := h.updateChildrenPaths(tx, folderUUID, oldPath, newPath); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update children paths"})
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit changes"})
		return
	}

	// Reload the moved folder
	h.db.Preload("Parent").Preload("Owner").First(&folder, folderUUID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Folder moved successfully",
		"folder":  folder,
	})
}

// DeleteFolder deletes a folder and optionally its contents
func (h *FolderHandler) DeleteFolder(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	folderID := c.Param("id")
	folderUUID, err := uuid.Parse(folderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
		return
	}

	// Check if force delete is requested (deletes all contents)
	forceDelete := c.Query("force") == "true"

	// Get the folder
	var folder models.Folder
	if err := h.db.Where("id = ? AND owner_id = ?", folderUUID, userID).First(&folder).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve folder"})
		return
	}

	// Check if folder has children or files
	var childCount int64
	var fileCount int64
	h.db.Model(&models.Folder{}).Where("parent_id = ?", folderUUID).Count(&childCount)
	h.db.Model(&models.File{}).Where("folder_id = ? AND is_deleted = false", folderUUID).Count(&fileCount)

	if (childCount > 0 || fileCount > 0) && !forceDelete {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":       "Folder is not empty",
			"child_count": childCount,
			"file_count":  fileCount,
			"suggestion":  "Use force=true to delete folder and all its contents",
		})
		return
	}

	// Start transaction
	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if forceDelete {
		// Delete all files in folder and subfolders recursively
		if err := h.deleteAllFolderContents(tx, folderUUID); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete folder contents"})
			return
		}
	}

	// Delete the folder
	if err := tx.Delete(&folder).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete folder"})
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit deletion"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Folder deleted successfully",
	})
}

// GetFolderTree gets the complete folder tree for the user
func (h *FolderHandler) GetFolderTree(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var folders []models.Folder
	if err := h.db.Where("owner_id = ?", userID).Order("path ASC").Find(&folders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve folder tree"})
		return
	}

	// Build tree structure
	tree := buildFolderTree(folders)

	c.JSON(http.StatusOK, gin.H{
		"tree": tree,
	})
}

// Helper functions

func sanitizeFolderName(name string) string {
	// Remove leading/trailing whitespace
	name = strings.TrimSpace(name)

	// Remove invalid characters for folder names
	invalidChars := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|", "\n", "\r", "\t"}
	for _, char := range invalidChars {
		name = strings.ReplaceAll(name, char, "")
	}

	// Limit length
	if len(name) > 255 {
		name = name[:255]
	}

	return name
}

func (h *FolderHandler) updateChildrenPaths(tx *gorm.DB, parentID uuid.UUID, oldParentPath, newParentPath string) error {
	var children []models.Folder
	if err := tx.Where("parent_id = ?", parentID).Find(&children).Error; err != nil {
		return err
	}

	for _, child := range children {
		newChildPath := strings.Replace(child.Path, oldParentPath, newParentPath, 1)
		if err := tx.Model(&child).Update("path", newChildPath).Error; err != nil {
			return err
		}

		// Recursively update grandchildren
		if err := h.updateChildrenPaths(tx, child.ID, child.Path, newChildPath); err != nil {
			return err
		}
	}

	return nil
}

func (h *FolderHandler) deleteAllFolderContents(tx *gorm.DB, folderID uuid.UUID) error {
	// Get all subfolders
	var subfolders []models.Folder
	if err := tx.Where("parent_id = ?", folderID).Find(&subfolders).Error; err != nil {
		return err
	}

	// Recursively delete subfolder contents
	for _, subfolder := range subfolders {
		if err := h.deleteAllFolderContents(tx, subfolder.ID); err != nil {
			return err
		}
	}

	// Mark all files in this folder as deleted
	if err := tx.Model(&models.File{}).Where("folder_id = ?", folderID).Update("is_deleted", true).Error; err != nil {
		return err
	}

	// Delete all subfolders
	if err := tx.Where("parent_id = ?", folderID).Delete(&models.Folder{}).Error; err != nil {
		return err
	}

	return nil
}

type FolderTreeNode struct {
	models.Folder
	Children []FolderTreeNode `json:"children"`
}

func buildFolderTree(folders []models.Folder) []FolderTreeNode {
	folderMap := make(map[uuid.UUID]*FolderTreeNode)
	var roots []FolderTreeNode

	// First pass: create all nodes
	for _, folder := range folders {
		node := FolderTreeNode{
			Folder:   folder,
			Children: []FolderTreeNode{},
		}
		folderMap[folder.ID] = &node
	}

	// Second pass: build relationships
	for _, folder := range folders {
		node := folderMap[folder.ID]
		if folder.ParentID == nil {
			// Root folder
			roots = append(roots, *node)
		} else {
			// Child folder
			if parent, exists := folderMap[*folder.ParentID]; exists {
				parent.Children = append(parent.Children, *node)
			}
		}
	}

	return roots
}
