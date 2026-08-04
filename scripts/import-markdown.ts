import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  ArticleMetadata,
  ArticleStatus,
} from "../src/lib/content/metadata";
import {
  createDatabaseClient,
  describeDatabaseError,
} from "../src/lib/db/client";

interface ContentManifest {
  version: number;
  generatedAt: string;
  sourceCommit: string;
  articles: ArticleMetadata[];
}

interface ArticleToImport extends ArticleMetadata {
  contentMarkdown: string;
}

interface ImportMarkdownOptions {
  databaseUrl?: string;
  repositoryRoot?: string;
}

export interface ImportMarkdownResult {
  manifestArticles: number;
  changedArticles: number;
  archivedArticles: number;
}

const ARTICLE_STATUSES = new Set<ArticleStatus>([
  "published",
  "draft",
  "archived",
]);

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} 必须是对象`);
  }

  return value as Record<string, unknown>;
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  context: string,
  allowEmpty = false,
): string {
  const value = record[key];

  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(`${context}.${key} 必须是${allowEmpty ? "" : "非空"}字符串`);
  }

  return value;
}

function requireNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = record[key];

  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${context}.${key} 必须是非负整数`);
  }

  return value as number;
}

function requireIsoDate(value: string, context: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${context} 必须是有效 ISO 时间`);
  }

  return new Date(value).toISOString();
}

function parseManifestArticle(value: unknown, index: number): ArticleMetadata {
  const context = `manifest.articles[${index}]`;
  const record = requireRecord(value, context);
  const status = requireString(record, "status", context) as ArticleStatus;

  if (!ARTICLE_STATUSES.has(status)) {
    throw new Error(`${context}.status 不受支持: ${status}`);
  }

  const sourceHash = requireString(record, "sourceHash", context);
  if (!/^[a-f0-9]{64}$/.test(sourceHash)) {
    throw new Error(`${context}.sourceHash 必须是 SHA-256`);
  }

  return {
    sourcePath: requireString(record, "sourcePath", context),
    sourceHash,
    slug: requireString(record, "slug", context),
    title: requireString(record, "title", context),
    excerpt: requireString(record, "excerpt", context, true),
    collection: requireString(record, "collection", context),
    status,
    publishedAt: requireIsoDate(
      requireString(record, "publishedAt", context),
      `${context}.publishedAt`,
    ),
    sourceUpdatedAt: requireIsoDate(
      requireString(record, "sourceUpdatedAt", context),
      `${context}.sourceUpdatedAt`,
    ),
    wordCount: requireNonNegativeInteger(record, "wordCount", context),
    readingMinutes: requireNonNegativeInteger(
      record,
      "readingMinutes",
      context,
    ),
  };
}

function parseContentManifest(raw: string, manifestPath: string): ContentManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`内容 manifest 不是有效 JSON (${manifestPath}): ${detail}`);
  }

  const record = requireRecord(parsed, "manifest");
  if (record.version !== 1) {
    throw new Error(`不支持的内容 manifest 版本: ${String(record.version)}`);
  }
  if (!Array.isArray(record.articles)) {
    throw new Error("manifest.articles 必须是数组");
  }

  const articles = record.articles.map(parseManifestArticle);
  const sourcePaths = new Set(articles.map((article) => article.sourcePath));
  const slugs = new Set(articles.map((article) => article.slug));

  if (sourcePaths.size !== articles.length) {
    throw new Error("manifest 包含重复 sourcePath");
  }
  if (slugs.size !== articles.length) {
    throw new Error("manifest 包含重复 slug");
  }

  const sourceCommit = requireString(record, "sourceCommit", "manifest");
  if (!/^[a-f0-9]{40}$/i.test(sourceCommit)) {
    throw new Error("manifest.sourceCommit 必须是完整 Git commit");
  }

  return {
    version: 1,
    generatedAt: requireIsoDate(
      requireString(record, "generatedAt", "manifest"),
      "manifest.generatedAt",
    ),
    sourceCommit,
    articles,
  };
}

function resolveArticlePath(repositoryRoot: string, sourcePath: string): string {
  if (
    sourcePath.includes("\\") ||
    !sourcePath.startsWith("essay/") ||
    !sourcePath.toLocaleLowerCase().endsWith(".md") ||
    path.posix.normalize(sourcePath) !== sourcePath
  ) {
    throw new Error(`manifest 包含不安全的文章路径: ${sourcePath}`);
  }

  const essayRoot = path.resolve(repositoryRoot, "essay");
  const absolutePath = path.resolve(repositoryRoot, ...sourcePath.split("/"));

  if (!absolutePath.startsWith(`${essayRoot}${path.sep}`)) {
    throw new Error(`文章路径越出 essay 目录: ${sourcePath}`);
  }

  return absolutePath;
}

async function loadArticles(
  repositoryRoot: string,
  manifest: ContentManifest,
): Promise<ArticleToImport[]> {
  return Promise.all(
    manifest.articles.map(async (metadata) => {
      const absolutePath = resolveArticlePath(repositoryRoot, metadata.sourcePath);
      let contentMarkdown: string;

      try {
        contentMarkdown = await readFile(absolutePath, "utf8");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`读取 Markdown 失败 (${metadata.sourcePath}): ${detail}`);
      }

      const actualHash = createHash("sha256")
        .update(contentMarkdown)
        .digest("hex");
      if (actualHash !== metadata.sourceHash) {
        throw new Error(
          `Markdown hash 不一致 (${metadata.sourcePath}): manifest=${metadata.sourceHash}, actual=${actualHash}`,
        );
      }

      return { ...metadata, contentMarkdown };
    }),
  );
}

export async function importMarkdownArticles(
  options: ImportMarkdownOptions = {},
): Promise<ImportMarkdownResult> {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const manifestPath = path.join(
    repositoryRoot,
    "content",
    "article-manifest.json",
  );
  const manifest = parseContentManifest(
    await readFile(manifestPath, "utf8"),
    manifestPath,
  );
  const articles = await loadArticles(repositoryRoot, manifest);
  if (articles.length === 0) {
    throw new Error("内容 manifest 为空，拒绝归档数据库中的全部文章");
  }

  const sql = createDatabaseClient({
    databaseUrl: options.databaseUrl,
    maxConnections: 1,
  });

  try {
    return await sql.begin(async (transaction) => {
      const sourcePaths = articles.map((article) => article.sourcePath);
      const archivedRows = sourcePaths.length
        ? await transaction<{ source_path: string }[]>`
            UPDATE articles
            SET status = 'archived', updated_at = now()
            WHERE status <> 'archived'
              AND source_path NOT IN ${transaction(sourcePaths)}
            RETURNING source_path
          `
        : await transaction<{ source_path: string }[]>`
            UPDATE articles
            SET status = 'archived', updated_at = now()
            WHERE status <> 'archived'
            RETURNING source_path
          `;
      const rows = articles.map((article) => ({
        slug: article.slug,
        source_path: article.sourcePath,
        content_markdown: article.contentMarkdown,
        source_hash: article.sourceHash,
        title: article.title,
        excerpt: article.excerpt,
        collection: article.collection,
        status: article.status,
        published_at: article.publishedAt,
        source_updated_at: article.sourceUpdatedAt,
        word_count: article.wordCount,
        reading_minutes: article.readingMinutes,
      }));
      const changedRows = await transaction<{ source_path: string }[]>`
        INSERT INTO articles ${transaction(
          rows,
          "slug",
          "source_path",
          "content_markdown",
          "source_hash",
          "title",
          "excerpt",
          "collection",
          "status",
          "published_at",
          "source_updated_at",
          "word_count",
          "reading_minutes",
        )}
        ON CONFLICT (source_path) DO UPDATE SET
          slug = EXCLUDED.slug,
          content_markdown = EXCLUDED.content_markdown,
          source_hash = EXCLUDED.source_hash,
          title = EXCLUDED.title,
          excerpt = EXCLUDED.excerpt,
          collection = EXCLUDED.collection,
          status = EXCLUDED.status,
          published_at = EXCLUDED.published_at,
          source_updated_at = EXCLUDED.source_updated_at,
          word_count = EXCLUDED.word_count,
          reading_minutes = EXCLUDED.reading_minutes,
          updated_at = now()
        WHERE ROW(
          articles.slug,
          articles.content_markdown,
          articles.source_hash,
          articles.title,
          articles.excerpt,
          articles.collection,
          articles.status,
          articles.published_at,
          articles.source_updated_at,
          articles.word_count,
          articles.reading_minutes
        ) IS DISTINCT FROM ROW(
          EXCLUDED.slug,
          EXCLUDED.content_markdown,
          EXCLUDED.source_hash,
          EXCLUDED.title,
          EXCLUDED.excerpt,
          EXCLUDED.collection,
          EXCLUDED.status,
          EXCLUDED.published_at,
          EXCLUDED.source_updated_at,
          EXCLUDED.word_count,
          EXCLUDED.reading_minutes
        )
        RETURNING source_path
      `;

      return {
        manifestArticles: articles.length,
        changedArticles: changedRows.length,
        archivedArticles: archivedRows.length,
      };
    });
  } catch (error) {
    throw new Error(`导入 Markdown 到数据库失败: ${describeDatabaseError(error)}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function isDirectExecution(): boolean {
  return path.basename(process.argv[1] ?? "").toLocaleLowerCase() ===
    "import-markdown.ts";
}

if (isDirectExecution()) {
  importMarkdownArticles()
    .then((result) => {
      console.log(
        `Markdown 导入完成：manifest ${result.manifestArticles}，变更 ${result.changedArticles}，归档 ${result.archivedArticles}`,
      );
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
