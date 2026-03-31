package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"mime"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode"

	"runtime"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/spf13/viper"
	"gorm.io/gorm"
)

type Config struct {
	Port   int    `mapstructure:"port"`
	DBPath string `mapstructure:"db_path"`
}

type KV struct {
	Key       string `gorm:"primaryKey;size:255"`
	Value     string `gorm:"type:text"`
	Version   int    `gorm:"not null;default:1"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func loadConfig() Config {
	viper.SetDefault("port", 8080)
	viper.SetDefault("db_path", "data/storage.db")
	viper.SetEnvPrefix("BTR")
	viper.AutomaticEnv()
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("server")
	_ = viper.ReadInConfig()

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("failed to unmarshal config: %v", err)
	}
	return cfg
}

func ensureDir(path string) {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Fatalf("failed to create dir %s: %v", dir, err)
	}
}

func openDB(cfg Config) *gorm.DB {
	ensureDir(cfg.DBPath)
	db, err := gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	if err := db.AutoMigrate(&KV{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}
	return db
}

func normalizeResourceRef(ref string) (string, bool) {
	p := strings.TrimSpace(ref)
	p = strings.TrimPrefix(p, "/")
	if p == "" {
		return "", false
	}
	if strings.Contains(p, "..") {
		return "", false
	}
	if !strings.HasPrefix(p, "graph_assets/") {
		p = "graph_assets/" + p
	}
	if strings.Contains(p, "..") {
		return "", false
	}
	return p, true
}

func sanitizeFilenameBase(name string) string {
	base := strings.TrimSpace(name)
	base = strings.TrimSuffix(base, filepath.Ext(base))
	if base == "" {
		return "image"
	}
	var b strings.Builder
	lastUnderscore := false
	for _, r := range base {
		if r < 32 || strings.ContainsRune(`<>:"/\|?*`, r) {
			if !lastUnderscore {
				b.WriteRune('_')
				lastUnderscore = true
			}
			continue
		}
		if unicode.IsSpace(r) {
			if !lastUnderscore {
				b.WriteRune('_')
				lastUnderscore = true
			}
			continue
		}
		b.WriteRune(r)
		lastUnderscore = false
	}
	out := strings.Trim(b.String(), "._")
	if out == "" {
		return "image"
	}
	return out
}

func parseDisplayNameFromStored(filename string) string {
	ext := filepath.Ext(filename)
	stem := strings.TrimSuffix(filename, ext)
	if idx := strings.Index(stem, "__"); idx >= 0 && idx+2 < len(stem) {
		name := strings.TrimSpace(stem[idx+2:])
		name = strings.ReplaceAll(name, "_", " ")
		if name != "" {
			return name
		}
	}
	return stem
}

