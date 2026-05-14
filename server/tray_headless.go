//go:build headless

package main

import (
	"net"
	"os/exec"
	"regexp"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func trayInit() {
}

func hideWindow() {
}

func showWindow() {
}

func TestRunning() bool {
	return false
}

func tempDirWarn() {
	zap.S().Warn("当前工作路径为临时目录，因此拒绝继续执行。")
}

func showMsgBox(title string, message string) {
	zap.S().Info(title, message)
}

func executeWin(name string, arg ...string) *exec.Cmd {
	cmd := exec.Command(name, arg...)
	return cmd
}

func httpServe(e *gin.Engine, addr string, hideUI bool) {
	_ = hideUI
	log := zap.S()
	portStr := "3211"
	rePort := regexp.MustCompile(`:(\d+)$`)
	m := rePort.FindStringSubmatch(addr)
	if len(m) > 0 {
		portStr = m[1]
	}

	ln, err := net.Listen("tcp", ":"+portStr)
	if err != nil {
		log.Errorf("端口已被占用，即将自动退出: %s", addr)
		return
	}
	_ = ln.Close()

	log.Infof("headless 模式启动成功，请访问:\nhttp://localhost:%s", portStr)
	if err := e.Run(addr); err != nil {
		log.Errorf("端口已被占用，即将自动退出: %s", addr)
	}
}

func startPlatformApp(router *gin.Engine, addr string, showConsole bool, hideUI bool) {
	_ = showConsole
	httpServe(router, addr, hideUI)
}
