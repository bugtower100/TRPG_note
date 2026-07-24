package main

import "testing"

func TestPreviewCharacterSheetImportParsesCoCInlineAbbreviationText(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: "调查员 阿卡姆 职业 私家侦探 STR 70 CON 55 SIZ 60 DEX 65 APP 50 INT 80 POW 60 EDU 75 SAN 60/99 HP 11/11 MP 12/12 幸运 45",
	})

	if preview.System != characterSheetSystemCoC7 {
		t.Fatalf("expected coc7, got %s", preview.System)
	}
	if preview.Name != "阿卡姆" {
		t.Fatalf("expected name 阿卡姆, got %q", preview.Name)
	}
	stats := preview.Payload.CoC7["stats"].(map[string]int)
	if stats["str"] != 70 || stats["edu"] != 75 {
		t.Fatalf("unexpected coc stats: %#v", stats)
	}
	derived := preview.Payload.CoC7["derived"].(map[string]any)
	if derived["luck"] != 45 {
		t.Fatalf("expected luck 45, got %#v", derived["luck"])
	}
	skills := preview.Payload.CoC7["skills"].([]map[string]any)
	if len(skills) != 0 {
		t.Fatalf("expected no skill rows in inline abbreviation sample, got %#v", skills)
	}
}

func TestPreviewCharacterSheetImportParsesCoCChineseText(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: "姓名：林雾\n职业：记者\n力量 55 体质 60 体型 65 敏捷 70 外貌 45 智力 80 意志 60 教养 75\n理智 60/99 生命 12/12 魔法值 12/12 幸运 40 伤害加值 0 体格 0 移动率 8",
	})

	if preview.System != characterSheetSystemCoC7 {
		t.Fatalf("expected coc7, got %s", preview.System)
	}
	stats := preview.Payload.CoC7["stats"].(map[string]int)
	if stats["siz"] != 65 || stats["edu"] != 75 {
		t.Fatalf("unexpected coc chinese stats: %#v", stats)
	}
}

func TestPreviewCharacterSheetImportParsesCoCBlockStyleText(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: `<哈尔克·齐亚特>的个人属性为:
力量:60 	 敏捷:70 	 体质:60 	 体型:60
外貌:55 	 智力:80 	 意志:47 	 教育:90
幸运:70 	 DB:0 	 体格:0 	 移动力:8
理智:20/49 	 生命:7/12 	 魔法:9/9 	 护甲:0`,
	})

	if preview.Name != "哈尔克·齐亚特" {
		t.Fatalf("expected bracketed name, got %q", preview.Name)
	}
	stats := preview.Payload.CoC7["stats"].(map[string]int)
	if stats["dex"] != 70 || stats["pow"] != 47 || stats["edu"] != 90 {
		t.Fatalf("unexpected coc block stats: %#v", stats)
	}
	derived := preview.Payload.CoC7["derived"].(map[string]any)
	if derived["mov"] != 8 || derived["damageBonus"] != "0" {
		t.Fatalf("unexpected coc block derived: %#v", derived)
	}
}

func TestPreviewCharacterSheetImportParsesCoCBlockSkillsWithoutOccupationWarning(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: `<哈维>的个人属性为:
力量:60 敏捷:70 体质:60 体型:60
外貌:55 智力:80 意志:47 教育:90
理智:20/49 生命:7/12 魔法:9/9 幸运:70
图书馆使用:80
聆听:55
侦查:65`,
	})

	skills := preview.Payload.CoC7["skills"].([]map[string]any)
	if len(skills) != 3 {
		t.Fatalf("expected 3 coc skills, got %#v", skills)
	}
	for _, warning := range preview.Warnings {
		if warning == "未识别到职业字段。" {
			t.Fatalf("unexpected occupation warning: %#v", preview.Warnings)
		}
	}
}

