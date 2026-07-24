package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type CharacterSheetImportPreviewRequest struct {
	Text       string `json:"text"`
	SystemHint string `json:"systemHint,omitempty"`
}

type CharacterSheetImportPreview struct {
	DetectedSystem string                `json:"detectedSystem"`
	System         string                `json:"system"`
	Confidence     float64               `json:"confidence"`
	Warnings       []string              `json:"warnings"`
	MissingFields  []string              `json:"missingFields"`
	Name           string                `json:"name"`
	Summary        string                `json:"summary,omitempty"`
	Payload        CharacterSheetPayload `json:"payload"`
}

var cocExportSegments = []struct {
	Key    string
	Labels []string
}{
	{Key: "str", Labels: []string{"力量", "str"}},
	{Key: "dex", Labels: []string{"敏捷", "dex"}},
	{Key: "pow", Labels: []string{"意志", "pow"}},
	{Key: "con", Labels: []string{"体质", "con"}},
	{Key: "app", Labels: []string{"外貌", "app"}},
	{Key: "edu", Labels: []string{"教育", "教养", "edu"}},
	{Key: "siz", Labels: []string{"体型", "体格", "siz"}},
	{Key: "int", Labels: []string{"智力", "灵感", "int"}},
}

var cocExportStatusSegments = []struct {
	Key    string
	Labels []string
}{
	{Key: "san", Labels: []string{"san", "san值", "理智", "理智值"}},
	{Key: "luck", Labels: []string{"幸运", "运气"}},
	{Key: "mp", Labels: []string{"mp", "魔法"}},
	{Key: "hp", Labels: []string{"hp", "体力"}},
}

var cocSkillAliasMap = map[string][]string{
	"会计":     {"会计"},
	"人类学":    {"人类学"},
	"估价":     {"估价"},
	"考古学":    {"考古学"},
	"取悦":     {"取悦", "魅惑"},
	"攀爬":     {"攀爬"},
	"计算机使用":  {"计算机", "计算机使用", "电脑"},
	"信用评级":   {"信用", "信誉", "信用评级"},
	"克苏鲁神话":  {"克苏鲁", "克苏鲁神话", "cm"},
	"乔装":     {"乔装"},
	"闪避":     {"闪避"},
	"汽车驾驶":   {"汽车", "驾驶", "汽车驾驶"},
	"电气维修":   {"电气维修"},
	"电子学":    {"电子学"},
	"话术":     {"话术"},
	"斗殴":     {"斗殴"},
	"射击:手枪":  {"手枪"},
	"急救":     {"急救"},
	"历史":     {"历史"},
	"恐吓":     {"恐吓"},
	"跳跃":     {"跳跃"},
	"母语":     {"母语"},
	"法律":     {"法律"},
	"图书馆使用":  {"图书馆", "图书馆使用"},
	"聆听":     {"聆听"},
	"开锁":     {"开锁", "撬锁", "锁匠"},
	"机械维修":   {"机械维修"},
	"医学":     {"医学"},
	"博物学":    {"博物学", "自然学"},
	"领航":     {"领航", "导航"},
	"神秘学":    {"神秘学"},
	"操作重型机械": {"重型操作", "重型机械", "操作重型机械", "重型"},
	"说服":     {"说服"},
	"精神分析":   {"精神分析"},
	"心理学":    {"心理学"},
	"骑术":     {"骑术"},
	"妙手":     {"妙手"},
	"侦查":     {"侦查"},
	"潜行":     {"潜行"},
	"生存":     {"生存"},
	"游泳":     {"游泳"},
	"投掷":     {"投掷"},
	"追踪":     {"追踪"},
	"动物驯养":   {"动物驯养"},
	"潜水":     {"潜水"},
	"爆破":     {"爆破"},
	"读唇":     {"读唇"},
	"催眠":     {"催眠"},
	"炮术":     {"炮术"},
	"地质学":    {"地质", "地质学"},
}

