适用于 Node.js 服务访问 MongoDB：在进程生命周期内复用一个官方 Node.js Driver 的 `MongoClient` 来管理连接池，按查询模式设计索引，并在服务退出时统一释放资源；不要在每个 HTTP 请求里反复连接、建索引或把数据库错误静默吞掉。

## 2026 年的最小结构

安装官方驱动：

```bash
pnpm add mongodb
```

连接字符串只从受控配置读取，不能提交到仓库。一个常驻服务通常只需要一个 `MongoClient` 实例；它会为拓扑中的服务器维护连接池，业务代码通过 `db.collection()` 取得集合即可。

```ts
// src/db/mongo.ts
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("缺少 MONGODB_URI，无法连接 MongoDB");
}

export const mongoClient = new MongoClient(uri, {
  appName: "catalog-service",
  maxPoolSize: 20,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 5_000,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

export const db = mongoClient.db("catalog");

export async function connectMongo(): Promise<void> {
  await mongoClient.connect();
  await db.command({ ping: 1 });
}

export async function disconnectMongo(): Promise<void> {
  await mongoClient.close();
}
```

在应用启动时调用 `connectMongo()`，并在 `SIGTERM` / `SIGINT` 的优雅退出路径中调用一次 `disconnectMongo()`。常驻服务不要在每个请求结束时 `close()`，否则会失去连接池复用并制造连接抖动。一次性脚本则应使用 `try/finally`：

```ts
import { mongoClient, db } from "./mongo.js";

try {
  await mongoClient.connect();
  await db.collection("articles").deleteMany({ status: "draft" });
} finally {
  await mongoClient.close();
}
```

无服务器环境要按平台的 warm instance 模型缓存客户端，并由运行时回收；也不要为每次 handler 调用新建客户端。连接数应按实例数、并发量与数据库配额一起估算，不能只把 `maxPoolSize` 调大。

## 类型化 CRUD 与索引

索引服务于真实的筛选和排序，而不是“给每个字段都建一个”。以下查询先按 `status` 过滤、再按 `publishedAt` 倒序，因此复合索引按同一顺序建立。

```ts
import type { Collection } from "mongodb";

type Article = {
  slug: string;
  title: string;
  status: "draft" | "published";
  createdAt: Date;
  publishedAt?: Date;
  updatedAt: Date;
};

const articles: Collection<Article> = db.collection<Article>("articles");

export async function ensureArticleIndexes(): Promise<void> {
  await articles.createIndex({ slug: 1 }, { name: "uniq_article_slug", unique: true });
  await articles.createIndex(
    { status: 1, publishedAt: -1 },
    { name: "published_articles_by_date" },
  );
}

export async function createArticle(input: Pick<Article, "slug" | "title">) {
  const now = new Date();
  const result = await articles.insertOne({
    ...input,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  return result.insertedId;
}

export async function listPublishedArticles() {
  return articles
    .find(
      { status: "published" },
      { projection: { slug: 1, title: 1, publishedAt: 1 } },
    )
    .sort({ publishedAt: -1 })
    .limit(20)
    .toArray();
}

export async function publishArticle(slug: string) {
  const now = new Date();
  const result = await articles.updateOne(
    { slug, status: "draft" },
    { $set: { status: "published", publishedAt: now, updatedAt: now } },
  );

  if (result.matchedCount !== 1) {
    throw new Error("文章不存在，或当前状态不允许发布");
  }
}

export async function removeArticle(slug: string) {
  const result = await articles.deleteOne({ slug });
  return result.deletedCount === 1;
}
```

创建草稿时只写入 `createdAt` 与 `updatedAt`，并省略可选的 `publishedAt`；当前的状态过滤保证 `publishArticle` 只会在草稿首次转为 published 时写入发布时间。若业务允许撤回再发布，需另行定义是保留首次发布时间还是覆盖为最新发布时间。

把 `ensureArticleIndexes()` 放在迁移或部署步骤中，而不是请求热路径。唯一索引冲突会以数据库错误返回；应在业务边界把它翻译成“slug 已存在”等可处理的错误，同时保留原始错误用于日志和告警。对慢操作可在单次查询或游标上设置 `maxTimeMS`，不要把连接超时、服务器选择超时与业务操作超时混为一谈。

## 常见错误与边界

- `find()` 返回的是 cursor，不是数组；请链式设置 `sort()`、`limit()`、`projection` 后再 `toArray()`，大结果集应迭代 cursor 或分页。
- `updateOne()` 默认不会创建文档；只有明确需要“更新或插入”时才设置 `upsert: true`，并为并发写入定义唯一约束。
- `maxPoolSize` 已满时后续操作会等待连接可用。先检查慢查询、索引、并发和数据库容量，再调整池大小。
- 连接池不是事务。需要跨多个写入保持原子性时，使用 session 与事务，并评估副本集、超时和重试语义。
- `close()` 会关闭池内套接字；它是进程/脚本资源释放动作，不是每条 CRUD 的收尾动作。

## 官方参考

- [MongoDB Node.js Driver：MongoClient](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/)
- [MongoDB Node.js Driver：连接选项与超时](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/)
- [MongoDB Node.js Driver：CRUD 配置](https://www.mongodb.com/docs/drivers/node/current/crud/configure/)
- [MongoDB Node.js Driver：索引](https://www.mongodb.com/docs/drivers/node/current/indexes/)