func TestPreviewCharacterSheetImportParsesCoCCompactStText(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: ".st 力量40str40敏捷70dex70意志60pow60体质80con80外貌50app50教育70edu70体型40siz40智力70灵感70int70san60san值60理智60理智值60幸运65运气65mp12魔法12hp12体力12会计5人类学16估价5考古学41取悦15魅惑15攀爬20计算机5计算机使用5电脑5信用0信誉0信用评级0克苏鲁7克苏鲁神话7cm7乔装5闪避50",
	})

	if preview.System != characterSheetSystemCoC7 {
		t.Fatalf("expected coc7, got %s", preview.System)
	}
	stats := preview.Payload.CoC7["stats"].(map[string]int)
	if stats["str"] != 40 || stats["dex"] != 70 || stats["edu"] != 70 || stats["siz"] != 40 {
		t.Fatalf("unexpected coc compact stats: %#v", stats)
	}
	derived := preview.Payload.CoC7["derived"].(map[string]any)
	hp := derived["hp"].(map[string]any)
	if hp["current"] != 12 || hp["max"] != 12 {
		t.Fatalf("unexpected hp from compact text: %#v", hp)
	}
	skills := preview.Payload.CoC7["skills"].([]map[string]any)
	if len(skills) == 0 {
		t.Fatalf("expected compact coc text to produce skills, got none")
	}
}

func TestPreviewCharacterSheetImportParsesCoCCompactTextWithoutStPrefix(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: "力量40敏捷70意志60体质80外貌50教育70体型40智力70理智60幸运65魔法12体力12会计35人类学16考古学41闪避50",
	})

	if preview.System != characterSheetSystemCoC7 {
		t.Fatalf("expected coc7, got %s", preview.System)
	}
	stats := preview.Payload.CoC7["stats"].(map[string]int)
	if stats["str"] != 40 || stats["pow"] != 60 || stats["edu"] != 70 {
		t.Fatalf("unexpected coc compact stats without prefix: %#v", stats)
	}
	skills := preview.Payload.CoC7["skills"].([]map[string]any)
	if len(skills) < 4 {
		t.Fatalf("expected compact coc skills without prefix, got %#v", skills)
	}
}

func TestPreviewCharacterSheetImportParsesCustomCompactSkillsWithoutStPrefix(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: "技能11二号技能13",
	})

	if preview.System != characterSheetSystemCoC7 {
		t.Fatalf("expected ambiguous compact custom skills to use coc7 default, got %s", preview.System)
	}
	skills := preview.Payload.CoC7["skills"].([]map[string]any)
	if len(skills) != 2 {
		t.Fatalf("expected 2 custom compact skills, got %#v", skills)
	}
	if skills[0]["name"] != "技能" || skills[0]["value"] != 11 {
		t.Fatalf("unexpected first custom skill: %#v", skills[0])
	}
	if skills[1]["name"] != "二号技能" || skills[1]["value"] != 13 {
		t.Fatalf("unexpected second custom skill: %#v", skills[1])
	}
}

func TestPreviewCharacterSheetImportParsesDndEnglishAbbreviationText(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: "Name Laila Race Human Class Cleric Level 3 STR 16 DEX 14 CON 12 INT 10 WIS 15 CHA 8 AC 16 HP 22/22 Proficiency +2",
	})

	if preview.System != characterSheetSystemDnd5e {
		t.Fatalf("expected dnd5e, got %s", preview.System)
	}
	if preview.Name != "Laila" {
		t.Fatalf("expected name Laila, got %q", preview.Name)
	}
	stats := preview.Payload.Dnd5e["stats"].(map[string]int)
	if stats["wis"] != 15 || stats["cha"] != 8 {
		t.Fatalf("unexpected dnd english stats: %#v", stats)
	}
	skills := preview.Payload.Dnd5e["skills"].(map[string]any)
	if skills["运动"] != 0 {
		t.Fatalf("expected default dnd skill state 0, got %#v", skills["运动"])
	}
}

