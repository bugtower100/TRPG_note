[OPEN] import-preview-failure

# Debug Session: import-preview-failure

## Symptom
- 角色卡文本导入“预览识别结果”仍然失败。
- CoC / DND 两类文本在 `npm run dev` 前端环境下都存在失败现象。

## Hypotheses
1. 前端提交预览时，`text` 或 `systemHint` 为空或被错误改写。
2. 前端请求已发出，但接口返回 `400/403/500`，界面只展示了笼统错误。
3. 后端进入了解析逻辑，但在特定文本格式上抛错或 panic。
4. 开发环境实际连接的后端不是当前代码对应的进程，导致仍在执行旧逻辑。

## Instrumentation Plan
- 在前端预览提交前后增加调试日志，记录请求参数长度、systemHint、响应结果和错误对象。
- 在后端预览接口入口和解析器入口增加调试日志，记录请求摘要、鉴权结果、检测系统和解析结果。
- 复现一次失败流程，对照前后端日志确认失败节点。

## Evidence
- Log file: `.dbg/trae-debug-log-import-preview-failure.ndjson`
- Failure sample 1:
  - Frontend request started with non-empty text: lines 1-2 show `textLength=205`, `hasText=true`, `systemHint=""`.
  - Frontend service failed immediately: line 3 shows `characterSheetService previewImport error`.
  - Dialog also failed immediately: line 4 shows `import preview request failed`.
  - No matching backend route/parser log exists around the same timestamp, so the request did not reach the current backend process.
- Failure sample 2:
  - Frontend request started with non-empty text: lines 5-6 show `textLength=198`, `hasText=true`.
  - Frontend failed again: lines 7-8 show the same immediate failure pattern.
  - No matching backend route/parser log exists around the same timestamp.
- Post-restart success sample:
  - Backend route accepted request: lines 9, 13, 16, 20.
  - Backend parser started and returned result: lines 10-11, 12-14, 15-17, 22-24.
  - Frontend service/dialog also reported success: lines 23-24.
- Evidence-based conclusion:
  - Hypothesis 1 rejected: frontend did submit non-empty text.
  - Hypothesis 2 partially rejected for current code path: once the request reached the live backend, the API returned `200` and produced a preview.
  - Hypothesis 3 rejected for the observed post-restart samples: parser executed and returned structured results for both CoC and DND.
  - Hypothesis 4 currently best supported: the original failure most likely came from dev environment process drift, stale proxy target, or an old backend instance that was not serving the latest code. Restarting aligned frontend and backend processes, after which the same path succeeded.
- Instrumentation gap found:
  - Existing frontend failure logs only captured `[object Object]`, which was insufficient for root-cause capture.
  - Follow-up instrumentation has been added to serialize the full error object for future failure captures.

## Next Step
- Reproduce once more if the failure reappears and inspect the enriched frontend error payload.
- Keep current instrumentation until the user confirms the issue is stable.
