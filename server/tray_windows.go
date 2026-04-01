//go:build windows

package main

import (
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"syscall"
	"time"
	"unsafe"

	"github.com/fy0/go-autostart"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/fy0/systray"
	"github.com/gen2brain/beeep"
	win "github.com/lxn/win"
	"github.com/monaco-io/request"
	"golang.org/x/sys/windows"
)

func hideWindow() {
	win.ShowWindow(win.GetConsoleWindow(), win.SW_HIDE)
}

func showWindow() {
	win.ShowWindow(win.GetConsoleWindow(), win.SW_SHOW)
}
func trayInit() {
	// 确保能收到系统消息，从而避免不能弹出菜单
	runtime.LockOSThread()
	systray.Run(onReady, onExit)
}

var (
	kernel32        = syscall.NewLazyDLL("kernel32.dll")
	procCreateMutex = kernel32.NewProc("CreateMutexW")
)

func CreateMutex(name string) (uintptr, error) {
	s, _ := syscall.UTF16PtrFromString(name)
	ret, _, err := procCreateMutex.Call(
		0,
		0,
		uintptr(unsafe.Pointer(s)),
	)
	switch int(err.(syscall.Errno)) { //nolint:errorlint
	case 0:
		return ret, nil
	default:
		return ret, err
	}
}

func TestRunning() bool {
	_, err := CreateMutex("BTR_PTNOTE_MUTEX")
	if err == nil {
		return false
	}

	s1, _ := syscall.UTF16PtrFromString("跑团笔记 已在运行")
	s2, _ := syscall.UTF16PtrFromString("如果你需要打开多个实例，请点“确定”。\n如果只是打开界面，请在系统托盘区域找到图标并右键。")
	ret := win.MessageBox(0, s2, s1, win.MB_YESNO|win.MB_ICONWARNING|win.MB_DEFBUTTON2)
	return ret != win.IDYES
}

func PortExistsWarn() {
	s1, _ := syscall.UTF16PtrFromString("跑团笔记 启动失败")
	s2, _ := syscall.UTF16PtrFromString("端口已被占用，建议更换其他端口。")
	win.MessageBox(0, s2, s1, win.MB_OK)
}

func getAutoStart() *autostart.App {
	exePath, err := filepath.Abs(os.Args[0])
	if err == nil {
		pathName := filepath.Dir(exePath)
		pathName = filepath.Base(pathName)
		autostartName := fmt.Sprintf("BTR_%s", pathName)

		appStart := &autostart.App{
			Name:        autostartName,
			DisplayName: "跑团笔记 - 目录: " + pathName,
			Exec:        []string{exePath, "-m --hide-ui"}, // 分开写会有问题
		}
		return appStart
	}
	return nil
}

var systrayQuited bool = false

func onReady() {
	log := zap.S()
	ver := "V1.2"
	systray.SetIcon(trayIcon)
	systray.SetTitle("跑团笔记")
	systray.SetTooltip("跑团笔记 " + ver)

	mOpen := systray.AddMenuItem("打开界面", "打开 Web 界面")
	mOpenExeDir := systray.AddMenuItem("打开程序目录", "资源管理器访问程序所在目录")
	mShowHide := systray.AddMenuItemCheckbox("显示终端窗口", "显示终端窗口", false)
	mAutoBoot := systray.AddMenuItemCheckbox("开机自启动", "开机自启动", false)
	mQuit := systray.AddMenuItem("退出", "退出程序")
	mOpen.SetIcon(trayIcon)

	go func() {
		_ = beeep.Notify("跑团笔记", "已最小化到系统托盘。点击图标可快速打开界面。", "icon/icon.ico")
	}()

	// 自启动检查
	go func() {
		runtime.LockOSThread()
		for {
			time.Sleep(10 * time.Second)
			if getAutoStart().IsEnabled() {
				mAutoBoot.Check()
			} else {
				mAutoBoot.Uncheck()
			}
		}
	}()

	if getAutoStart().IsEnabled() {
		mAutoBoot.Check()
	}

	for {
		select {
		case <-mOpen.ClickedCh:
			_ = exec.Command(`cmd`, `/c`, `start`, `http://localhost:`+_trayPortStr).Start()
		case <-mOpenExeDir.ClickedCh:
			_ = exec.Command(`cmd`, `/c`, `explorer`, filepath.Dir(os.Args[0])).Start()
		case <-mQuit.ClickedCh:
			systray.Quit()
			systrayQuited = true
			time.Sleep(3 * time.Second)
			os.Exit(0)
		case <-mAutoBoot.ClickedCh:
			if mAutoBoot.Checked() {
				err := getAutoStart().Disable()
				if err != nil {
					s1, _ := syscall.UTF16PtrFromString("跑团笔记")
					s2, _ := syscall.UTF16PtrFromString("自启动设置失败，原因: " + err.Error())
					win.MessageBox(0, s2, s1, win.MB_OK|win.MB_ICONERROR)
					log.Errorf("自启动设置失败: %v", err.Error())
				}
				mAutoBoot.Uncheck()
			} else {
				err := getAutoStart().Enable()
				if err != nil {
					s1, _ := syscall.UTF16PtrFromString("跑团笔记")
					s2, _ := syscall.UTF16PtrFromString("自启动设置失败，原因: " + err.Error())
					win.MessageBox(0, s2, s1, win.MB_OK|win.MB_ICONERROR)
					log.Errorf("自启动设置失败: %v", err.Error())
				}
				mAutoBoot.Check()
			}
		case <-mShowHide.ClickedCh:
			if mShowHide.Checked() {
				win.ShowWindow(win.GetConsoleWindow(), win.SW_HIDE)
				mShowHide.Uncheck()
			} else {
				win.ShowWindow(win.GetConsoleWindow(), win.SW_SHOW)
				mShowHide.Check()
			}
		}
	}
}

