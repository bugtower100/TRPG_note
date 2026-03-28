//go:build darwin

package main

import (
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"syscall"
	"time"

	"github.com/fy0/systray"
	"github.com/gen2brain/beeep"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func trayInit() {
	runtime.LockOSThread()
	systray.Run(onReady, onExit)
}

func hideWindow() {
}

func showWindow() {
}

func TestRunning() bool {
	return false
}

func tempDirWarn() {
	zap.S().Info("当前工作路径为临时目录，因此拒绝继续执行。")
}

func showMsgBox(title string, message string) {
	zap.S().Info(title, message)
}

func executeWin(name string, arg ...string) *exec.Cmd {
	cmd := exec.Command(name, arg...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
		Pgid:    os.Getppid(),
	}
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout
	cmd.Stdin = os.Stdin
	return cmd
}

var _trayPortStr = "3211"

var systrayQuited bool = false

func onReady() {
	systray.SetIcon(trayIcon)
	systray.SetTitle("跑团笔记")
	systray.SetTooltip("跑团笔记")

	mOpen := systray.AddMenuItem("打开界面", "开启 Web 界面")
	mOpen.SetIcon(trayIcon)
	mOpenExeDir := systray.AddMenuItem("打开程序目录", "访达访问程序所在目录")
	mQuit := systray.AddMenuItem("退出", "退出程序")

	go func() {
		_ = beeep.Notify("跑团笔记", "已最小化到系统托盘。点击图标可快速打开界面。", "icon/icon.ico")
	}()

	for {
		select {
		case <-mOpen.ClickedCh:
			_ = exec.Command(`open`, `http://localhost:`+_trayPortStr+`/web`).Start()
		case <-mOpenExeDir.ClickedCh:
			_ = exec.Command(`open`, filepath.Dir(os.Args[0])).Start()
		case <-mQuit.ClickedCh:
			systrayQuited = true
			systray.Quit()
			time.Sleep(3 * time.Second)
			os.Exit(0)
		}
	}
}

func onExit() {
	// clean up hear
}

func httpServe(e *gin.Engine, addr string, hideUI bool) {
	log := zap.S()
	portStr := "3211"

	go func() {
		for {
			time.Sleep(5 * time.Second)
			if systrayQuited {
				break
			}
			runtime.LockOSThread()
			systray.SetTooltip("跑团笔记 #" + portStr)
			runtime.UnlockOSThread()
		}
	}()

	rePort := regexp.MustCompile(`:(\d+)$`)
	m := rePort.FindStringSubmatch(addr)
	if len(m) > 0 {
		portStr = m[1]
	}

	ln, err := net.Listen("tcp", ":"+portStr)
	if err != nil {
		log.Errorf("端口已被占用，即将自动退出: %s", addr)
		runtime.Goexit()
	}
	_ = ln.Close()

	// exec.Command(`cmd`, `/c`, `start`, fmt.Sprintf(`http://localhost:%s`, portStr)).Start()
	log.Infof("如果浏览器没有自动打开，请手动访问:\nhttp://localhost:%s", portStr)
	err = e.Run(addr)
	if err != nil {
		log.Errorf("端口已被占用，即将自动退出: %s", addr)
		return
	}
}