func main() {
	// flags
	showConsole := flag.Bool("show-console", false, "Windows上显示控制台界面")
	hideUI := flag.Bool("hide-ui", false, "启动时不弹出UI")
	// multi-instance flag is ignored to enforce single instance
	_ = flag.Bool("multi-instance", false, "允许在Windows上运行多个实例（已禁用）")
	_ = flag.Bool("m", false, "multi-instance 的短旗（已禁用）")
	flag.Parse()

	cfg := loadConfig()
	db := openDB(cfg)
	assetDir := filepath.Join(filepath.Dir(cfg.DBPath), "graph_assets")
	if err := os.MkdirAll(assetDir, 0o755); err != nil {
		log.Fatalf("failed to create graph asset dir: %v", err)
	}

	router := gin.Default()
	webRouter := router.Group("/web")
	router.GET("/", func(c *gin.Context) {
		// 跳转到/web
		c.Redirect(302, "/web")
	})

	api := router.Group("/api/storage")
	resourceAPI := router.Group("/api/resources")

	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	allowedKey := func(k string) bool {
		return strings.HasPrefix(k, "trpg_u_")
	}

	api.GET("/all", func(c *gin.Context) {
		var items []KV
		prefix := c.Query("prefix")
		if prefix == "" {
			c.JSON(400, gin.H{"error": "prefix_required"})
			return
		}
		var err error
		err = db.Where("key LIKE ?", prefix+"%").Find(&items).Error
		if err != nil {
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		result := make(map[string]string, len(items))
		for _, it := range items {
			result[it.Key] = it.Value
		}
		c.JSON(200, result)
	})

	type putBody struct {
		Value           string `json:"value" binding:"required"`
		ExpectedVersion *int   `json:"expectedVersion,omitempty"`
	}

	api.GET("/:key", func(c *gin.Context) {
		key := c.Param("key")
		if !allowedKey(key) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		var item KV
		if err := db.First(&item, "key = ?", key).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		c.JSON(200, gin.H{
			"key":       item.Key,
			"value":     item.Value,
			"version":   item.Version,
			"updatedAt": item.UpdatedAt.UnixMilli(),
		})
	})

	api.PUT("/:key", func(c *gin.Context) {
		key := c.Param("key")
		if !allowedKey(key) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		var body putBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid payload"})
			return
		}
	retryLoad:
		var item KV
		err := db.First(&item, "key = ?", key).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				item = KV{Key: key, Value: body.Value, Version: 1}
				if err := db.Create(&item).Error; err != nil {
					if strings.Contains(strings.ToLower(err.Error()), "unique constraint failed") {
						goto retryLoad
					}
					c.JSON(500, gin.H{"error": "database error"})
					return
				}
				c.JSON(200, gin.H{"key": key, "value": body.Value, "version": item.Version, "updatedAt": item.UpdatedAt.UnixMilli()})
				return
			}
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		if body.ExpectedVersion != nil && *body.ExpectedVersion != item.Version {
			c.JSON(409, gin.H{
				"error":     "version_conflict",
				"key":       item.Key,
				"version":   item.Version,
				"updatedAt": item.UpdatedAt.UnixMilli(),
			})
			return
		}
		item.Value = body.Value
		item.Version = item.Version + 1
		if err := db.Save(&item).Error; err != nil {
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		c.JSON(200, gin.H{"key": key, "value": body.Value, "version": item.Version, "updatedAt": item.UpdatedAt.UnixMilli()})
	})

	api.DELETE("/:key", func(c *gin.Context) {
		key := c.Param("key")
		if !allowedKey(key) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		if err := db.Delete(&KV{}, "key = ?", key).Error; err != nil {
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		c.Status(204)
	})

	api.GET("/meta", func(c *gin.Context) {
		var items []KV
		prefix := c.Query("prefix")
		if prefix == "" {
			c.JSON(400, gin.H{"error": "prefix_required"})
			return
		}
		err := db.Select("key", "version", "updated_at").Where("key LIKE ?", prefix+"%").Find(&items).Error
		if err != nil {
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		meta := make(map[string]gin.H, len(items))
		for _, it := range items {
			meta[it.Key] = gin.H{
				"version":   it.Version,
				"updatedAt": it.UpdatedAt.UnixMilli(),
			}
		}
		c.JSON(200, meta)
	})

	resourceAPI.POST("/upload", func(c *gin.Context) {
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(400, gin.H{"error": "file_required"})
			return
		}
		defer file.Close()
		ext := strings.ToLower(filepath.Ext(header.Filename))
		switch ext {
		case ".png", ".jpg", ".jpeg", ".webp":
		default:
			c.JSON(400, gin.H{"error": "unsupported_file_type"})
			return
		}
		id := uuid.New().String()
		displayBase := sanitizeFilenameBase(header.Filename)
		filename := id + "__" + displayBase + ext
		dstPath := filepath.Join(assetDir, filename)
		dst, err := os.Create(dstPath)
		if err != nil {
			c.JSON(500, gin.H{"error": "create_file_failed"})
			return
		}
		defer dst.Close()
		if _, err := io.Copy(dst, file); err != nil {
			c.JSON(500, gin.H{"error": "write_file_failed"})
			return
		}
		ref := "graph_assets/" + filename
		c.JSON(200, gin.H{
			"ref": ref,
			"url": "/api/resources/file/" + ref,
		})
	})

	resourceAPI.GET("/list", func(c *gin.Context) {
		entries, err := os.ReadDir(assetDir)
		if err != nil {
			c.JSON(500, gin.H{"error": "read_dir_failed"})
			return
		}
		items := make([]gin.H, 0, len(entries))
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			name := entry.Name()
			ext := strings.ToLower(filepath.Ext(name))
			switch ext {
			case ".png", ".jpg", ".jpeg", ".webp":
			default:
				continue
			}
			info, err := entry.Info()
			if err != nil {
				continue
			}
			ref := "graph_assets/" + name
			displayName := parseDisplayNameFromStored(name)
			items = append(items, gin.H{
				"ref":         ref,
				"url":         "/api/resources/file/" + ref,
				"displayName": displayName,
				"size":        info.Size(),
				"updatedAt":   info.ModTime().UnixMilli(),
			})
		}
		sort.Slice(items, func(i, j int) bool {
			return items[i]["updatedAt"].(int64) > items[j]["updatedAt"].(int64)
		})
		c.JSON(200, gin.H{"items": items})
	})

	resourceAPI.DELETE("/file/*filepath", func(c *gin.Context) {
		raw := strings.TrimPrefix(c.Param("filepath"), "/")
		ref, ok := normalizeResourceRef(raw)
		if !ok {
			c.JSON(400, gin.H{"error": "invalid_ref"})
			return
		}
		full := filepath.Join(filepath.Dir(cfg.DBPath), ref)
		if !strings.HasPrefix(filepath.Clean(full), filepath.Clean(filepath.Dir(cfg.DBPath))) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		if err := os.Remove(full); err != nil {
			if os.IsNotExist(err) {
				c.Status(204)
				return
			}
			c.JSON(500, gin.H{"error": "delete_failed"})
			return
		}
		c.Status(204)
	})

	resourceAPI.POST("/delete-batch", func(c *gin.Context) {
		var body struct {
			Refs []string `json:"refs"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || len(body.Refs) == 0 {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		failed := make([]string, 0)
		for _, raw := range body.Refs {
			ref, ok := normalizeResourceRef(raw)
			if !ok {
				failed = append(failed, raw)
				continue
			}
			full := filepath.Join(filepath.Dir(cfg.DBPath), ref)
			if !strings.HasPrefix(filepath.Clean(full), filepath.Clean(filepath.Dir(cfg.DBPath))) {
				failed = append(failed, raw)
				continue
			}
			if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
				failed = append(failed, raw)
			}
		}
		if len(failed) > 0 {
			c.JSON(207, gin.H{"failed": failed})
			return
		}
		c.Status(204)
	})

	resourceAPI.GET("/file/*filepath", func(c *gin.Context) {
		raw := strings.TrimPrefix(c.Param("filepath"), "/")
		p, ok := normalizeResourceRef(raw)
		if !ok {
			c.Status(404)
			return
		}
		full := filepath.Join(filepath.Dir(cfg.DBPath), p)
		if !strings.HasPrefix(filepath.Clean(full), filepath.Clean(filepath.Dir(cfg.DBPath))) {
			c.Status(403)
			return
		}
		if _, err := os.Stat(full); err != nil {
			c.Status(404)
			return
		}
		c.Header("Cache-Control", "public, max-age=31536000")
		c.File(full)
	})

	serveWeb := func(c *gin.Context, p string) {
		if p == "" || p == "/" {
			p = "/index.html"
		}
		data, err := webFS.ReadFile("resource" + p)
		if err != nil {
			ext := filepath.Ext(p)
			if ext == "" || ext == ".html" {
				indexData, indexErr := webFS.ReadFile("resource/index.html")
				if indexErr != nil {
					c.Status(404)
					return
				}
				c.Data(200, "text/html; charset=utf-8", indexData)
				return
			}
			c.Status(404)
			return
		}
		ctype := mime.TypeByExtension(filepath.Ext(p))
		if ctype == "" {
			ctype = "text/plain; charset=utf-8"
		}
		c.Data(200, ctype, data)
	}

	webRouter.GET("/*filepath", func(c *gin.Context) {
		serveWeb(c, c.Param("filepath"))
	})

	router.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		if strings.HasPrefix(p, "/api/") {
			c.Status(404)
			return
		}
		if strings.HasPrefix(p, "/web/") {
			serveWeb(c, strings.TrimPrefix(p, "/web"))
			return
		}
		serveWeb(c, p)
	})
	// enforce single instance and console visibility on Windows
	if runtime.GOOS == "windows" {
		if *showConsole {
			showWindow()
		} else {
			hideWindow()
		}
		if TestRunning() {
			return
		}
	}
	// 启动 HTTP 服务（后台），再在主线程启动托盘
	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
	go httpServe(router, addr, *hideUI)
	trayInit()
}
