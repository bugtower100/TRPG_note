package dbdoctor

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Issue struct {
	Severity   string
	Code       string
	Message    string
	Repairable bool
}

type Report struct {
	Path        string
	SizeBytes   int64
	IntegrityOK bool
	Counts      map[string]int64
	Issues      []Issue
}

var databaseDoctorCoreTables = []string{"kvs", "app_meta", "schema_migrations"}

var databaseDoctorV2Tables = []string{
	"users",
	"campaigns",
	"campaign_members",
	"campaign_documents",
	"campaign_configs",
	"team_notes",
	"shares",
	"document_versions",
	"resource_index",
}

func databaseDoctorReadOnlyDSN(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return "file:" + filepath.ToSlash(abs) + "?mode=ro", nil
}

func openDatabaseDoctorDB(path string, readOnly bool) (*gorm.DB, error) {
	dsn := path
	if readOnly {
		var err error
		dsn, err = databaseDoctorReadOnlyDSN(path)
		if err != nil {
			return nil, err
		}
	}
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	if _, err := sqlDB.Exec("PRAGMA busy_timeout = 5000"); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	return db, nil
}

func addDatabaseDoctorIssue(report *Report, severity, code, message string, repairable bool) {
	report.Issues = append(report.Issues, Issue{
		Severity: severity, Code: code, Message: message, Repairable: repairable,
	})
}

func databaseDoctorTableNames(db *sql.DB) (map[string]bool, error) {
	rows, err := db.Query("SELECT name FROM sqlite_master WHERE type = 'table'")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tables := map[string]bool{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables[name] = true
	}
	return tables, rows.Err()
}

func databaseDoctorMeta(db *sql.DB, key string) (string, bool, error) {
	var value string
	err := db.QueryRow("SELECT value FROM app_meta WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	return value, err == nil, err
}

func databaseDoctorCount(db *sql.DB, table string) (int64, error) {
	var count int64
	err := db.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&count) // table comes from a fixed allow-list
	return count, err
}

