---
type: sprint
status: in-progress
---

# 全量文章系统深度刷新

## 用户请求

遍历整个文章列表和文章系统，识别数年前发布、信息可能过时或描述既有问题的内容，并直接深度更新，确保可验证信息保持最新。

## 成功标准

- 完整盘点文章来源、列表和内容渲染/存储路径。
- 对每篇历史文章判断时效性、事实可核验性和需要更新的范围。
- 在不臆造或静默改写无法核验事实的前提下，直接更新可确认过时的内容。
- 运行与变更相称的验证，并明确已验证事实、推断、未知项与外部阻塞。

## 边界

- 保留用户现有的无关工作区改动。
- 需要外部来源确认的时效性事实，将使用可追溯来源或明确标记为待确认。

## Plan

### 方案

保留 43 篇既有 Markdown 的路径、文件名和集合目录，避免改变公开 slug、详情链接与数据库 source_path。全部按现代官方文档重写；每篇加入不可见的 `content-reviewed` 校订标记。元数据层将校订日期与 Git 最近提交时间比较后取较新值，以驱动现有列表、详情、Open Graph 和 Sitemap 的“更新”日期，不增加数据库 schema。

### 有序任务

1. [P] 重写 JavaScript、CSS、性能、Babel、Webpack 主题文章（L2；23 篇；每篇含现代示例与官方参考）。
2. [P] 重写 Vue 与 React/Vue 对比主题文章（L2；15 篇；以 Vue 3 Composition API 和 React Hooks/Context 为基线，并补全空草稿）。
3. [P] 重写 TypeScript、Axios、MongoDB、Scrapy、Node 工程主题文章（L2；5 篇；消除私网地址、旧教程和过时命令）。
4. 串行更新校订日期解析及列表/详情展示（L3；`metadata.ts`、`source.ts`、列表卡片、首页、针对性测试）。
5. 串行生成 manifest 并运行内容、类型、静态和构建校验（L3）。

### 验证与边界

- 检查每篇 Markdown 恰含一个有效校订标记，且不含 Vue CLI、Vue 2、`@babel/polyfill`、AMD/CMD/SeaJS 或私网 endpoint 等旧建议。
- 运行 `pnpm content:manifest`、`pnpm content:verify` 与现有内容测试；随后运行全量 test/lint/typecheck/build。
- 不改名、移动或删除文章；不执行数据库导入、生产同步、部署、提交或推送。
- 不触碰当前已有的 README、发布脚本、工作流及其测试改动。

### 并行变更兼容

执行前发现 `metadata.ts`、`source.ts`、`import-markdown.ts` 已有并行的换行归一化改动，且 manifest 因此需要重生。本次不修改这些文件，也不引入 `content-reviewed` 标记解析；文章正文会完整更新，前台“更新”日期继续以 Git 提交时间为准。待内容提交后，现有日期链路会自然显示本次更新时间。
