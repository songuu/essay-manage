适用于运行 Vue/Vite、旧版 Vue CLI 或 Node.js 构建任务时出现 `JavaScript heap out of memory`：先区分一次性的编译峰值、持续增长的泄漏和机器/容器限额，再用采样与堆快照定位；`--max-old-space-size` 只能作为有容量依据的临时缓解或诊断条件，不能替代修复。

## 先确认是哪一种“内存溢出”

终端中的 `FATAL ERROR: Ineffective mark-compacts near heap limit` 指向 V8 堆接近上限，但进程的 RSS 还包含原生模块、Buffer、子进程和映射文件。先记录可复现命令、Node 版本、依赖锁文件、输入规模以及是否只在开发热更新或生产构建中发生。

在入口或临时诊断模块中采样，可快速判断 `heapUsed` 是否会在相同操作后持续上升：

```ts
function formatMiB(bytes: number): string {
  return String(Math.round(bytes / 1024 / 1024)) + " MiB";
}

setInterval(() => {
  const { rss, heapTotal, heapUsed, external, arrayBuffers } = process.memoryUsage();
  console.info({
    rss: formatMiB(rss),
    heapTotal: formatMiB(heapTotal),
    heapUsed: formatMiB(heapUsed),
    external: formatMiB(external),
    arrayBuffers: formatMiB(arrayBuffers),
  });
}, 10_000).unref();
```

重点比较同一流程前后的曲线：

- 仅在首次构建或导入超大资源时陡升，随后回落，常是编译峰值、source map 或缓存开销。
- 每次热更新、路由切换或文件扫描后都不回落，优先怀疑 watcher、插件缓存、事件监听器、全局 Map/数组或重复加载的模块。
- `heapUsed` 不高而 RSS 很高，要继续查 Buffer、原生依赖、子进程与容器限制；单调大 V8 堆没有直接答案。

## 有边界地提高堆上限

Node 的规范写法是 `--max-old-space-size=SIZE`（单位 MiB）。给构建留出系统、编辑器、浏览器和数据库客户端的内存，不能把整台机器的可用内存都交给一个 Node 进程。

现代 Vite 项目可显式增加一个诊断脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "dev:large-heap": "node --max-old-space-size=4096 ./node_modules/vite/bin/vite.js",
    "build:large-heap": "node --max-old-space-size=4096 ./node_modules/vite/bin/vite.js build"
  }
}
```

旧版 Vue CLI 项目则把 Node 参数放在 JavaScript 入口之前：

```json
{
  "scripts": {
    "serve:large-heap": "node --max-old-space-size=4096 ./node_modules/@vue/cli-service/bin/vue-cli-service.js serve"
  }
}
```

PowerShell 中也可以只为当前会话设置 `NODE_OPTIONS`：

```powershell
$previous = $env:NODE_OPTIONS
$env:NODE_OPTIONS = "$previous --max-old-space-size=4096".Trim()
pnpm dev
$env:NODE_OPTIONS = $previous
```

这里的 `4096` 只是示例，不是推荐值。先用真实的可用内存、容器 `memory limit` 和并发构建数决定容量；多个并行 worker 会分别拥有自己的堆。提高上限后如果构建仍持续增长，或主机开始 swap/被 OOM killer 终止，应停止加内存并回到根因诊断。

不要修改 `node_modules` 内的 CLI 源码，也不要依赖旧的 `increase-memory-limit` 一类“永久改写”工具：重装依赖、CI、不同 Node 版本和不同包管理器都会使其不可追溯。

## 用快照定位，而不是猜测

在可丢弃的本地或预发副本上，可让 Node 接近限制时写出最多两个堆快照：

```bash
node --max-old-space-size=1024 --heapsnapshot-near-heap-limit=2 ./node_modules/vite/bin/vite.js build
```

将 `.heapsnapshot` 文件导入 Chrome DevTools 的 Memory 面板，比较“稳定启动后”和“重复触发可疑流程后”的两个快照，观察 retained size 与持有链。典型根因包括把所有源文件内容长期缓存、递归遍历符号链接、插件为每次热更新保留 AST、或应用层的订阅未清理。

堆快照会暂停主线程，并可能临时占用接近一倍堆空间；生产进程生成快照本身可能导致崩溃或可用性下降。不要暴露一个无需鉴权就能触发 `writeHeapSnapshot()` 的 HTTP 接口。

## 修复优先级

1. 缩小输入：排除构建扫描中的生成目录、依赖目录与大二进制文件，减少不必要的 source map、重复插件和并发 worker。
2. 修复保留：为 watcher、定时器、事件监听器和缓存增加生命周期与上限；用真实的业务 ID 淘汰，而不是无限累积。
3. 升级与隔离：在干净 lockfile 环境复现，升级已知有泄漏的构建插件；将超大转换拆成流式/分批任务。
4. 再评估容量：确认不是泄漏后，才把合理的 `--max-old-space-size` 写入 CI 或容器启动配置，并监控 RSS 和失败率。

## 官方参考

- [Node.js CLI：--max-old-space-size](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-mib)
- [Node.js CLI：接近堆限制时生成快照](https://nodejs.org/api/cli.html#--heapsnapshot-near-heap-limitmax_count)
- [Node.js：使用 Heap Snapshot 诊断内存](https://nodejs.org/learn/diagnostics/memory/using-heap-snapshot)