package main

import (
	"log"
	"net/http"

	"file-vault-system/backend/internal/config"
	"file-vault-system/backend/internal/handlers"
	"file-vault-system/backend/internal/middleware"
	"file-vault-system/backend/internal/services"
	"file-vault-system/backend/pkg/database"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Set Gin to debug mode for detailed logging
	gin.SetMode(gin.DebugMode)

	// Load environment variables - try multiple paths
	envPaths := []string{".env", "../../.env", "../../../.env"}
	for _, path := range envPaths {
		if err := godotenv.Load(path); err == nil {
			log.Printf("Loaded .env from: %s", path)
			break
		}
	}

	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.Initialize(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Run database migrations
	if err := database.RunMigrations(db, cfg); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, cfg)
	fileHandler := handlers.NewFileHandler(db, cfg)
	folderHandler := handlers.NewFolderHandler(db, cfg)
	adminHandler := handlers.NewAdminHandler(db, cfg)

	// Initialize sharing service and handler
	sharingService := services.NewSharingService(db)
	sharingHandler := handlers.NewSharingHandler(sharingService)

	// Set up Gin router
	router := gin.Default()
	router.Use(middleware.CORS())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"version": "1.0.0",
		})
	})

	// API routes
	api := router.Group("/api/v1")
	{
		// Auth routes
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/logout", middleware.AuthMiddleware(), authHandler.Logout)
			auth.GET("/me", middleware.AuthMiddleware(), authHandler.GetMe)
		}

		// Protected file routes
		files := api.Group("/files")
		files.Use(middleware.AuthMiddleware())
		{
			files.POST("/upload", fileHandler.UploadFile)
			files.GET("/", fileHandler.ListFiles)
			files.GET("/stats", fileHandler.GetUserStats)
			files.GET("/:id", fileHandler.GetFile)
			files.GET("/:id/view", fileHandler.ViewFile)
			files.POST("/:id/move", fileHandler.MoveFile)
			files.DELETE("/:id", fileHandler.DeleteFile)

			// File sharing routes
			files.POST("/:id/share", sharingHandler.ShareFileWithUser)
			files.POST("/:id/share-link", sharingHandler.CreateShareLink)
			files.GET("/:id/shares", sharingHandler.GetFileShares)
		}

		// Sharing routes under /api/v1
		api.GET("/shared-files", middleware.AuthMiddleware(), sharingHandler.GetSharedFiles)
		api.GET("/share-links", middleware.AuthMiddleware(), sharingHandler.GetShareLinks)
		api.DELETE("/shares/:id", middleware.AuthMiddleware(), sharingHandler.RevokeFileShare)
		api.DELETE("/share-links/:id", middleware.AuthMiddleware(), sharingHandler.RevokeShareLink)

		// Protected folder routes
		folders := api.Group("/folders")
		folders.Use(middleware.AuthMiddleware())
		{
			folders.POST("/", folderHandler.CreateFolder)
			folders.GET("/", folderHandler.ListFolders)
			folders.GET("/tree", folderHandler.GetFolderTree)
			folders.GET("/:id", folderHandler.GetFolder)
			folders.PUT("/:id", folderHandler.UpdateFolder)
			folders.POST("/:id/move", folderHandler.MoveFolder)
			folders.DELETE("/:id", folderHandler.DeleteFolder)
		}

		// Admin routes
		admin := api.Group("/admin")
		admin.Use(middleware.AuthMiddleware())
		admin.Use(middleware.RequireAdmin())
		{
			admin.GET("/stats", adminHandler.GetStats)
			admin.GET("/users", adminHandler.GetUsers)
		}
	}

	// Public sharing routes (no auth required)
	router.GET("/share/:token", sharingHandler.AccessSharedFile)
	router.GET("/share/:token/download", sharingHandler.DownloadSharedFile)

	log.Printf("Server starting on port %s", cfg.Port)
	log.Fatal(router.Run(":8080"))
}
