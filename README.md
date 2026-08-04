# 折页：Markdown 技术博客

这是一个运行在 `/essay` 下的中文技术博客。仓库中的 Markdown 文件仍是内容源，发布时会生成元数据清单并导入 PostgreSQL；Next.js 只从数据库读取已发布文章，提供首页检索、分类筛选、分页、文章详情、RSS、Sitemap 和健康检查。

## 架构

```text
仓库 Markdown → content/article-manifest.json → migrator → PostgreSQL
                                                        ↓
Nginx /essay/* → Next.js standalone → 列表、全文检索、文章详情、RSS
```

- `src/app`：Next.js App Router 页面与路由处理器。
- `src/lib/content`：Markdown 扫描、Git 时间与稳定 slug 生成。
- `src/lib/db`：PostgreSQL 查询与文章仓储。
- `migrations`：幂等数据库迁移；`pg_trgm` 为中文标题和正文模糊检索提供索引。
- `scripts`：内容清单、迁移、导入、生产发布。
- `compose.yaml`：PostgreSQL、一次性 migrator、Next.js app 三服务拓扑。

现有 43 篇 Markdown 会全部进入数据库：42 篇非空文章为 `published`，1 个空文件保留为 `draft`，不会出现在公开页面。原文不被改写或搬迁。

## 本地开发

要求 Node.js 24、pnpm 10.28.2 和 PostgreSQL 17。复制环境变量模板并设置本地数据库连接：

```powershell
Copy-Item .env.production.example .env.local
pnpm install
pnpm content:verify
pnpm db:deploy
pnpm dev
```

访问 `http://localhost:3000/essay/`。`basePath` 在构建时固定为 `/essay`，因此页面、API、RSS 与站点地图都在该前缀下。

## 内容工作流

新增或修改 Markdown 后执行：

```powershell
pnpm content:manifest
pnpm content:verify
pnpm db:deploy
```

清单只保存元数据和内容哈希，不复制正文。导入器会校验哈希、幂等 upsert，并把已从清单删除的旧记录标记为 `archived`；空清单会被拒绝，防止误归档全部文章。

## 质量门禁

```powershell
pnpm test
pnpm lint
pnpm typecheck
pnpm content:verify
pnpm build
```

## 生产部署

生产入口是 `https://songuu.top/essay/`。应用镜像在本机生成，生产机只加载镜像并运行 Compose，PostgreSQL 不暴露宿主机端口，Next.js 只绑定 `127.0.0.1:3200`，由现有 Nginx 反向代理。

```powershell
pwsh scripts/deploy-production.ps1 -DryRun
pwsh scripts/deploy-production.ps1
```

首次初始化、健康证据、回滚边界与故障处理见 [docs/deployment.md](docs/deployment.md)。
