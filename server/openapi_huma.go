package main

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
)

type humaIdentityHeaders struct {
	UserID   string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username string `header:"X-TRPG-Username" doc:"当前用户名"`
}

type humaMigrationStatusOutput struct {
	Body MigrationStatusResponse
}

type humaStartMigrationOutput struct {
	Body StartMigrationResponse
}

type humaListCampaignsInput struct {
	UserID   string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username string `header:"X-TRPG-Username" doc:"当前用户名"`
}

type humaListCampaignsOutput struct {
	Body []V2CampaignSummary
}

type humaCreateCampaignInput struct {
	UserID   string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username string `header:"X-TRPG-Username" doc:"当前用户名"`
	Body     V2CreateCampaignRequest
}

type humaCreateCampaignOutput struct {
	Body V2CreateCampaignResponse
}

type humaDeleteCampaignInput struct {
	UserID     string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username   string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignID string `path:"campaignId" doc:"模组 ID"`
}

type humaDeleteCampaignOutput struct{}

type humaGetBundleInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
}

type humaGetBundleOutput struct {
	Body V2CampaignBundleResponse
}

type humaUpdateBundleInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
	Body             V2CampaignBundleUpdateRequest
}

type humaUpdateBundleOutput struct {
	Body V2CampaignBundleResponse
}

type humaGetMindMapHistoryInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
}

type humaGetMindMapHistoryOutput struct {
	Body MindMapHistoryDocument
}

type humaUpdateMindMapHistoryInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
	Body             MindMapHistoryUpdateRequest
}

type humaUpdateMindMapHistoryOutput struct {
	Body MindMapHistoryDocument
}

type humaGetCampaignConfigInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
}

type humaGetCampaignConfigOutput struct {
	Body CampaignConfigDoc
}

type humaListPublicCampaignsInput struct {
	UserID   string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username string `header:"X-TRPG-Username" doc:"当前用户名"`
}

type humaListPublicCampaignsOutput struct {
	Body []PublicCampaignSummary
}

type humaListTeamNotesInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
}

type humaListTeamNotesOutput struct {
	Body []TeamNoteDoc
}

type humaListSharesInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
	View             string `query:"view" doc:"读取视图，received 为收到的分享，managed 为 GM 管理视图"`
}

type humaListSharesOutput struct {
	Body []SharedEntityRecord
}

type humaListVersionsInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
}

type humaListVersionsOutput struct {
	Body []VersionRecord
}

type humaGetSessionTasksInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
}

type humaGetSessionTasksOutput struct {
	Body SessionTaskBoardDoc
}

type humaListCharacterSheetsInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
}

type humaListCharacterSheetsOutput struct {
	Body []CharacterSheetSummary
}

type humaCreateCharacterSheetInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
	Body             CharacterSheetCreateRequest
}

type humaCreateCharacterSheetOutput struct {
	Body CharacterSheetDocument
}

type humaPreviewCharacterSheetImportInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
	Body             CharacterSheetImportPreviewRequest
}

type humaPreviewCharacterSheetImportOutput struct {
	Body CharacterSheetImportPreview
}

type humaGetCharacterSheetInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
	SheetID          string `path:"sheetId" doc:"角色卡 ID"`
}

type humaGetCharacterSheetOutput struct {
	Body CharacterSheetDocument
}

type humaUpdateCharacterSheetInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
	SheetID          string `path:"sheetId" doc:"角色卡 ID"`
	Body             CharacterSheetUpdateRequest
}

type humaUpdateCharacterSheetOutput struct {
	Body CharacterSheetDocument
}

type humaDeleteCharacterSheetInput struct {
	UserID           string `header:"X-TRPG-User-Id" doc:"当前用户 ID"`
	Username         string `header:"X-TRPG-Username" doc:"当前用户名"`
	CampaignPassword string `header:"X-TRPG-Campaign-Password" doc:"公开模组进入密码，只有需要时才传"`
	CampaignID       string `path:"campaignId" doc:"模组 ID"`
	SheetID          string `path:"sheetId" doc:"角色卡 ID"`
}

type humaDeleteCharacterSheetOutput struct{}

func buildPhase1OpenAPISpec() ([]byte, error) {
	docRouter := gin.New()
	config := huma.DefaultConfig("TRPG Module Notes API", appVersion)
	config.Info.Description = "Phase 1 V2 migration and campaign bundle contract. Runtime business logic remains on Gin handlers; Huma is introduced here to generate OpenAPI incrementally."
	config.Tags = []*huma.Tag{
		{Name: "system", Description: "启动期迁移与系统状态"},
		{Name: "campaigns-v2", Description: "V2 主模组列表、创建、删除与 bundle 读写"},
		{Name: "campaigns-collaboration", Description: "协作配置、团队笔记、共享内容、版本记录与任务看板读取契约"},
	}

	api := humagin.New(docRouter, config)
	registerPhase1OpenAPIOperations(api)

	return json.MarshalIndent(api.OpenAPI(), "", "  ")
}