func onExit() {
	// clean up here
}

var _trayPortStr = "3211"

func httpServe(e *gin.Engine, addr string, hideUI bool) {
	log := zap.S()
	portStr := "3211"
	go func() {
		ver := "V1.2"
		for {
			time.Sleep(5 * time.Second)
			if systrayQuited {
				break
			}
			runtime.LockOSThread()
			systray.SetTooltip("跑团笔记 " + ver + " #" + portStr)
			runtime.UnlockOSThread()
		}
	}()

	showUI := func() {
		if !hideUI {
			time.Sleep(2 * time.Second)
			url := fmt.Sprintf(`http://localhost:%s/web`, portStr)
			url2 := fmt.Sprintf(`http://127.0.0.1:%s/web`, portStr)
			c := request.Client{
				URL:     url2,
				Method:  "GET",
				Timeout: 1,
			}
			resp := c.Send()
			if resp.OK() {
				time.Sleep(1 * time.Second)
				_ = exec.Command(`cmd`, `/c`, `start`, url).Start()
			}
		}
	}

	for {
		rePort := regexp.MustCompile(`:(\d+)$`)
		m := rePort.FindStringSubmatch(addr)
		if len(m) > 0 {
			portStr = m[1]
			_trayPortStr = portStr
		}

		err := e.Run(addr)

		if err != nil {
			s1, _ := syscall.UTF16PtrFromString("跑团笔记")
			s2, _ := syscall.UTF16PtrFromString(fmt.Sprintf("端口 %s 已被占用，点“是”随机换一个端口，点“否”退出。", portStr))
			ret := win.MessageBox(0, s2, s1, win.MB_YESNO|win.MB_ICONWARNING|win.MB_DEFBUTTON2)
			if ret == win.IDYES {
				newPort := 3000 + rand.Int()%4000
				addr = fmt.Sprintf("0.0.0.0:%d", newPort)
				continue
			} else {
				log.Errorf("端口已被占用，即将自动退出: %s", addr)
				os.Exit(0)
			}
		} else {
			log.Infof("如果浏览器没有自动打开，请手动访问:\nhttp://localhost:%s\n", portStr)
			go showUI()
			break
		}
	}
}

func tempDirWarn() {
	s1, _ := syscall.UTF16PtrFromString("跑团笔记")
	s2, _ := syscall.UTF16PtrFromString("当前工作路径为临时目录，请先完整解压后再运行。")
	win.MessageBox(0, s2, s1, win.MB_OK|win.MB_ICONERROR)
	zap.S().Error("当前工作路径为临时目录，拒绝继续执行。")
}

func showMsgBox(title string, message string) {
	s1, _ := syscall.UTF16PtrFromString(title)
	s2, _ := syscall.UTF16PtrFromString(message)
	win.MessageBox(0, s2, s1, win.MB_OK|win.MB_ICONERROR)
}

func executeWin(name string, arg ...string) *exec.Cmd {
	cmd := exec.Command(name, arg...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		// CreationFlags: windows.CREATE_NEW_PROCESS_GROUP | windows.DETACHED_PROCESS,
		CreationFlags:    windows.CREATE_NEW_PROCESS_GROUP | windows.CREATE_NEW_CONSOLE,
		NoInheritHandles: true,
	}
	return cmd
}
