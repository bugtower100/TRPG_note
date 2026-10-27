//go:build windows && !headless

package main

import "testing"

func TestStartupLocation(t *testing.T) {
	tests := []struct {
		name, executableDir, want string
	}{
		{"desktop root", `C:\Users\Player\Desktop`, "桌面"},
		{"downloads root", `C:\Users\Player\Downloads`, "下载文件夹"},
		{"desktop subfolder", `C:\Users\Player\Desktop\TRPG`, ""},
		{"other folder", `D:\Games\TRPG`, ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := startupLocation(test.executableDir, `C:\Users\Player\Desktop`, `C:\Users\Player\Downloads`)
			if got != test.want {
				t.Fatalf("startupLocation() = %q, want %q", got, test.want)
			}
		})
	}
}
