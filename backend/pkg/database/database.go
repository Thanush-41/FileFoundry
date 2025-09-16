package database

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"sort"
	"strings"

	"file-vault-system/backend/internal/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Initialize creates and configures the database connection
func Initialize(cfg *config.Config) (*gorm.DB, error) {
	// Configure GORM logger
	logLevel := logger.Silent
	if cfg.IsDevelopment() {
		logLevel = logger.Info
	}

	// Connect to database
	db, err := gorm.Open(postgres.Open(cfg.GetDatabaseDSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	// Connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	return db, nil
}

// RunMigrations executes SQL migration files in order
func RunMigrations(db *gorm.DB, cfg *config.Config) error {
	// Create migrations tracking table first
	if err := CreateMigrationTable(db); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get the migrations directory path
	migrationsDir := filepath.Join("./migrations")

	// Read migration files
	files, err := ioutil.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	// Filter and sort SQL files
	var sqlFiles []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			sqlFiles = append(sqlFiles, file.Name())
		}
	}
	sort.Strings(sqlFiles)

	// Execute migrations
	for _, filename := range sqlFiles {
		// Check if migration has already been applied
		applied, err := IsMigrationApplied(db, filename)
		if err != nil {
			return fmt.Errorf("failed to check migration status for %s: %w", filename, err)
		}

		if applied {
			fmt.Printf("Migration already applied: %s\n", filename)
			continue
		}

		migrationPath := filepath.Join(migrationsDir, filename)

		content, err := ioutil.ReadFile(migrationPath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", filename, err)
		}

		// Execute the migration
		if err := db.Exec(string(content)).Error; err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", filename, err)
		}

		// Record that migration was applied
		if err := RecordMigration(db, filename); err != nil {
			return fmt.Errorf("failed to record migration %s: %w", filename, err)
		}

		fmt.Printf("Applied migration: %s\n", filename)
	}

	return nil
}

// CreateMigrationTable creates a migrations tracking table
func CreateMigrationTable(db *gorm.DB) error {
	return db.Exec(`
		CREATE TABLE IF NOT EXISTS migrations (
			id SERIAL PRIMARY KEY,
			filename VARCHAR(255) UNIQUE NOT NULL,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)
	`).Error
}

// IsMigrationApplied checks if a migration has been applied
func IsMigrationApplied(db *gorm.DB, filename string) (bool, error) {
	var count int64
	err := db.Table("migrations").Where("filename = ?", filename).Count(&count).Error
	return count > 0, err
}

// RecordMigration records that a migration has been applied
func RecordMigration(db *gorm.DB, filename string) error {
	return db.Exec("INSERT INTO migrations (filename) VALUES (?)", filename).Error
}
