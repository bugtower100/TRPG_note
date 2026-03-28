package main

import (
	"flag"
	"fmt"
	"log"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"

	"runtime"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
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

	router := gin.Default()
	webRouter := router.Group("/web")
	router.GET("/", func(c *gin.Context) {
		// 跳转到/web
		c.Redirect(302, "/web")
	})

	api := router.Group("/api/storage")

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
		var item KV
		err := db.First(&item, "key = ?", key).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				item = KV{Key: key, Value: body.Value, Version: 1}
				if err := db.Create(&item).Error; err != nil {
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

	webRouter.GET("/*filepath", func(c *gin.Context) {
		p := c.Param("filepath")
		if p == "" || p == "/" {
			p = "/index.html"
		}
		data, err := webFS.ReadFile("resource" + p)
		if err != nil {
			c.Status(404)
			return
		}
		ctype := mime.TypeByExtension(filepath.Ext(p))
		if ctype == "" {
			ctype = "text/plain; charset=utf-8"
		}
		c.Data(200, ctype, data)
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
