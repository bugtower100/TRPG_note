package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const automaticBackupSettingsKey = "automatic_backup_settings"

type automaticBackupSettings struct {
	Enabled         bool `json:"enabled"`
	IntervalMinutes int  `json:"intervalMinutes"`
	RetentionDays   int  `json:"retentionDays"`
	MaxBackups      int  `json:"maxBackups"`
}

type automaticBackupFile struct {
	Name      string `json:"name"`
	SizeBytes int64  `json:"sizeBytes"`
	CreatedAt int64  `json:"createdAt"`
}

type automaticBackupStatus struct {
	Settings     automaticBackupSettings `json:"settings"`
	BackupDir    string                  `json:"backupDir"`
	Files        []automaticBackupFile   `json:"files"`
	LastBackupAt *int64                  `json:"lastBackupAt,omitempty"`
	NextBackupAt *int64                  `json:"nextBackupAt,omitempty"`
	LastError    string                  `json:"lastError,omitempty"`
}

type automaticBackupManager struct {
	db        *gorm.DB
	backupDir string
	wake      chan struct{}
	stop      chan struct{}
	mu        sync.Mutex
	errorMu   sync.RWMutex
	lastError string
}

func defaultAutomaticBackupSettings() automaticBackupSettings {
	return automaticBackupSettings{Enabled: true, IntervalMinutes: 60, RetentionDays: 3, MaxBackups: 5}
}

func normalizeAutomaticBackupSettings(settings automaticBackupSettings) (automaticBackupSettings, error) {
	if settings.IntervalMinutes < 1 || settings.IntervalMinutes > 60*24*30 {
		return settings, fmt.Errorf("invalid_interval")
	}
	if settings.RetentionDays < 0 || settings.RetentionDays > 3650 {
		return settings, fmt.Errorf("invalid_retention_days")
	}
	if settings.MaxBackups < 0 || settings.MaxBackups > 1000 {
		return settings, fmt.Errorf("invalid_max_backups")
	}
	if settings.RetentionDays == 0 && settings.MaxBackups == 0 {
		return settings, fmt.Errorf("retention_required")
	}
	return settings, nil
}

func newAutomaticBackupManager(db *gorm.DB, cfg Config) (*automaticBackupManager, error) {
	manager := &automaticBackupManager{
		db:        db,
		backupDir: filepath.Join(filepath.Dir(cfg.DBPath), "automatic_backups"),
		wake:      make(chan struct{}, 1),
		stop:      make(chan struct{}),
	}
	if err := os.MkdirAll(manager.backupDir, 0o755); err != nil {
		return nil, err
	}
	if _, exists, err := getAppMeta(db, automaticBackupSettingsKey); err != nil {
		return nil, err
	} else if !exists {
		if err := manager.saveSettings(defaultAutomaticBackupSettings()); err != nil {
			return nil, err
		}
	}
	return manager, nil
}

func (manager *automaticBackupManager) loadSettings() (automaticBackupSettings, error) {
	raw, exists, err := getAppMeta(manager.db, automaticBackupSettingsKey)
	if err != nil {
		return automaticBackupSettings{}, err
	}
	if !exists {
		return defaultAutomaticBackupSettings(), nil
	}
	var settings automaticBackupSettings
	if err := json.Unmarshal([]byte(raw), &settings); err != nil {
		return automaticBackupSettings{}, err
	}
	return normalizeAutomaticBackupSettings(settings)
}

func (manager *automaticBackupManager) saveSettings(settings automaticBackupSettings) error {
	normalized, err := normalizeAutomaticBackupSettings(settings)
	if err != nil {
		return err
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return err
	}
	return setAppMeta(manager.db, automaticBackupSettingsKey, string(payload))
}

func (manager *automaticBackupManager) listFiles() ([]automaticBackupFile, error) {
	entries, err := os.ReadDir(manager.backupDir)
	if err != nil {
		return nil, err
	}
	files := make([]automaticBackupFile, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), "storage-auto-") || !strings.HasSuffix(entry.Name(), ".db") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		files = append(files, automaticBackupFile{Name: entry.Name(), SizeBytes: info.Size(), CreatedAt: info.ModTime().UnixMilli()})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].CreatedAt > files[j].CreatedAt })
	return files, nil
}

