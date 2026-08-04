# 生产部署

生产入口是 `https://songuu.top/essay/`。宿主机 Nginx 保留 `/essay` 前缀并代理到仅监听回环地址的 Next.js 容器：`127.0.0.1:3200`。PostgreSQL 只加入 Compose 内部网络，不发布宿主机端口。

## 拓扑与持久化边界

- `app`：Next.js standalone，容器内监听 `3000`，宿主机只绑定 `127.0.0.1:3200`。
- `migrator`：与 `app` 复用同一镜像，执行 `node dist/db-deploy.mjs`；数据库健康后运行，退出码为 `0` 后才启动应用。
- `db`：固定为生产机已缓存的 PostgreSQL 17.10 digest，数据保存在独立命名卷 `essay-manage-postgres-data`。
- 发布代码：`/opt/essay-manage/releases/<timestamp>`。
- 生产环境变量：`/opt/essay-manage/shared/.env.production`，不进入 release、镜像或 Git。
- 发布指针：`/opt/essay-manage/current` 和 `/opt/essay-manage/previous`。

PostgreSQL 镜像目前固定为生产机已验证的 PostgreSQL 17 digest：`postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193`（当前服务端版本 17.10）。升级时应先备份、在测试环境验证迁移与回滚，再受控更新 tag 和 digest；不要使用浮动 tag 自动升级数据库。

## 首次初始化

生产机需要 Docker Engine、Docker Compose v2、Nginx、`curl`、`ss`，本机需要 Node.js 24、pnpm 10.28.2、Docker、OpenSSH、`tar`。

先在服务器创建共享环境文件。以下命令只用于文件不存在的首次初始化，不要通过终端输出或聊天传递密钥：

```bash
ssh root@47.253.230.197
install -d -m 700 /opt/essay-manage/shared
test ! -e /opt/essay-manage/shared/.env.production && install -m 600 /dev/null /opt/essay-manage/shared/.env.production
vi /opt/essay-manage/shared/.env.production
```

字段结构参考仓库根目录的 `.env.production.example`。必须设置 `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`、`DATABASE_URL`；`DATABASE_URL` 的主机名必须是 Compose 服务名 `db`。密码中若有 URL 保留字符，需要在 URL 中编码。

部署脚本发现共享环境文件缺失、为空或缺少必填键时会明确失败，并只显示初始化命令，不回显文件内容。

## 部署

先预览完整动作，不产生本地构建、上传或远端变更：

```powershell
pwsh scripts/deploy-production.ps1 -DryRun
```

执行完整部署：

```powershell
pwsh scripts/deploy-production.ps1
```

默认流程如下：

1. 检查共享环境文件、Docker/Compose/Nginx 命令和 `127.0.0.1:3200` 端口归属。
2. 本地依次运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。
3. 本地执行 `docker compose config --quiet` 和 `docker compose build app`，构建单一镜像。
4. 生成 release 包并校验其中没有 `.git`、`node_modules`、`.next` 或任何 `.env*` 文件。
5. 将 release 与 `docker save` 生成的镜像包上传到 `/opt/essay-manage/releases/<timestamp>`；远端 `docker load` 后立即删除临时镜像包。
6. 远端执行 Compose 配置校验，移除上一次的一次性 migrator，再执行 `docker compose up --detach --remove-orphans --wait`。
7. 验证数据库、migrator、回环应用、Nginx 与公网 HTTPS，全部成功后才切换 `current/previous`。

本地门禁可分别关闭：

```powershell
pwsh scripts/deploy-production.ps1 -SkipTests
pwsh scripts/deploy-production.ps1 -SkipTypecheck
pwsh scripts/deploy-production.ps1 -SkipLocalBuild
```

`-SkipImageBuild` 只复用本机已经存在的同名镜像。服务器根盘空间紧张，默认不在生产机执行多阶段构建；只有明确接受远端磁盘和网络风险时才使用：

```powershell
pwsh scripts/deploy-production.ps1 -RemoteBuild
```

`-SkipPublicVerify` 只跳过公网 HTTPS 验证，不会跳过 Compose、数据库、迁移和回环健康检查。`-KeepArtifacts` 会保留本机临时 release/image 包用于排障。

## Nginx 接入

仓库只提供 location 模板，不创建第二个 `server_name songuu.top`。部署脚本定位已经包含以下语句的现有站点配置：

```nginx
include /etc/nginx/snippets/tech-persistence.location.conf;
```

随后安装 `/etc/nginx/snippets/essay-manage.location.conf`，并在同一 server 块旁插入独立 include。配置行为是：

- `/essay` 返回 `308 /essay/`；
- `/essay/` 及其子路径原样转发到 `127.0.0.1:3200`，不会剥离 basePath；
- 关闭代理响应缓冲、请求缓冲和缓存，以支持流式响应；
- 保留真实 Host 与转发来源头。

每次修改前会备份原站点文件和既有 snippet，执行 `nginx -t` 后才 reload。失败时恢复备份。脚本不会运行或打印完整 `nginx -T`，避免暴露其他站点的敏感 header。

## 健康证据

脚本分层检查并分别报告：

1. Compose：`config --quiet` 成功，服务按依赖顺序启动。
2. PostgreSQL：容器 healthcheck 和部署后的真实 `SELECT 1` 成功。
3. Migrator：一次性容器存在且退出码为 `0`。
4. App：容器端口实际映射严格等于 `127.0.0.1:3200`，`/essay/api/health/` 回环请求成功。
5. Nginx：`nginx -t` 与 reload 成功。
6. 公网：`/essay` 返回 308，`https://songuu.top/essay/` 和公网健康接口成功。

PM/Compose 的 `running` 状态本身不等于部署完成；以上各层必须分别通过。

## 回滚

回滚到 `previous`：

```powershell
pwsh scripts/deploy-production.ps1 -Rollback
```

回滚会读取目标 release 的不可变时间戳镜像，先确认 PostgreSQL 可查询，再只切换 `app`。它不会用旧 release 的严格 migration ledger 重跑迁移，避免数据库已经前进后被旧 migrator 拒绝。目标版本必须能读取当前的前向兼容 schema；回环健康、目标 Nginx snippet 和公网检查全部通过后才交换 `current/previous`。

若目标 app、Nginx 配置或公网验证失败，脚本会恢复回滚前的 current app 与 Nginx snippet，不移动 release 指针。默认保留 current 与 previous 对应的两个时间戳镜像；更早且由本脚本生成的时间戳镜像会在成功部署后清理。

数据库卷不会随 release 或应用镜像回滚。迁移应保持向前兼容；若必须回滚数据库，先停止发布并使用经过验证的独立备份恢复流程，不要删除命名卷。

若回滚镜像已被人工删除，脚本会失败并说明原因。仅在生产机磁盘空间允许时可用 `-Rollback -RemoteBuild` 从 previous 源码重新构建。

## 常见阻塞

- `shared/.env.production` 缺失：按“首次初始化”创建，脚本不会代填生产密钥。
- `127.0.0.1:3200` 被其他进程占用：先确认真实 owner；脚本只允许同一 `essay-manage` Compose 项目占用该端口。
- 宿主机 `5432` 已被其他 PostgreSQL 使用：这是允许状态，本项目数据库没有 `ports`，只通过 Compose 网络的 `db:5432` 访问。
- migrator 失败：查看脚本输出的有限 `migrator` 日志，修复迁移或环境后重新部署；app 不会越过失败的 migrator 启动。
- Nginx marker 不存在或匹配多个文件：脚本会停止，不会猜测并创建重复 server 块。先人工确认现有 HTTPS 配置归属。