func registerOpenAPISpecRoutes(router *gin.Engine) error {
	openAPIBytes, err := buildPhase1OpenAPISpec()
	if err != nil {
		return err
	}

	router.GET("/openapi.json", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/json; charset=utf-8", openAPIBytes)
	})
	router.GET("/api/openapi.json", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/json; charset=utf-8", openAPIBytes)
	})
	return nil
}

func registerPhase1OpenAPIOperations(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getMigrationStatus",
		Method:      http.MethodGet,
		Path:        "/api/system/migration/status",
		Summary:     "获取迁移状态",
		Description: "启动期检查数据库 schema 与迁移状态。若 `canEnterApp` 为 false，前端必须停留在迁移界面，不得进入主应用。",
		Tags:        []string{"system"},
		Errors:      []int{500},
	}, func(context.Context, *struct{}) (*humaMigrationStatusOutput, error) {
		return &humaMigrationStatusOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "startMigration",
		Method:      http.MethodPost,
		Path:        "/api/system/migration/start",
		Summary:     "显式开始迁移",
		Description: "显式执行旧数据库到 V2 的迁移。禁止静默 fallback，失败时前端必须停留在迁移壳层。",
		Tags:        []string{"system"},
		Errors:      []int{409, 500},
	}, func(context.Context, *struct{}) (*humaStartMigrationOutput, error) {
		return &humaStartMigrationOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listV2Campaigns",
		Method:      http.MethodGet,
		Path:        "/api/v2/campaigns",
		Summary:     "获取当前用户可见的 V2 模组列表",
		Description: "列出当前用户可访问的 V2 主模组。正式主链路已切到后端，前端不得再依赖本地 campaign index。",
		Tags:        []string{"campaigns-v2"},
		Errors:      []int{400, 500},
	}, func(context.Context, *humaListCampaignsInput) (*humaListCampaignsOutput, error) {
		return &humaListCampaignsOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "createV2Campaign",
		Method:      http.MethodPost,
		Path:        "/api/v2/campaigns",
		Summary:     "创建 V2 模组",
		Description: "创建主模组，并同时初始化 owner 成员、配置与默认 bundle。",
		Tags:        []string{"campaigns-v2"},
		Errors:      []int{400, 500},
	}, func(context.Context, *humaCreateCampaignInput) (*humaCreateCampaignOutput, error) {
		return &humaCreateCampaignOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "deleteV2Campaign",
		Method:      http.MethodDelete,
		Path:        "/api/v2/campaigns/{campaignId}",
		Summary:     "删除 V2 模组",
		Description: "删除主模组及其 V2 文档、成员、配置和协作记录。",
		Tags:        []string{"campaigns-v2"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaDeleteCampaignInput) (*humaDeleteCampaignOutput, error) {
		return &humaDeleteCampaignOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getV2CampaignBundle",
		Method:      http.MethodGet,
		Path:        "/api/v2/campaigns/{campaignId}/bundle",
		Summary:     "获取模组 bundle",
		Description: "读取 V2 主模组的过渡 bundle 契约。前端当前 Context 已正式建立在该后端链路之上。",
		Tags:        []string{"campaigns-v2"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaGetBundleInput) (*humaGetBundleOutput, error) {
		return &humaGetBundleOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateV2CampaignBundle",
		Method:      http.MethodPut,
		Path:        "/api/v2/campaigns/{campaignId}/bundle",
		Summary:     "更新模组 bundle",
		Description: "使用 `expectedVersion` 执行显式乐观锁保存。发生冲突时返回 409，由前端显式处理。",
		Tags:        []string{"campaigns-v2"},
		Errors:      []int{400, 403, 409, 500},
	}, func(context.Context, *humaUpdateBundleInput) (*humaUpdateBundleOutput, error) {
		return &humaUpdateBundleOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getMindMapHistory",
		Method:      http.MethodGet,
		Path:        "/api/v2/campaigns/{campaignId}/mind-map-history",
		Summary:     "获取思维导图撤销历史",
		Description: "仅 GM 和副 GM 可读取。历史独立于普通模组 bundle 与导出文件。",
		Tags:        []string{"campaigns-v2"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaGetMindMapHistoryInput) (*humaGetMindMapHistoryOutput, error) {
		return &humaGetMindMapHistoryOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateMindMapHistory",
		Method:      http.MethodPut,
		Path:        "/api/v2/campaigns/{campaignId}/mind-map-history",
		Summary:     "更新思维导图撤销历史",
		Description: "仅 GM 和副 GM 可更新，使用独立版本号进行乐观锁保存。",
		Tags:        []string{"campaigns-v2"},
		Errors:      []int{400, 403, 409, 500},
	}, func(context.Context, *humaUpdateMindMapHistoryInput) (*humaUpdateMindMapHistoryOutput, error) {
		return &humaUpdateMindMapHistoryOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getCampaignConfig",
		Method:      http.MethodGet,
		Path:        "/api/campaigns/{campaignId}/config",
		Summary:     "获取模组协作配置",
		Description: "返回当前用户可见的模组配置与成员列表。公开模组在需要时可通过进入密码头访问。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaGetCampaignConfigInput) (*humaGetCampaignConfigOutput, error) {
		return &humaGetCampaignConfigOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listPublicCampaigns",
		Method:      http.MethodGet,
		Path:        "/api/campaigns/public",
		Summary:     "获取公开模组列表",
		Description: "列出当前所有公开模组摘要，用于主页公开模组列表与进入流程。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{500},
	}, func(context.Context, *humaListPublicCampaignsInput) (*humaListPublicCampaignsOutput, error) {
		return &humaListPublicCampaignsOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listTeamNotes",
		Method:      http.MethodGet,
		Path:        "/api/campaigns/{campaignId}/team-notes",
		Summary:     "获取团队笔记列表",
		Description: "读取模组下所有团队笔记，包含版本与当前租约状态。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaListTeamNotesInput) (*humaListTeamNotesOutput, error) {
		return &humaListTeamNotesOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listCampaignShares",
		Method:      http.MethodGet,
		Path:        "/api/campaigns/{campaignId}/shares",
		Summary:     "获取共享内容列表",
		Description: "按 received 或 managed 视图读取共享内容列表。GM 的 managed 视图返回管理中的全部分享记录。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaListSharesInput) (*humaListSharesOutput, error) {
		return &humaListSharesOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listCampaignVersions",
		Method:      http.MethodGet,
		Path:        "/api/campaigns/{campaignId}/versions",
		Summary:     "获取模组版本记录",
		Description: "读取团队笔记、任务看板与共享内容的历史版本记录。当前仅 GM 可访问。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaListVersionsInput) (*humaListVersionsOutput, error) {
		return &humaListVersionsOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getSessionTasks",
		Method:      http.MethodGet,
		Path:        "/api/campaigns/{campaignId}/session-tasks",
		Summary:     "获取任务看板",
		Description: "读取任务看板文档及其查看/编辑权限。若 PL 被禁止查看，运行时将返回 403。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaGetSessionTasksInput) (*humaGetSessionTasksOutput, error) {
		return &humaGetSessionTasksOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listCharacterSheets",
		Method:      http.MethodGet,
		Path:        "/api/campaigns/{campaignId}/character-sheets",
		Summary:     "获取角色卡列表",
		Description: "按当前用户权限返回模组内可见的角色卡摘要列表。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaListCharacterSheetsInput) (*humaListCharacterSheetsOutput, error) {
		return &humaListCharacterSheetsOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "createCharacterSheet",
		Method:      http.MethodPost,
		Path:        "/api/campaigns/{campaignId}/character-sheets",
		Summary:     "创建角色卡",
		Description: "创建一张新的角色卡文档，首版支持 CoC7 与 DND5e。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaCreateCharacterSheetInput) (*humaCreateCharacterSheetOutput, error) {
		return &humaCreateCharacterSheetOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "previewCharacterSheetImport",
		Method:      http.MethodPost,
		Path:        "/api/campaigns/{campaignId}/character-sheets/import-text/preview",
		Summary:     "预览角色卡文本导入",
		Description: "解析文本中的角色卡数值与字段，返回识别结果与规范化草稿，不直接落库。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 500},
	}, func(context.Context, *humaPreviewCharacterSheetImportInput) (*humaPreviewCharacterSheetImportOutput, error) {
		return &humaPreviewCharacterSheetImportOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getCharacterSheet",
		Method:      http.MethodGet,
		Path:        "/api/campaigns/{campaignId}/character-sheets/{sheetId}",
		Summary:     "获取角色卡详情",
		Description: "返回一张角色卡的完整内容。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 404, 500},
	}, func(context.Context, *humaGetCharacterSheetInput) (*humaGetCharacterSheetOutput, error) {
		return &humaGetCharacterSheetOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateCharacterSheet",
		Method:      http.MethodPut,
		Path:        "/api/campaigns/{campaignId}/character-sheets/{sheetId}",
		Summary:     "更新角色卡",
		Description: "使用 expectedVersion 执行角色卡更新，冲突时返回 409。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 404, 409, 500},
	}, func(context.Context, *humaUpdateCharacterSheetInput) (*humaUpdateCharacterSheetOutput, error) {
		return &humaUpdateCharacterSheetOutput{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "deleteCharacterSheet",
		Method:      http.MethodDelete,
		Path:        "/api/campaigns/{campaignId}/character-sheets/{sheetId}",
		Summary:     "删除角色卡",
		Description: "删除一张角色卡文档。",
		Tags:        []string{"campaigns-collaboration"},
		Errors:      []int{400, 403, 404, 500},
	}, func(context.Context, *humaDeleteCharacterSheetInput) (*humaDeleteCharacterSheetOutput, error) {
		return &humaDeleteCharacterSheetOutput{}, nil
	})
}