func (manager *automaticBackupManager) prune(settings automaticBackupSettings) error {
	files, err := manager.listFiles()
	if err != nil {
		return err
	}
	cutoff := time.Time{}
	if settings.RetentionDays > 0 {
		cutoff = time.Now().Add(-time.Duration(settings.RetentionDays) * 24 * time.Hour)
	}
	for index, file := range files {
		tooOld := !cutoff.IsZero() && time.UnixMilli(file.CreatedAt).Before(cutoff)
		tooMany := settings.MaxBackups > 0 && index >= settings.MaxBackups
		if !tooOld && !tooMany {
			continue
		}
		target := filepath.Join(manager.backupDir, file.Name)
		if filepath.Dir(target) != filepath.Clean(manager.backupDir) {
			return fmt.Errorf("invalid_backup_path")
		}
		if err := os.Remove(target); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

func (manager *automaticBackupManager) createBackup() (automaticBackupFile, error) {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	stamp := time.Now().Format("20060102-150405.000000000")
	name := "storage-auto-" + stamp + ".db"
	target := filepath.Join(manager.backupDir, name)
	temporaryTarget := target + ".tmp"
	defer func() { _ = os.Remove(temporaryTarget) }()
	sqlDB, err := manager.db.DB()
	if err != nil {
		return automaticBackupFile{}, err
	}
	if _, err := sqlDB.Exec("VACUUM INTO ?", temporaryTarget); err != nil {
		return automaticBackupFile{}, err
	}
	if err := os.Rename(temporaryTarget, target); err != nil {
		return automaticBackupFile{}, err
	}
	info, err := os.Stat(target)
	if err != nil {
		return automaticBackupFile{}, err
	}
	settings, err := manager.loadSettings()
	if err != nil {
		return automaticBackupFile{}, err
	}
	if err := manager.prune(settings); err != nil {
		return automaticBackupFile{}, err
	}
	manager.setLastError("")
	return automaticBackupFile{Name: name, SizeBytes: info.Size(), CreatedAt: info.ModTime().UnixMilli()}, nil
}

func (manager *automaticBackupManager) status() (automaticBackupStatus, error) {
	settings, err := manager.loadSettings()
	if err != nil {
		return automaticBackupStatus{}, err
	}
	files, err := manager.listFiles()
	if err != nil {
		return automaticBackupStatus{}, err
	}
	status := automaticBackupStatus{Settings: settings, BackupDir: manager.backupDir, Files: files, LastError: manager.getLastError()}
	if len(files) > 0 {
		last := files[0].CreatedAt
		status.LastBackupAt = &last
		if settings.Enabled {
			next := last + int64(time.Duration(settings.IntervalMinutes)*time.Minute/time.Millisecond)
			status.NextBackupAt = &next
		}
	} else if settings.Enabled {
		next := time.Now().UnixMilli()
		status.NextBackupAt = &next
	}
	return status, nil
}

func (manager *automaticBackupManager) signalWake() {
	select {
	case manager.wake <- struct{}{}:
	default:
	}
}

func (manager *automaticBackupManager) setLastError(message string) {
	manager.errorMu.Lock()
	manager.lastError = message
	manager.errorMu.Unlock()
}
func (manager *automaticBackupManager) getLastError() string {
	manager.errorMu.RLock()
	defer manager.errorMu.RUnlock()
	return manager.lastError
}

func (manager *automaticBackupManager) start() {
	go func() {
		for {
			status, err := manager.status()
			wait := time.Minute
			if err != nil {
				manager.setLastError(err.Error())
			} else if status.Settings.Enabled {
				due := status.NextBackupAt == nil || *status.NextBackupAt <= time.Now().UnixMilli()
				if due {
					if _, err := manager.createBackup(); err != nil {
						manager.setLastError(err.Error())
					}
					wait = time.Minute
				} else {
					wait = time.Until(time.UnixMilli(*status.NextBackupAt))
					if wait > time.Minute {
						wait = time.Minute
					}
				}
			}
			timer := time.NewTimer(wait)
			select {
			case <-timer.C:
			case <-manager.wake:
				if !timer.Stop() {
					select {
					case <-timer.C:
					default:
					}
				}
			case <-manager.stop:
				if !timer.Stop() {
					select {
					case <-timer.C:
					default:
					}
				}
				return
			}
		}
	}()
}

func (manager *automaticBackupManager) registerRoutes(group *gin.RouterGroup) {
	group.GET("/automatic", func(c *gin.Context) {
		if userID, username := requestUser(c); userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		status, err := manager.status()
		if err != nil {
			c.JSON(500, gin.H{"error": "backup_status_failed"})
			return
		}
		c.JSON(200, status)
	})
	group.PUT("/automatic/settings", func(c *gin.Context) {
		if userID, username := requestUser(c); userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		var settings automaticBackupSettings
		if err := c.ShouldBindJSON(&settings); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		if err := manager.saveSettings(settings); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		if err := manager.prune(settings); err != nil {
			c.JSON(500, gin.H{"error": "backup_prune_failed"})
			return
		}
		manager.signalWake()
		status, err := manager.status()
		if err != nil {
			c.JSON(500, gin.H{"error": "backup_status_failed"})
			return
		}
		c.JSON(200, status)
	})
	group.POST("/automatic/run", func(c *gin.Context) {
		if userID, username := requestUser(c); userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		file, err := manager.createBackup()
		if err != nil {
			manager.setLastError(err.Error())
			c.JSON(500, gin.H{"error": "backup_failed"})
			return
		}
		c.JSON(200, file)
	})
}
