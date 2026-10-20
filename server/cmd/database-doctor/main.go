package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"btr/server/internal/dbdoctor"
)

func readLine(reader *bufio.Reader, prompt string) string {
	fmt.Print(prompt)
	value, _ := reader.ReadString('\n')
	return strings.TrimSpace(value)
}

func waitAndExit(reader *bufio.Reader, message string, code int) {
	fmt.Println()
	fmt.Println(message)
	_, _ = reader.ReadString('\n')
	os.Exit(code)
}

func uniqueExistingDatabases(paths []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(paths))
	for _, path := range paths {
		if strings.TrimSpace(path) == "" {
			continue
		}
		abs, err := filepath.Abs(path)
		if err != nil || seen[abs] {
			continue
		}
		info, err := os.Stat(abs)
		if err != nil || !info.Mode().IsRegular() {
			continue
		}
		seen[abs] = true
		result = append(result, abs)
	}
	sort.Strings(result)
	return result
}

func databaseCandidates() []string {
	executable, _ := os.Executable()
	executableDir := filepath.Dir(executable)
	workingDir, _ := os.Getwd()
	return uniqueExistingDatabases([]string{
		os.Getenv("BTR_DB_PATH"),
		filepath.Join(executableDir, "data", "storage.db"),
		filepath.Join(executableDir, "storage.db"),
		filepath.Join(workingDir, "data", "storage.db"),
		filepath.Join(workingDir, "server", "data", "storage.db"),
	})
}

func showDatabaseInfo(path string) {
	info, err := os.Stat(path)
	if err != nil {
		fmt.Printf("  路径：%s\n", path)
		return
	}
	fmt.Printf("  路径：%s\n", path)
	fmt.Printf("  大小：%.2f MB\n", float64(info.Size())/(1024*1024))
	fmt.Printf("  修改时间：%s\n", info.ModTime().Format("2006-01-02 15:04:05"))
}

func chooseDatabase(reader *bufio.Reader, explicitPath string) (string, bool) {
	if strings.TrimSpace(explicitPath) != "" {
		paths := uniqueExistingDatabases([]string{explicitPath})
		if len(paths) == 0 {
			fmt.Printf("没有找到这个数据库文件：%s\n", explicitPath)
			return "", false
		}
		return paths[0], true
	}

	paths := databaseCandidates()
	if len(paths) == 0 {
		fmt.Println("没有在常见位置找到 storage.db。")
		fmt.Println("通常它位于：TRPG模组笔记.exe 同级的 data 文件夹里。")
		fmt.Println("请在资源管理器中搜索 storage.db，然后把完整路径粘贴到下面。")
		manual := strings.Trim(readLine(reader, "storage.db 的完整路径（直接按 Enter 取消）："), "\"")
		paths = uniqueExistingDatabases([]string{manual})
		if len(paths) == 0 {
			fmt.Println("没有找到该文件，已取消。")
			return "", false
		}
	}

	if len(paths) == 1 {
		fmt.Println("已找到数据库：")
		showDatabaseInfo(paths[0])
		return paths[0], true
	}

	fmt.Println("找到了多个数据库。请优先选择与当前 EXE 同级 data 文件夹中的那个：")
	for index, path := range paths {
		fmt.Printf("\n[%d]\n", index+1)
		showDatabaseInfo(path)
	}
	selection := readLine(reader, fmt.Sprintf("请输入 1-%d：", len(paths)))
	selected, err := strconv.Atoi(selection)
	if err != nil || selected < 1 || selected > len(paths) {
		fmt.Println("选择无效，已取消。")
		return "", false
	}
	return paths[selected-1], true
}

func runCheck(path string) (bool, error) {
	report, err := dbdoctor.Inspect(path)
	if err != nil {
		return false, err
	}
	fmt.Println("=== TRPG 模组笔记数据库检查 ===")
	dbdoctor.PrintReport(os.Stdout, report)
	return len(report.Issues) == 0, nil
}

