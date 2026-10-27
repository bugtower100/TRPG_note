//go:build windows && !headless

package main

import (
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/fy0/go-autostart"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/fy0/systray"
	"github.com/gen2brain/beeep"
	win "github.com/lxn/win"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

func hideWindow() {
	win.ShowWindow(win.GetConsoleWindow(), win.SW_HIDE)
}

func showWindow() {
	win.ShowWindow(win.GetConsoleWindow(), win.SW_SHOW)
}

const browserSettingKey = `Software\BTR\TRPGNote`
const browserSettingName = "OpenBrowserOnLaunch"

func openBrowserOnLaunch() bool {
	key, err := registry.OpenKey(registry.CURRENT_USER, browserSettingKey, registry.QUERY_VALUE)
	if err != nil {
		return true
	}
	defer key.Close()
	value, _, err := key.GetIntegerValue(browserSettingName)
	return err != nil || value != 0
}

func setOpenBrowserOnLaunch(enabled bool) error {
	key, _, err := registry.CreateKey(registry.CURRENT_USER, browserSettingKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer key.Close()
	if enabled {
		return key.SetDWordValue(browserSettingName, 1)
	}
	return key.SetDWordValue(browserSettingName, 0)
}

func sameDirectory(left, right string) bool {
	return strings.EqualFold(filepath.Clean(left), filepath.Clean(right))
}

func startupLocation(executableDir, desktopDir, downloadsDir string) string {
	if desktopDir != "" && sameDirectory(executableDir, desktopDir) {
		return "桌面"
	}
	if downloadsDir != "" && sameDirectory(executableDir, downloadsDir) {
		return "下载文件夹"
	}
	return ""
}

func checkStartupDirectory() bool {
	executable, err := os.Executable()
	if err != nil {
		return true
	}
	executableDir := filepath.Dir(executable)
	desktopDir, desktopErr := windows.KnownFolderPath(windows.FOLDERID_Desktop, windows.KF_FLAG_DEFAULT)
	downloadsDir, downloadsErr := windows.KnownFolderPath(windows.FOLDERID_Downloads, windows.KF_FLAG_DEFAULT)
	if desktopErr != nil {
		desktopDir = ""
	}
	if downloadsErr != nil {
		downloadsDir = ""
	}
	location := startupLocation(executableDir, desktopDir, downloadsDir)
	if location != "" {
		message := fmt.Sprintf("程序现在直接放在%s，没有单独的程序文件夹。\n\n请先新建一个文件夹，再把 TRPG模组笔记.exe 和 数据库检查工具.exe 放进去；如果旁边已有 data 文件夹，也要一起移动，避免丢失现有资料。\n\n建议点“否”退出并整理文件。是否仍要继续启动？", location)
		title, _ := syscall.UTF16PtrFromString("请先整理程序文件夹")
		content, _ := syscall.UTF16PtrFromString(message)
		if win.MessageBox(0, content, title, win.MB_YESNO|win.MB_ICONWARNING|win.MB_DEFBUTTON2) != win.IDYES {
			return false
		}
	}
	if strings.EqualFold(filepath.Base(executable), "TRPG模组笔记.exe") {
		if err := os.Chdir(executableDir); err != nil {
			showMsgBox("跑团笔记 启动失败", "无法使用程序所在文件夹："+err.Error())
			return false
		}
	}
	return true
}

func trayInit() {
	// 确保能收到系统消息，从而避免不能弹出菜单
	runtime.LockOSThread()
	systray.Run(onReady, onExit)
}

func startPlatformApp(router *gin.Engine, addr string, showConsole bool, hideUI bool) {
	if showConsole {
		showWindow()
	} else {
		hideWindow()
	}
	if TestRunning() {
		return
	}
	go httpServe(router, addr, hideUI)
	trayInit()
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
	ver := appVersion
	systray.SetIcon(trayIcon)
	systray.SetTitle("跑团笔记")
	systray.SetTooltip("跑团笔记 " + ver)

	mOpen := systray.AddMenuItem("打开界面", "打开 Web 界面")
	mOpenExeDir := systray.AddMenuItem("打开程序目录", "资源管理器访问程序所在目录")
	mShowHide := systray.AddMenuItemCheckbox("显示终端窗口", "显示终端窗口", false)
	mAutoBoot := systray.AddMenuItemCheckbox("开机自启动", "开机自启动", false)
	mOpenOnLaunch := systray.AddMenuItemCheckbox("启动时自动打开网页", "启动程序后在默认浏览器打开界面；开机后台自启动时不打开", false)
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
	if openBrowserOnLaunch() {
		mOpenOnLaunch.Check()
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
		case <-mOpenOnLaunch.ClickedCh:
			enabled := !mOpenOnLaunch.Checked()
			if err := setOpenBrowserOnLaunch(enabled); err != nil {
				showMsgBox("跑团笔记", "网页自动打开设置保存失败："+err.Error())
				log.Errorf("网页自动打开设置保存失败: %v", err)
				continue
			}
			if enabled {
				mOpenOnLaunch.Check()
			} else {
				mOpenOnLaunch.Uncheck()
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

func openWebUIWhenReady(port string, stopped <-chan struct{}) {
	client := &http.Client{Timeout: time.Second}
	probeURL := "http://127.0.0.1:" + port + "/web"
	for attempt := 0; attempt < 20; attempt++ {
		select {
		case <-stopped:
			return
		default:
		}
		response, err := client.Get(probeURL)
		if err == nil {
			response.Body.Close()
			if response.StatusCode < 500 {
				select {
				case <-stopped:
					return
				default:
				}
				url := "http://localhost:" + port + "/web"
				if err := exec.Command(`cmd`, `/c`, `start`, url).Start(); err != nil {
					zap.S().Warnf("无法自动打开浏览器: %v", err)
				}
				return
			}
		}
		select {
		case <-stopped:
			return
		case <-time.After(500 * time.Millisecond):
		}
	}
	zap.S().Warn("网页启动后未能自动打开，请使用托盘菜单中的“打开界面”。")
}

func httpServe(e *gin.Engine, addr string, hideUI bool) {
	log := zap.S()
	for {
		_, portStr, _ := net.SplitHostPort(addr)
		listener, err := net.Listen("tcp", addr)
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
		}
		_trayPortStr = portStr
		log.Infof("如果浏览器没有自动打开，请手动访问:\nhttp://localhost:%s/web\n", portStr)
		stopped := make(chan struct{})
		if !hideUI && openBrowserOnLaunch() {
			go openWebUIWhenReady(portStr, stopped)
		}
		if err := e.RunListener(listener); err != nil {
			log.Errorf("网页服务运行失败: %v", err)
		}
		close(stopped)
		return
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
