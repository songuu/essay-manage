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

所有 `essay/**/*.md` 都会进入数据库：非空文章为 `published`，空文件保留为 `draft`，不会出现在公开页面。原文不被改写或搬迁，测试会按磁盘上的实际文章数验证完整性。

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

新增或修改 Markdown 后先提交并 push 到 `master`：

```powershell
git add essay
git commit -m "content: add article"
git push origin master
```

GitHub Actions 会生成并验证 manifest。若本次提交只修改 `essay/**/*.md` 或 manifest，则复用当前生产镜像进行轻量数据库同步；代码、配置或混合变更会执行完整容器部署。发布时间与更新时间来自 Git 历史，因此未提交的新文件会被明确拒绝，不会以伪造时间发布。

清单只保存元数据和内容哈希，不复制正文。历史文件字节和混合行尾保持不变，读取、校验和入库时才把 CRLF/CR 规范化为 LF，因此 Windows 手工入口与 Linux Actions 会得到同一 hash。导入器会校验 hash、幂等 upsert，并把已从清单删除的旧记录标记为 `archived`；空清单会被拒绝，防止误归档全部文章。需要手工重跑内容同步时使用：

```powershell
pnpm content:sync:production
```

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

`master` push 的自动部署入口是 `.github/workflows/essay-manage-deploy.yml`，实现方式与 `agent-build` 一致：完整并发队列、质量门、SSH 上传、受控切换和公网验证。仓库必须配置 `ESSAY_DEPLOY_SSH_PRIVATE_KEY` 与预先核验的 `ESSAY_DEPLOY_KNOWN_HOSTS`；主机、用户和域名可分别通过 `ESSAY_DEPLOY_HOST`、`ESSAY_DEPLOY_USER`、`ESSAY_DEPLOY_DOMAIN` 覆盖默认值。

首次初始化、健康证据、回滚边界与故障处理见 [docs/deployment.md](docs/deployment.md)。