func checkDatabaseDoctorJSON(
	db *sql.DB,
	report *Report,
	table string,
	idColumn string,
	jsonColumn string,
	allowEmpty bool,
) error {
	rows, err := db.Query("SELECT " + idColumn + ", " + jsonColumn + " FROM " + table) // identifiers come from a fixed allow-list
	if err != nil {
		return err
	}
	defer rows.Close()
	invalidCount := 0
	examples := make([]string, 0, 3)
	for rows.Next() {
		var id string
		var raw sql.NullString
		if err := rows.Scan(&id, &raw); err != nil {
			return err
		}
		value := strings.TrimSpace(raw.String)
		if (allowEmpty && value == "") || (raw.Valid && json.Valid([]byte(value))) {
			continue
		}
		invalidCount++
		if len(examples) < cap(examples) {
			examples = append(examples, id)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if invalidCount > 0 {
		addDatabaseDoctorIssue(
			report,
			"错误",
			"invalid_json",
			fmt.Sprintf("表 %s 的字段 %s 有 %d 条无效 JSON（示例 ID：%s）", table, jsonColumn, invalidCount, strings.Join(examples, ", ")),
			false,
		)
	}
	return nil
}

func Inspect(path string) (Report, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return Report{}, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return Report{}, fmt.Errorf("无法访问数据库文件: %w", err)
	}
	if !info.Mode().IsRegular() {
		return Report{}, fmt.Errorf("数据库路径不是普通文件: %s", abs)
	}
	report := Report{Path: abs, SizeBytes: info.Size(), Counts: map[string]int64{}}
	db, err := openDatabaseDoctorDB(abs, true)
	if err != nil {
		return report, fmt.Errorf("无法以只读方式打开数据库: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return report, err
	}
	defer sqlDB.Close()

	rows, err := sqlDB.Query("PRAGMA quick_check")
	if err != nil {
		return report, fmt.Errorf("SQLite 完整性检查失败: %w", err)
	}
	integrityMessages := make([]string, 0)
	for rows.Next() {
		var message string
		if err := rows.Scan(&message); err != nil {
			rows.Close()
			return report, err
		}
		integrityMessages = append(integrityMessages, message)
	}
	if err := rows.Close(); err != nil {
		return report, err
	}
	report.IntegrityOK = len(integrityMessages) == 1 && integrityMessages[0] == "ok"
	if !report.IntegrityOK {
		addDatabaseDoctorIssue(&report, "错误", "sqlite_integrity", "SQLite 完整性异常："+strings.Join(integrityMessages, "; "), true)
	}

	tables, err := databaseDoctorTableNames(sqlDB)
	if err != nil {
		return report, err
	}
	for _, table := range databaseDoctorCoreTables {
		if !tables[table] {
			addDatabaseDoctorIssue(&report, "错误", "missing_table", "缺少基础表 "+table, false)
		}
	}

	schemaVersion := 0
	targetVersion := 0
	if tables["app_meta"] {
		rawVersion, exists, err := databaseDoctorMeta(sqlDB, "schema_version")
		if err != nil {
			return report, err
		}
		if !exists {
			addDatabaseDoctorIssue(&report, "错误", "missing_schema_version", "app_meta 中缺少 schema_version", false)
		} else if schemaVersion, err = strconv.Atoi(rawVersion); err != nil || schemaVersion < 1 {
			addDatabaseDoctorIssue(&report, "错误", "invalid_schema_version", "schema_version 无效："+rawVersion, false)
			schemaVersion = 0
		}
		rawTarget, exists, err := databaseDoctorMeta(sqlDB, "migration_target_version")
		if err != nil {
			return report, err
		}
		if !exists {
			addDatabaseDoctorIssue(&report, "错误", "missing_migration_target", "app_meta 中缺少 migration_target_version", false)
		} else if targetVersion, err = strconv.Atoi(rawTarget); err != nil || targetVersion < 1 {
			addDatabaseDoctorIssue(&report, "错误", "invalid_migration_target", "migration_target_version 无效："+rawTarget, false)
			targetVersion = 0
		}

		state, exists, err := databaseDoctorMeta(sqlDB, "migration_state")
		if err != nil {
			return report, err
		}
		if !exists {
			addDatabaseDoctorIssue(&report, "错误", "missing_migration_state", "app_meta 中缺少 migration_state", false)
		} else {
			allowed := map[string]bool{"ready": true, "required": true, "running": true, "failed": true, "blocked": true}
			if !allowed[state] {
				addDatabaseDoctorIssue(&report, "错误", "invalid_migration_state", "migration_state 无效："+state, false)
			} else if state != "ready" {
				addDatabaseDoctorIssue(&report, "警告", "migration_not_ready", "数据库迁移状态为 "+state+"，请先通过应用完成迁移", false)
			} else if schemaVersion > 0 && targetVersion > 0 && schemaVersion < targetVersion {
				addDatabaseDoctorIssue(&report, "错误", "migration_version_mismatch", fmt.Sprintf("数据库版本为 %d、目标版本为 %d，但迁移状态错误地标记为 ready", schemaVersion, targetVersion), false)
			}
		}
	}

	if schemaVersion >= 2 || tables["campaigns"] {
		for _, table := range databaseDoctorV2Tables {
			if !tables[table] {
				addDatabaseDoctorIssue(&report, "错误", "missing_table", "缺少 v2 数据表 "+table, false)
			}
		}
	}

	countTables := append(append([]string{}, databaseDoctorCoreTables...), databaseDoctorV2Tables...)
	for _, table := range countTables {
		if !tables[table] {
			continue
		}
		count, err := databaseDoctorCount(sqlDB, table)
		if err != nil {
			return report, err
		}
		report.Counts[table] = count
	}

	if tables["campaigns"] && tables["campaign_members"] {
		ownerRows, err := sqlDB.Query(`
			SELECT c.id, COALESCE(c.name, ''), COALESCE(c.owner_user_id, ''),
			       CASE WHEN m.user_id IS NULL THEN '<missing>' ELSE COALESCE(m.role, '') END
			FROM campaigns c
			LEFT JOIN campaign_members m
			  ON m.campaign_id = c.id AND m.user_id = c.owner_user_id
			WHERE TRIM(c.owner_user_id) = '' OR m.user_id IS NULL OR m.role <> 'owner'
			ORDER BY c.id`)
		if err != nil {
			return report, err
		}
		for ownerRows.Next() {
			var campaignID, name, ownerID, role string
			if err := ownerRows.Scan(&campaignID, &name, &ownerID, &role); err != nil {
				ownerRows.Close()
				return report, err
			}
			displayName := strings.TrimSpace(name)
			if displayName == "" {
				displayName = campaignID
			}
			if strings.TrimSpace(ownerID) == "" {
				addDatabaseDoctorIssue(&report, "错误", "missing_owner", fmt.Sprintf("模组 %q 没有所有者 ID", displayName), false)
			} else if role == "<missing>" {
				addDatabaseDoctorIssue(&report, "警告", "missing_owner_membership", fmt.Sprintf("模组 %q 缺少所有者成员关系，可能导致内容不出现在列表中", displayName), true)
			} else {
				addDatabaseDoctorIssue(&report, "警告", "wrong_owner_role", fmt.Sprintf("模组 %q 的所有者角色为 %q，应为 owner", displayName, role), true)
			}
		}
		if err := ownerRows.Close(); err != nil {
			return report, err
		}
	}

	childTables := []string{"campaign_members", "campaign_documents", "campaign_configs", "team_notes", "shares", "document_versions"}
	if tables["campaigns"] {
		for _, table := range childTables {
			if !tables[table] {
				continue
			}
			var count int64
			query := "SELECT COUNT(*) FROM " + table + " child LEFT JOIN campaigns parent ON parent.id = child.campaign_id WHERE parent.id IS NULL"
			if err := sqlDB.QueryRow(query).Scan(&count); err != nil {
				return report, err
			}
			if count > 0 {
				addDatabaseDoctorIssue(&report, "警告", "orphan_rows", fmt.Sprintf("表 %s 有 %d 条找不到所属模组的记录；为避免误删，脚本不会自动处理", table, count), false)
			}
		}
	}

	jsonChecks := []struct {
		table, idColumn, jsonColumn string
		allowEmpty                  bool
	}{
		{"kvs", "key", "value", false},
		{"campaign_documents", "id", "content_json", false},
		{"campaign_configs", "campaign_id", "content_json", false},
		{"team_notes", "id", "content_json", false},
		{"team_notes", "id", "active_lease_json", true},
		{"shares", "id", "content_json", false},
		{"shares", "id", "active_lease_json", true},
		{"document_versions", "id", "snapshot_json", false},
	}
	for _, check := range jsonChecks {
		if !tables[check.table] {
			continue
		}
		if err := checkDatabaseDoctorJSON(sqlDB, &report, check.table, check.idColumn, check.jsonColumn, check.allowEmpty); err != nil {
			return report, err
		}
	}

	return report, nil
}

func createDatabaseDoctorBackup(db *sql.DB, databasePath string) (string, error) {
	backupDir := filepath.Join(filepath.Dir(databasePath), "database-doctor-backups")
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		return "", err
	}
	name := fmt.Sprintf("%s.%s.bak", filepath.Base(databasePath), time.Now().Format("20060102-150405.000000000"))
	backupPath := filepath.Join(backupDir, name)
	if _, err := db.Exec("VACUUM INTO ?", backupPath); err != nil {
		return "", err
	}
	return backupPath, nil
}

func Repair(path string) (string, int64, int64, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", 0, 0, err
	}
	db, err := openDatabaseDoctorDB(abs, false)
	if err != nil {
		return "", 0, 0, fmt.Errorf("无法以修复模式打开数据库: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return "", 0, 0, err
	}
	defer sqlDB.Close()

	backupPath, err := createDatabaseDoctorBackup(sqlDB, abs)
	if err != nil {
		return "", 0, 0, fmt.Errorf("创建修复前备份失败，已停止修复: %w", err)
	}
	tables, err := databaseDoctorTableNames(sqlDB)
	if err != nil {
		return backupPath, 0, 0, err
	}

	var added, roleFixed int64
	if tables["campaigns"] && tables["campaign_members"] {
		tx, err := sqlDB.Begin()
		if err != nil {
			return backupPath, 0, 0, err
		}
		result, err := tx.Exec(`
			INSERT INTO campaign_members
				(campaign_id, user_id, role, joined_at, last_active_at, created_at, updated_at)
			SELECT c.id, c.owner_user_id, 'owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
			FROM campaigns c
			WHERE TRIM(c.owner_user_id) <> ''
			  AND NOT EXISTS (
				SELECT 1 FROM campaign_members m
				WHERE m.campaign_id = c.id AND m.user_id = c.owner_user_id
			  )`)
		if err == nil {
			added, err = result.RowsAffected()
		}
		if err == nil {
			result, err = tx.Exec(`
				UPDATE campaign_members
				SET role = 'owner', updated_at = CURRENT_TIMESTAMP
				WHERE role <> 'owner'
				  AND EXISTS (
					SELECT 1 FROM campaigns c
					WHERE c.id = campaign_members.campaign_id
					  AND c.owner_user_id = campaign_members.user_id
				  )`)
		}
		if err == nil {
			roleFixed, err = result.RowsAffected()
		}
		if err != nil {
			_ = tx.Rollback()
			return backupPath, 0, 0, err
		}
		if err := tx.Commit(); err != nil {
			return backupPath, 0, 0, err
		}
	}

	if _, err := sqlDB.Exec("REINDEX"); err != nil {
		return backupPath, added, roleFixed, fmt.Errorf("重建索引失败: %w", err)
	}
	if _, err := sqlDB.Exec("PRAGMA optimize"); err != nil {
		return backupPath, added, roleFixed, fmt.Errorf("优化数据库失败: %w", err)
	}
	return backupPath, added, roleFixed, nil
}

func PrintReport(out io.Writer, report Report) {
	fmt.Fprintf(out, "数据库：%s\n", report.Path)
	fmt.Fprintf(out, "文件大小：%d 字节\n", report.SizeBytes)
	if report.IntegrityOK {
		fmt.Fprintln(out, "SQLite 完整性：正常")
	} else {
		fmt.Fprintln(out, "SQLite 完整性：异常")
	}
	keys := make([]string, 0, len(report.Counts))
	for table := range report.Counts {
		keys = append(keys, table)
	}
	sort.Strings(keys)
	if len(keys) > 0 {
		fmt.Fprintln(out, "记录数：")
		for _, table := range keys {
			fmt.Fprintf(out, "  %-22s %d\n", table, report.Counts[table])
		}
	}
	if len(report.Issues) == 0 {
		fmt.Fprintln(out, "结论：未发现数据库问题。")
		return
	}
	fmt.Fprintf(out, "发现 %d 个问题：\n", len(report.Issues))
	for _, issue := range report.Issues {
		repairHint := ""
		if issue.Repairable {
			repairHint = "（可自动修复）"
		}
		fmt.Fprintf(out, "  [%s] %s %s\n", issue.Severity, issue.Message, repairHint)
	}
}