func TestPreviewCharacterSheetImportParsesDndChineseCompactText(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: "姓名 莱拉 种族 人类 职业 牧师 等级 3 力量 16 敏捷 14 体质 12 智力 10 感知 15 魅力 8 护甲等级 16 生命值 22/22 熟练加值 +2",
	})

	if preview.System != characterSheetSystemDnd5e {
		t.Fatalf("expected dnd5e, got %s", preview.System)
	}
	if preview.Name != "莱拉" {
		t.Fatalf("expected name 莱拉, got %q", preview.Name)
	}
	stats := preview.Payload.Dnd5e["stats"].(map[string]int)
	if stats["str"] != 16 || stats["wis"] != 15 {
		t.Fatalf("unexpected dnd chinese stats: %#v", stats)
	}
}

func TestPreviewCharacterSheetImportParsesDndSkillStates(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: ".dst 力量:16 敏捷:14 体质:12 智力:10 感知:15 魅力:8 hpmax:22 熟练:2 运动*:0 历史*0.5:0 察觉:0",
	})

	if preview.System != characterSheetSystemDnd5e {
		t.Fatalf("expected dnd5e, got %s", preview.System)
	}
	skills := preview.Payload.Dnd5e["skills"].(map[string]any)
	if skills["运动"] != 1.0 || skills["历史"] != 0.5 || skills["察觉"] != 0.0 {
		t.Fatalf("unexpected dnd skill states: %#v", skills)
	}
}

func TestPreviewCharacterSheetImportParsesDndSkillStatesWithoutClassAndHalfMarkerStar(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: ".dst 力量:10 体质:14 敏捷:12 智力:16 感知:8 魅力:10 hp:20 hpmax:20 熟练:2 ac:15 dc:13 运动:0 体操0.5:0 巧手:0 隐匿:0 调查:0 奥秘:0 历史:0 自然:0 宗教:0 察觉:0 洞悉:0 驯兽:0 医药:0 求生:0 游说:0 欺瞒:0 威吓:0 表演:0",
	})

	if preview.System != characterSheetSystemDnd5e {
		t.Fatalf("expected dnd5e, got %s", preview.System)
	}
	if preview.Payload.Dnd5e["className"] != "" {
		t.Fatalf("expected empty class name to remain empty, got %#v", preview.Payload.Dnd5e["className"])
	}
	skills := preview.Payload.Dnd5e["skills"].(map[string]any)
	if skills["体操"] != 0.5 || skills["运动"] != 0.0 || skills["表演"] != 0.0 {
		t.Fatalf("unexpected dnd skill states without class: %#v", skills)
	}
	for _, warning := range preview.Warnings {
		if warning == "未识别到职业字段。" {
			t.Fatalf("unexpected class warning: %#v", preview.Warnings)
		}
	}
}

func TestPreviewCharacterSheetImportParsesDndCompactTextWithoutDstPrefix(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text: "力量16敏捷14体质12智力10感知15魅力8护甲等级16生命值22熟练加值2运动5历史2察觉4",
	})

	if preview.System != characterSheetSystemDnd5e {
		t.Fatalf("expected dnd5e, got %s", preview.System)
	}
	stats := preview.Payload.Dnd5e["stats"].(map[string]int)
	if stats["str"] != 16 || stats["wis"] != 15 || stats["cha"] != 8 {
		t.Fatalf("unexpected dnd compact stats without prefix: %#v", stats)
	}
	skills := preview.Payload.Dnd5e["skills"].(map[string]any)
	if skills["运动"] != 1.0 || skills["历史"] != 1.0 || skills["察觉"] != 1.0 {
		t.Fatalf("unexpected inferred dnd skill states without prefix: %#v", skills)
	}
}

func TestPreviewCharacterSheetImportHonorsSystemHint(t *testing.T) {
	preview := previewCharacterSheetImport(CharacterSheetImportPreviewRequest{
		Text:       "职业 牧师 力量 16 敏捷 14 体质 12 智力 10 感知 15 魅力 8",
		SystemHint: characterSheetSystemDnd5e,
	})

	if preview.System != characterSheetSystemDnd5e {
		t.Fatalf("expected dnd5e with system hint, got %s", preview.System)
	}
	stats := preview.Payload.Dnd5e["stats"].(map[string]int)
	if len(stats) != 6 {
		t.Fatalf("expected all dnd stats to be parsed, got %#v", stats)
	}
}
