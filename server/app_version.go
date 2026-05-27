package main

import (
	"os"
	"path/filepath"
	"strings"
)

var buildAppVersion string

var appVersion = resolveAppVersion()

func normalizeAppVersion(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "v0.0.0"
	}
	if strings.HasPrefix(trimmed, "v") || strings.HasPrefix(trimmed, "V") {
		return "v" + strings.TrimPrefix(strings.TrimPrefix(trimmed, "v"), "V")
	}
	return "v" + trimmed
}

func resolveAppVersion() string {
	if normalized := normalizeIfPresent(buildAppVersion); normalized != "" {
		return normalized
	}
	if normalized := normalizeIfPresent(os.Getenv("APP_VERSION")); normalized != "" {
		return normalized
	}
	for _, candidate := range appVersionCandidates() {
		content, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}
		if normalized := normalizeIfPresent(string(content)); normalized != "" {
			return normalized
		}
	}
	return normalizeAppVersion("")
}

func normalizeIfPresent(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	return normalizeAppVersion(trimmed)
}

func appVersionCandidates() []string {
	candidates := []string{
		"version.txt",
		filepath.Join("..", "version.txt"),
	}
	executablePath, err := os.Executable()
	if err == nil {
		executableDir := filepath.Dir(executablePath)
		candidates = append(candidates,
			filepath.Join(executableDir, "version.txt"),
			filepath.Join(executableDir, "..", "version.txt"),
			filepath.Join(executableDir, "..", "..", "version.txt"),
		)
	}
	return candidates
}