var dndSkillDefinitions = []struct {
	Name    string
	Ability string
}{
	{Name: "运动", Ability: "str"},
	{Name: "体操", Ability: "dex"},
	{Name: "巧手", Ability: "dex"},
	{Name: "隐匿", Ability: "dex"},
	{Name: "调查", Ability: "int"},
	{Name: "奥秘", Ability: "int"},
	{Name: "历史", Ability: "int"},
	{Name: "自然", Ability: "int"},
	{Name: "宗教", Ability: "int"},
	{Name: "察觉", Ability: "wis"},
	{Name: "洞悉", Ability: "wis"},
	{Name: "驯兽", Ability: "wis"},
	{Name: "医药", Ability: "wis"},
	{Name: "求生", Ability: "wis"},
	{Name: "游说", Ability: "cha"},
	{Name: "欺瞒", Ability: "cha"},
	{Name: "威吓", Ability: "cha"},
	{Name: "表演", Ability: "cha"},
}

var dndClassSpellAbility = map[string]string{
	"法师": "INT", "wizard": "INT", "术士": "CHA", "sorcerer": "CHA",
	"吟游诗人": "CHA", "bard": "CHA", "牧师": "WIS", "cleric": "WIS",
	"德鲁伊": "WIS", "druid": "WIS", "圣武士": "CHA", "paladin": "CHA",
	"游侠": "WIS", "ranger": "WIS", "邪术师": "CHA", "warlock": "CHA",
	"工匠": "INT", "artificer": "INT",
}