func runRepair(path string) (bool, error) {
	fmt.Println("\n=== 开始安全修复 ===")
	backupPath, added, roleFixed, err := dbdoctor.Repair(path)
	if backupPath != "" {
		fmt.Println("修复前备份：" + backupPath)
	}
	if err != nil {
		return false, err
	}
	fmt.Printf("补回所有者成员关系：%d 条\n", added)
	fmt.Printf("修正所有者角色：%d 条\n", roleFixed)
	fmt.Println("索引重建与数据库优化：完成")

	fmt.Println("\n=== 修复后复检 ===")
	healthy, err := runCheck(path)
	return healthy, err
}

func main() {
	databasePath := flag.String("database-path", "", "要检查的 storage.db 路径")
	repair := flag.Bool("repair", false, "检查后执行安全修复")
	yes := flag.Bool("yes", false, "确认非交互修复")
	flag.Parse()

	reader := bufio.NewReader(os.Stdin)
	interactive := strings.TrimSpace(*databasePath) == ""
	if interactive {
		fmt.Println("==================================================")
		fmt.Println("       TRPG 模组笔记 - 独立数据库检查工具")
		fmt.Println("==================================================")
		fmt.Println()
		fmt.Println("适用情况：模组内容没有显示、应用提示迁移异常，或怀疑数据库损坏。")
		fmt.Println("安全规则：检查只读；修复前自动备份；不自动删除孤立数据或覆盖损坏内容。")
		fmt.Println()
		fmt.Println("第一步：请从系统托盘彻底退出“TRPG 模组笔记”。")
		_ = readLine(reader, "确认应用已经退出后，按 Enter 键继续……")
		fmt.Println()
	}

	path, ok := chooseDatabase(reader, *databasePath)
	if !ok {
		if interactive {
			waitAndExit(reader, "没有修改任何文件。按 Enter 键关闭窗口。", 2)
		}
		os.Exit(2)
	}
	if interactive {
		fmt.Println()
		fmt.Println("记录数可以帮助判断是否选错数据库；接下来先做只读检查。")
		_ = readLine(reader, "按 Enter 键开始检查……")
		fmt.Println()
	}

	healthy, err := runCheck(path)
	if err != nil {
		message := fmt.Sprintf("检查无法完成：%v\n请确认应用已经退出、数据库路径正确，并把完整输出发给开发者。", err)
		if interactive {
			waitAndExit(reader, message+"\n按 Enter 键关闭窗口。", 2)
		}
		fmt.Fprintln(os.Stderr, message)
		os.Exit(2)
	}
	if healthy && !*repair {
		message := "检查完成：未发现问题。如果应用里仍看不到内容，请核对上方路径及记录数。"
		if interactive {
			waitAndExit(reader, message+"\n按 Enter 键关闭窗口。", 0)
		}
		return
	}

	doRepair := *repair && *yes
	if interactive && !healthy {
		fmt.Println()
		fmt.Println("标记为“可自动修复”的项目可以处理。修复会先备份，再补回所有者关系、重建索引。")
		fmt.Println("无效 JSON、孤立记录和失败的迁移仍会保留，交由开发者判断。")
		doRepair = readLine(reader, "要执行修复，请输入 REPAIR；直接按 Enter 则退出：") == "REPAIR"
	}
	if !doRepair {
		if *repair && !*yes && !interactive {
			fmt.Fprintln(os.Stderr, "非交互修复还需要 --yes 确认。")
			os.Exit(2)
		}
		if interactive {
			waitAndExit(reader, "已退出，没有执行修复。按 Enter 键关闭窗口。", 1)
		}
		os.Exit(1)
	}

	healthy, err = runRepair(path)
	if err != nil {
		message := fmt.Sprintf("修复没有正常完成：%v\n原数据库和已经生成的备份均会保留。", err)
		if interactive {
			waitAndExit(reader, message+"\n按 Enter 键关闭窗口。", 2)
		}
		fmt.Fprintln(os.Stderr, message)
		os.Exit(2)
	}
	if healthy {
		if interactive {
			waitAndExit(reader, "修复及复检完成，现在可以重新启动应用。按 Enter 键关闭窗口。", 0)
		}
		return
	}
	if interactive {
		waitAndExit(reader, "可自动修复项已处理，但仍有问题需要人工判断。请保留备份并把输出发给开发者。\n按 Enter 键关闭窗口。", 1)
	}
	os.Exit(1)
}
