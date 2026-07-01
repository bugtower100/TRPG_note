package main

import (
	"embed"
	"os"
	pathpkg "path"
	"path/filepath"
	"strings"
	"sync"
)

//go:embed resource/**
var webFS embed.FS

var (
	runtimeWebRootOnce sync.Once
	runtimeWebRoot     string
)

func resolveRuntimeWebRoot() string {
	runtimeWebRootOnce.Do(func() {
		candidates := make([]string, 0, 6)
		if cwd, err := os.Getwd(); err == nil {
			candidates = append(candidates,
				filepath.Join(cwd, "resource"),
				filepath.Join(cwd, "..", "dist"),
				filepath.Join(cwd, "..", "server", "resource"),
			)
		}
		if exePath, err := os.Executable(); err == nil {
			exeDir := filepath.Dir(exePath)
			candidates = append(candidates,
				filepath.Join(exeDir, "resource"),
				filepath.Join(exeDir, "..", "dist"),
				filepath.Join(exeDir, "..", "server", "resource"),
			)
		}

		seen := map[string]struct{}{}
		for _, candidate := range candidates {
			cleaned := filepath.Clean(candidate)
			if _, ok := seen[cleaned]; ok {
				continue
			}
			seen[cleaned] = struct{}{}
			info, err := os.Stat(filepath.Join(cleaned, "index.html"))
			if err == nil && !info.IsDir() {
				runtimeWebRoot = cleaned
				return
			}
		}
	})
	return runtimeWebRoot
}

func readRuntimeWebAsset(webPath string) ([]byte, bool) {
	root := resolveRuntimeWebRoot()
	if root == "" {
		return nil, false
	}

	cleaned := pathpkg.Clean("/" + strings.TrimSpace(webPath))
	if cleaned == "/" {
		cleaned = "/index.html"
	}
	relativePath := strings.TrimPrefix(cleaned, "/")
	fullPath := filepath.Join(root, filepath.FromSlash(relativePath))
	cleanRoot := filepath.Clean(root)
	cleanFull := filepath.Clean(fullPath)
	if cleanFull != cleanRoot && !strings.HasPrefix(cleanFull, cleanRoot+string(os.PathSeparator)) {
		return nil, false
	}

	data, err := os.ReadFile(cleanFull)
	if err == nil {
		return data, true
	}
	if ext := filepath.Ext(relativePath); ext == "" || ext == ".html" {
		data, err = os.ReadFile(filepath.Join(root, "index.html"))
		if err == nil {
			return data, true
		}
	}
	return nil, false
}