func reportImportPreviewDebug(hypothesisID, location, msg string, data map[string]any) {
	payload := map[string]any{
		"sessionId":    "import-preview-failure",
		"runId":        "pre-fix",
		"hypothesisId": hypothesisID,
		"location":     location,
		"msg":          msg,
		"data":         data,
		"ts":           time.Now().UnixMilli(),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return
	}
	go func() {
		req, err := http.NewRequest(http.MethodPost, "http://127.0.0.1:7777/event", bytes.NewReader(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return
		}
		_ = resp.Body.Close()
	}()
}

func previewCharacterSheetImport(req CharacterSheetImportPreviewRequest) CharacterSheetImportPreview {
	text := strings.TrimSpace(req.Text)
	detectedSystem, confidence := detectCharacterSheetImportSystem(text, req.SystemHint)
	// #region debug-point C:parser-entry
	reportImportPreviewDebug("C", "character_sheet_import.go:previewCharacterSheetImport:start", "[DEBUG] previewCharacterSheetImport start", map[string]any{
		"textLength":       len(text),
		"systemHint":       req.SystemHint,
		"detectedSystem":   detectedSystem,
		"detectConfidence": confidence,
	})
	// #endregion
	payload := defaultCharacterSheetPayload(detectedSystem)
	preview := CharacterSheetImportPreview{
		DetectedSystem: detectedSystem,
		System:         detectedSystem,
		Confidence:     confidence,
		Warnings:       []string{},
		MissingFields:  []string{},
		Payload:        payload,
	}

	switch detectedSystem {
	case characterSheetSystemDnd5e:
		fillDndImportPreview(text, &preview)
	default:
		fillCoCImportPreview(text, &preview)
	}

	preview.Payload = normalizeImportedPayload(preview.Payload, detectedSystem)
	if strings.TrimSpace(preview.Name) == "" {
		if detectedSystem == characterSheetSystemDnd5e {
			preview.Name = "导入的 DND 角色卡"
		} else {
			preview.Name = "导入的 CoC 角色卡"
		}
		preview.Warnings = append(preview.Warnings, "未识别到角色名称，已使用默认名称。")
	}

	// #region debug-point C:parser-result
	reportImportPreviewDebug("C", "character_sheet_import.go:previewCharacterSheetImport:result", "[DEBUG] previewCharacterSheetImport result", map[string]any{
		"system":             preview.System,
		"detectedSystem":     preview.DetectedSystem,
		"confidence":         preview.Confidence,
		"name":               preview.Name,
		"warningsCount":      len(preview.Warnings),
		"missingFieldsCount": len(preview.MissingFields),
	})
	// #endregion

	return preview
}

func normalizeImportedPayload(payload CharacterSheetPayload, system string) CharacterSheetPayload {
	defaultPayload := defaultCharacterSheetPayload(system)
	defaultPayload.Base = payload.Base
	if system == characterSheetSystemDnd5e {
		defaultPayload.Dnd5e = mergeMap(defaultPayload.Dnd5e, payload.Dnd5e)
		return defaultPayload
	}
	defaultPayload.CoC7 = mergeMap(defaultPayload.CoC7, payload.CoC7)
	return defaultPayload
}

func mergeMap(base map[string]any, override map[string]any) map[string]any {
	result := make(map[string]any, len(base)+len(override))
	for key, value := range base {
		result[key] = value
	}
	for key, value := range override {
		result[key] = value
	}
	return result
}

func detectCharacterSheetImportSystem(text, systemHint string) (string, float64) {
	switch normalizeCharacterSheetSystem(strings.TrimSpace(systemHint)) {
	case characterSheetSystemDnd5e:
		if strings.EqualFold(strings.TrimSpace(systemHint), characterSheetSystemDnd5e) {
			return characterSheetSystemDnd5e, 0.98
		}
	case characterSheetSystemCoC7:
		if strings.EqualFold(strings.TrimSpace(systemHint), characterSheetSystemCoC7) {
			return characterSheetSystemCoC7, 0.98
		}
	}
	if regexp.MustCompile(`(?i)\.dst\b`).MatchString(text) {
		return characterSheetSystemDnd5e, 0.98
	}
	if regexp.MustCompile(`(?i)\.st\b`).MatchString(text) {
		return characterSheetSystemCoC7, 0.98
	}

	cocScore := countNumericImportFields(text, [][]string{
		{"pow", "意志"},
		{"app", "外貌"},
		{"edu", "教育", "教养"},
		{"siz", "体型"},
		{"san", "san值", "理智", "理智值"},
		{"幸运", "运气"},
		{"mp", "魔法", "魔法值"},
	}) * 2
	cocScore += countNumericImportFields(text, [][]string{
		{"会计"}, {"人类学"}, {"估价"}, {"考古学"}, {"取悦", "魅惑"},
		{"攀爬"}, {"计算机", "计算机使用", "电脑"}, {"信用", "信誉", "信用评级"},
		{"克苏鲁", "克苏鲁神话", "cm"}, {"乔装"}, {"闪避"}, {"汽车驾驶"},
		{"电气维修"}, {"电子学"}, {"话术"}, {"斗殴"}, {"手枪"}, {"急救"},
		{"恐吓"}, {"图书馆", "图书馆使用"}, {"聆听"}, {"开锁", "撬锁"},
		{"机械维修"}, {"医学"}, {"博物学"}, {"领航"}, {"神秘学"},
		{"说服"}, {"精神分析"}, {"心理学"}, {"骑术"}, {"妙手"}, {"侦查"},
		{"潜行"}, {"游泳"}, {"投掷"}, {"追踪"},
	})

	dndScore := countNumericImportFields(text, [][]string{
		{"wis", "感知"},
		{"cha", "魅力"},
		{"ac", "护甲等级"},
		{"hpmax"},
		{"熟练", "熟练加值", "proficiency"},
		{"等级", "level", "lv"},
		{"法术豁免dc", "豁免dc", "spell save dc"},
		{"法术攻击", "spell attack"},
	}) * 2
	dndScore += countNumericImportFields(text, [][]string{
		{"运动"}, {"体操"}, {"巧手"}, {"隐匿"}, {"调查"}, {"奥秘"},
		{"自然"}, {"宗教"}, {"察觉"}, {"洞悉"}, {"驯兽"}, {"医药"},
		{"求生"}, {"游说"}, {"欺瞒"}, {"威吓"}, {"表演"},
	})
	for _, marker := range []string{"种族", "race", "阵营", "alignment", "subclass"} {
		if strings.Contains(strings.ToLower(text), strings.ToLower(marker)) {
			dndScore += 2
		}
	}

	if dndScore > cocScore {
		return characterSheetSystemDnd5e, importDetectionConfidence(dndScore - cocScore)
	}
	return characterSheetSystemCoC7, importDetectionConfidence(cocScore - dndScore)
}

func countNumericImportFields(text string, fieldGroups [][]string) int {
	count := 0
	for _, aliases := range fieldGroups {
		if _, ok := findSignedIntValue(text, aliases...); ok {
			count++
		}
	}
	return count
}

func importDetectionConfidence(scoreDifference int) float64 {
	return minFloat(0.96, 0.72+float64(scoreDifference)*0.04)
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func inferLevelFromProficiencyBonus(proficiencyBonus int) int {
	switch {
	case proficiencyBonus <= 2:
		return 1
	case proficiencyBonus == 3:
		return 5
	case proficiencyBonus == 4:
		return 9
	case proficiencyBonus == 5:
		return 13
	default:
		return 17
	}
}

func getDndSpellcastingAbilityByClass(className string) string {
	trimmed := strings.TrimSpace(className)
	if ability, ok := dndClassSpellAbility[trimmed]; ok {
		return ability
	}
	if ability, ok := dndClassSpellAbility[strings.ToLower(trimmed)]; ok {
		return ability
	}
	return "INT"
}

func buildDefaultDndSkills() map[string]any {
	result := make(map[string]any, len(dndSkillDefinitions))
	for _, skill := range dndSkillDefinitions {
		result[skill.Name] = 0
	}
	return result
}

func cocCanonicalSkillName(name string) string {
	trimmed := strings.TrimSpace(name)
	for canonical, aliases := range cocSkillAliasMap {
		if trimmed == canonical {
			return canonical
		}
		for _, alias := range aliases {
			if trimmed == alias {
				return canonical
			}
		}
	}
	return trimmed
}

func upsertCoCSkill(skills *[]map[string]any, name string, value int) {
	canonical := cocCanonicalSkillName(name)
	if canonical == "" {
		return
	}
	for index := range *skills {
		if strings.TrimSpace(getStringFromAny((*skills)[index]["name"])) == canonical {
			(*skills)[index]["value"] = value
			return
		}
	}
	*skills = append(*skills, map[string]any{"name": canonical, "value": value})
}

func getStringFromAny(value any) string {
	if str, ok := value.(string); ok {
		return strings.TrimSpace(str)
	}
	return ""
}

func fillCoCImportPreview(text string, preview *CharacterSheetImportPreview) {
	compactPairs := findCompactLabelValuePairs(text)
	isCompactSt := regexp.MustCompile(`(?i)\.st\b`).MatchString(text) ||
		countNumericImportFields(text, cocCompactSkillFieldGroups()) > 0 ||
		len(compactPairs) >= 2
	preview.Name = firstNonEmpty(
		findBracketedName(text),
		findLineValue(text, "姓名", "名称", "角色名", "调查员", "name"),
		findInlineStringValue(text, []string{"姓名", "名称", "角色名", "调查员", "name"}),
	)
	occupation := firstNonEmpty(
		findLineValue(text, "职业", "occupation"),
		findInlineStringValue(text, []string{"职业", "occupation"}),
	)

	stats := map[string]int{}
	for _, segment := range cocExportSegments {
		if value, ok := findIntValue(text, segment.Labels...); ok {
			stats[segment.Key] = value
		}
	}

	derived := map[string]any{}
	if current, max, ok := findPairValue(text, "hp", "生命", "体力"); ok {
		derived["hp"] = map[string]any{"current": current, "max": max}
	}
	if current, max, ok := findPairValue(text, "san", "理智"); ok {
		derived["san"] = map[string]any{"current": current, "max": max}
	}
	if current, max, ok := findPairValue(text, "mp", "魔法", "魔法值"); ok {
		derived["mp"] = map[string]any{"current": current, "max": max}
	}
	if value, ok := findIntValue(text, "幸运", "luck"); ok {
		derived["luck"] = value
	}
	if value, ok := findIntValue(text, "mov", "移动率", "移动力"); ok {
		derived["mov"] = value
	}
	if value := firstNonEmpty(
		findLineValue(text, "伤害加值", "db"),
		findInlineStringValue(text, []string{"伤害加值", "db"}),
	); value != "" {
		derived["damageBonus"] = value
	}
	if value := firstNonEmpty(
		findLineValue(text, "体格", "build"),
		findInlineStringValue(text, []string{"体格", "build"}),
	); value != "" {
		derived["build"] = value
	}

	skills := []map[string]any{}
	if isCompactSt {
		for canonical, aliases := range cocSkillAliasMap {
			if value, ok := findIntValue(text, aliases...); ok {
				upsertCoCSkill(&skills, canonical, value)
			}
		}
		for _, pair := range compactPairs {
			if isReservedCoCCompactLabel(pair.Name) {
				continue
			}
			upsertCoCSkill(&skills, pair.Name, pair.Value)
		}
	}
	normalSkillMatches := regexp.MustCompile(`(?m)([\p{Han}A-Za-z]+(?::[\p{Han}A-Za-z]+)?)\s*[:：]\s*(\d+)`).FindAllStringSubmatch(text, -1)
	reserved := map[string]bool{
		"力量": true, "敏捷": true, "体质": true, "体型": true, "外貌": true, "智力": true, "意志": true, "教育": true,
		"幸运": true, "运气": true, "DB": true, "db": true, "体格": true, "移动力": true, "移动率": true,
		"理智": true, "理智值": true, "生命": true, "体力": true, "魔法": true, "护甲": true,
		"姓名": true, "名称": true, "角色名": true, "调查员": true, "职业": true,
	}
	for _, match := range normalSkillMatches {
		if len(match) < 3 {
			continue
		}
		skillName := strings.TrimSpace(match[1])
		if reserved[skillName] {
			continue
		}
		skillValue, err := strconv.Atoi(match[2])
		if err != nil {
			continue
		}
		upsertCoCSkill(&skills, skillName, skillValue)
	}

	preview.Payload.CoC7 = map[string]any{
		"occupation": occupation,
		"stats":      stats,
		"derived":    derived,
		"skills":     skills,
	}

	if occupation != "" {
		preview.Summary = fmt.Sprintf("职业：%s", occupation)
	}
	if preview.Name == "" {
		preview.MissingFields = append(preview.MissingFields, "姓名")
	}
	for _, field := range []string{"str", "con", "siz", "dex", "app", "int", "pow", "edu"} {
		if _, ok := stats[field]; !ok {
			preview.MissingFields = append(preview.MissingFields, strings.ToUpper(field))
		}
	}
	if len(stats) < 4 {
		preview.Warnings = append(preview.Warnings, "当前 CoC 数值识别较少，建议导入后手动复核。")
	}
}

func fillDndImportPreview(text string, preview *CharacterSheetImportPreview) {
	preview.Name = firstNonEmpty(
		findBracketedName(text),
		findLineValue(text, "姓名", "名称", "角色名", "角色名称", "name"),
		findInlineStringValue(text, []string{"姓名", "名称", "角色名", "角色名称", "name"}),
	)
	race := firstNonEmpty(findLineValue(text, "种族", "race"), findInlineStringValue(text, []string{"种族", "race"}))
	className := firstNonEmpty(findLineValue(text, "职业", "class", "职业名称"), findInlineStringValue(text, []string{"职业", "class", "职业名称"}))
	subclass := firstNonEmpty(findLineValue(text, "子职业", "subclass"), findInlineStringValue(text, []string{"子职业", "subclass"}))
	alignment := firstNonEmpty(findLineValue(text, "阵营", "alignment"), findInlineStringValue(text, []string{"阵营", "alignment"}))

	stats := map[string]int{}
	for key, aliases := range map[string][]string{
		"str": {"str", "力量"},
		"dex": {"dex", "敏捷"},
		"con": {"con", "体质"},
		"int": {"int", "智力"},
		"wis": {"wis", "感知"},
		"cha": {"cha", "魅力"},
	} {
		if value, ok := findIntValue(text, aliases...); ok {
			stats[key] = value
		}
	}

	derived := map[string]any{}
	if value, ok := findIntValue(text, "ac", "护甲等级"); ok {
		derived["ac"] = value
	}
	if value, ok := findIntValue(text, "先攻", "initiative"); ok {
		derived["initiative"] = value
	}
	if value := firstNonEmpty(findLineValue(text, "速度", "speed"), findInlineStringValue(text, []string{"速度", "speed"})); value != "" {
		derived["speed"] = value
	}
	if current, max, ok := findPairValue(text, "hp", "生命", "生命值"); ok {
		derived["hp"] = map[string]any{"current": current, "max": max, "temporary": 0}
	}
	if value, ok := findIntValue(text, "被动察觉", "passive perception"); ok {
		derived["passivePerception"] = value
	}
	if value, ok := findIntValue(text, "法术豁免dc", "豁免dc", "spell save dc"); ok {
		derived["spellSaveDc"] = value
	}
	if value, ok := findSignedIntValue(text, "法术攻击", "spell attack"); ok {
		derived["spellAttackBonus"] = value
	}
	if value := firstNonEmpty(findLineValue(text, "施法属性", "spellcasting ability"), findInlineStringValue(text, []string{"施法属性", "spellcasting ability"})); value != "" {
		derived["spellcastingAbility"] = value
	}

	payload := map[string]any{
		"race":      race,
		"className": className,
		"subclass":  subclass,
		"alignment": alignment,
		"stats":     stats,
		"derived":   derived,
		"skills":    buildDefaultDndSkills(),
	}
	if value, ok := findIntValue(text, "等级", "level", "lv"); ok {
		payload["level"] = value
	}
	if value, ok := findSignedIntValue(text, "熟练", "熟练加值", "proficiency"); ok {
		payload["proficiencyBonus"] = value
		payload["level"] = inferLevelFromProficiencyBonus(value)
	}
	if value, ok := findIntValue(text, "hpmax"); ok {
		derived["hp"] = map[string]any{"current": value, "max": value, "temporary": 0}
	} else if current, max, ok := findPairValue(text, "hp", "生命", "生命值"); ok {
		derived["hp"] = map[string]any{"current": current, "max": max, "temporary": 0}
	} else if value, ok := findIntValue(text, "hp"); ok {
		derived["hp"] = map[string]any{"current": value, "max": value, "temporary": 0}
	}
	if getStringFromAny(derived["spellcastingAbility"]) == "" && className != "" {
		derived["spellcastingAbility"] = getDndSpellcastingAbilityByClass(className)
	}

	dndSkills := buildDefaultDndSkills()
	for _, skill := range dndSkillDefinitions {
		if value, ok := readDndImportSkillState(
			text,
			skill.Name,
			skill.Ability,
			stats,
			getIntFromAny(payload["proficiencyBonus"], 2),
		); ok {
			dndSkills[skill.Name] = value
		}
	}
	payload["skills"] = dndSkills
	preview.Payload.Dnd5e = payload

	if className != "" || race != "" {
		preview.Summary = strings.TrimSpace(fmt.Sprintf("%s %s", race, className))
	}
	if preview.Name == "" {
		preview.MissingFields = append(preview.MissingFields, "姓名")
	}
	for _, field := range []string{"str", "dex", "con", "int", "wis", "cha"} {
		if _, ok := stats[field]; !ok {
			preview.MissingFields = append(preview.MissingFields, strings.ToUpper(field))
		}
	}
	if len(stats) < 4 {
		preview.Warnings = append(preview.Warnings, "当前 DND 数值识别较少，建议导入后手动复核。")
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func findLineValue(text string, aliases ...string) string {
	pattern := fmt.Sprintf(`(?im)^\s*(?:%s)\s*[:：=]\s*([^\r\n]+?)\s*$`, joinAliases(aliases))
	matches := regexp.MustCompile(pattern).FindStringSubmatch(text)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

func findInlineStringValue(text string, aliases []string) string {
	pattern := fmt.Sprintf(`(?im)(?:^|[\s,，;；|/])(?:%s)\s*[:：=]?\s*([^\s,，;；|/]+)`, joinAliases(aliases))
	matches := regexp.MustCompile(pattern).FindStringSubmatch(text)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

func findIntValue(text string, aliases ...string) (int, bool) {
	for _, pattern := range []string{
		fmt.Sprintf(`(?im)(?:^|[\s,，;；|/])(?:%s)\s*[:：=]?\s*(-?\d{1,3})(?:$|[\s,，;；|/])`, joinAliases(aliases)),
		fmt.Sprintf(`(?im)(?:%s)\s*[:：=]?\s*(-?\d{1,3})`, joinAliases(aliases)),
	} {
		matches := regexp.MustCompile(pattern).FindStringSubmatch(text)
		if len(matches) <= 1 {
			continue
		}
		value, err := strconv.Atoi(matches[1])
		return value, err == nil
	}
	return 0, false
}

func findSignedIntValue(text string, aliases ...string) (int, bool) {
	for _, pattern := range []string{
		fmt.Sprintf(`(?im)(?:^|[\s,，;；|/])(?:%s)\s*[:：=]?\s*([+-]?\d{1,3})(?:$|[\s,，;；|/])`, joinAliases(aliases)),
		fmt.Sprintf(`(?im)(?:%s)\s*[:：=]?\s*([+-]?\d{1,3})`, joinAliases(aliases)),
	} {
		matches := regexp.MustCompile(pattern).FindStringSubmatch(text)
		if len(matches) <= 1 {
			continue
		}
		value, err := strconv.Atoi(matches[1])
		return value, err == nil
	}
	return 0, false
}

func findPairValue(text string, aliases ...string) (int, int, bool) {
	for _, pattern := range []string{
		fmt.Sprintf(`(?im)(?:^|[\s,，;；|/])(?:%s)\s*[:：=]?\s*(\d{1,3})(?:\s*[/／]\s*(\d{1,3}))?`, joinAliases(aliases)),
		fmt.Sprintf(`(?im)(?:%s)\s*[:：=]?\s*(\d{1,3})(?:\s*[/／]\s*(\d{1,3}))?`, joinAliases(aliases)),
	} {
		matches := regexp.MustCompile(pattern).FindStringSubmatch(text)
		if len(matches) <= 1 {
			continue
		}
		current, err := strconv.Atoi(matches[1])
		if err != nil {
			continue
		}
		max := current
		if len(matches) > 2 && strings.TrimSpace(matches[2]) != "" {
			if parsedMax, err := strconv.Atoi(matches[2]); err == nil {
				max = parsedMax
			}
		}
		return current, max, true
	}
	return 0, 0, false
}

func readImportSkillState(text, skillName string) (float64, bool) {
	escaped := regexp.QuoteMeta(strings.TrimSpace(skillName))
	if escaped == "" {
		return 0, false
	}
	pattern := fmt.Sprintf(`(?im)%s(?:\s*(\*0\.5|\*|0\.5))?\s*[:=]\s*-?\d+(?:\[[^\]]*\])?`, escaped)
	matches := regexp.MustCompile(pattern).FindStringSubmatch(text)
	if len(matches) == 0 {
		return 0, false
	}
	switch matches[1] {
	case "*0.5", "0.5":
		return 0.5, true
	case "*":
		return 1, true
	default:
		return 0, false
	}
}

func readDndImportSkillState(
	text string,
	skillName string,
	ability string,
	stats map[string]int,
	proficiencyBonus int,
) (float64, bool) {
	if state, ok := readImportSkillState(text, skillName); ok {
		return state, true
	}
	total, ok := findSignedIntValue(text, skillName)
	if !ok {
		return 0, false
	}
	abilityScore, hasAbility := stats[ability]
	if !hasAbility {
		return 0, true
	}
	abilityModifier := int(math.Floor(float64(abilityScore-10) / 2))
	switch total - abilityModifier {
	case proficiencyBonus:
		return 1, true
	case int(math.Floor(float64(proficiencyBonus) / 2)):
		return 0.5, true
	default:
		return 0, true
	}
}

func getIntFromAny(value any, fallback int) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return fallback
	}
}

func cocCompactSkillFieldGroups() [][]string {
	groups := make([][]string, 0, len(cocSkillAliasMap))
	for _, aliases := range cocSkillAliasMap {
		groups = append(groups, aliases)
	}
	return groups
}

type compactLabelValuePair struct {
	Name  string
	Value int
}

func findCompactLabelValuePairs(text string) []compactLabelValuePair {
	matches := regexp.MustCompile(`(?i)([\p{Han}A-Za-z]+(?::[\p{Han}A-Za-z]+)?)\s*([+-]?\d{1,3})`).
		FindAllStringSubmatch(text, -1)
	result := make([]compactLabelValuePair, 0, len(matches))
	for _, match := range matches {
		if len(match) < 3 {
			continue
		}
		value, err := strconv.Atoi(match[2])
		if err != nil {
			continue
		}
		result = append(result, compactLabelValuePair{
			Name:  strings.TrimSpace(match[1]),
			Value: value,
		})
	}
	return result
}

func isReservedCoCCompactLabel(label string) bool {
	reservedGroups := make([][]string, 0, len(cocExportSegments)+len(cocExportStatusSegments)+4)
	for _, segment := range cocExportSegments {
		reservedGroups = append(reservedGroups, segment.Labels)
	}
	for _, segment := range cocExportStatusSegments {
		reservedGroups = append(reservedGroups, segment.Labels)
	}
	reservedGroups = append(reservedGroups,
		[]string{"mov", "移动率", "移动力"},
		[]string{"db", "伤害加值"},
		[]string{"build", "体格"},
		[]string{"护甲", "年龄"},
	)
	for _, aliases := range reservedGroups {
		for _, alias := range aliases {
			if strings.EqualFold(strings.TrimSpace(label), strings.TrimSpace(alias)) {
				return true
			}
		}
	}
	return false
}

func findBracketedName(text string) string {
	for _, pattern := range []string{
		`<([^>\r\n]+)>`,
		`《([^》\r\n]+)》`,
	} {
		matches := regexp.MustCompile(pattern).FindStringSubmatch(text)
		if len(matches) > 1 {
			return strings.TrimSpace(matches[1])
		}
	}
	return ""
}

func joinAliases(aliases []string) string {
	items := make([]string, 0, len(aliases))
	for _, alias := range aliases {
		trimmed := strings.TrimSpace(alias)
		if trimmed == "" {
			continue
		}
		items = append(items, regexp.QuoteMeta(trimmed))
	}
	if len(items) == 0 {
		return "$.^"
	}
	return strings.Join(items, "|")
}
