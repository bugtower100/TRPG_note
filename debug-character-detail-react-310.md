[OPEN] character-detail-react-310

# 调试目标

- 现象：修复后的 exe 可正常启动，但新建角色并点击进入后，页面报错 `Minified React error #310`。
- 期望：新建角色后进入角色详情页应正常渲染，不应触发 React Hook 相关运行时错误。

# 当前假设

- 假设 1：角色详情页或其子组件存在条件性 Hook 调用。
- 假设 2：某个自定义 Hook 在“新建空角色”场景下前后渲染路径不一致。
- 假设 3：问题位于通用详情组件或富文本组件，而不是角色详情页本体。
- 假设 4：开发环境能给出未压缩的完整 React 错误信息，从而定位到具体组件。

# 证据计划

- 检查角色详情页、通用详情页及相关 Hook 的调用顺序。
- 在开发环境复现，获取未压缩 React 报错和组件栈。
- 必要时添加最小埋点，仅记录详情页首次进入时的关键渲染状态。

# 当前状态

- 已创建调试会话，尚未修改业务逻辑。

# 证据结论

- 静态定位：`src/pages/characters/CharacterDetail.tsx` 中，`if (!character) return <div>加载中...</div>;` 早返回位于两个 `useCallback` 之前。
- 这会导致：
  - 首次渲染 `character === null` 时，组件只执行前半段 Hook。
  - 实体加载完成后的下一次渲染会额外执行两个 `useCallback`。
- 该行为与 React `#310` 的典型触发条件一致：同一组件前后渲染的 Hook 数量不一致。

# 修复方案

- 将角色详情页中的两个 `useCallback` 提前到早返回之前。
- 在回调内部增加 `!character` 保护，避免空实体时继续提交更新。

# 验证

- `CharacterDetail.tsx` 诊断通过。
- `npm run build` 已通过。
