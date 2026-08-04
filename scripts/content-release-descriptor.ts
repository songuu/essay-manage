import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ArticleStatus = "published" | "draft" | "archived";

interface ManifestArticle {
  sourcePath: string;
  sourceHash: string;
  status: ArticleStatus;
}

interface ContentManifest {
  version: number;
  sourceCommit: string;
  articles: ManifestArticle[];
}

export interface ContentReleaseDescriptor {
  sourceCommit: string;
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  digest: string;
}

const ARTICLE_STATUSES = new Set<ArticleStatus>([
  "published",
  "draft",
  "archived",
]);

function parseManifest(value: unknown): ContentManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("内容 manifest 必须是对象");
  }

  const record = value as Record<string, unknown>;
  if (record.version !== 1) {
    throw new Error(`不支持的内容 manifest 版本: ${String(record.version)}`);
  }
  if (
    typeof record.sourceCommit !== "string" ||
    !/^[a-f0-9]{40}$/i.test(record.sourceCommit)
  ) {
    throw new Error("manifest.sourceCommit 必须是完整 Git commit");
  }
  if (!Array.isArray(record.articles)) {
    throw new Error("manifest.articles 必须是数组");
  }

  const seenPaths = new Set<string>();
  const articles = record.articles.map((article, index) => {
    if (typeof article !== "object" || article === null || Array.isArray(article)) {
      throw new Error(`manifest.articles[${index}] 必须是对象`);
    }

    const item = article as Record<string, unknown>;
    const sourcePath = item.sourcePath;
    const sourceHash = item.sourceHash;
    const status = item.status;

    if (
      typeof sourcePath !== "string" ||
      !sourcePath.startsWith("essay/") ||
      sourcePath.includes("\\") ||
      !sourcePath.toLowerCase().endsWith(".md") ||
      path.posix.normalize(sourcePath) !== sourcePath
    ) {
      throw new Error(`manifest.articles[${index}].sourcePath 不安全`);
    }
    if (seenPaths.has(sourcePath)) {
      throw new Error(`manifest 包含重复 sourcePath: ${sourcePath}`);
    }
    seenPaths.add(sourcePath);

    if (typeof sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(sourceHash)) {
      throw new Error(`manifest.articles[${index}].sourceHash 必须是 SHA-256`);
    }
    if (typeof status !== "string" || !ARTICLE_STATUSES.has(status as ArticleStatus)) {
      throw new Error(`manifest.articles[${index}].status 不受支持`);
    }

    return {
      sourcePath,
      sourceHash,
      status: status as ArticleStatus,
    };
  });

  return {
    version: 1,
    sourceCommit: record.sourceCommit,
    articles,
  };
}

export function createContentReleaseDescriptor(
  value: unknown,
): ContentReleaseDescriptor {
  const manifest = parseManifest(value);
  const activeArticles = manifest.articles
    .filter((article) => article.status !== "archived")
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.sourcePath), Buffer.from(right.sourcePath)),
    );

  if (activeArticles.length === 0) {
    throw new Error("内容 manifest 没有可同步的活动文章");
  }

  const canonicalRows = `${activeArticles
    .map(
      (article) =>
        `${article.sourcePath}|${article.sourceHash}|${article.status}`,
    )
    .join("\n")}\n`;

  return {
    sourceCommit: manifest.sourceCommit,
    totalArticles: activeArticles.length,
    publishedArticles: activeArticles.filter(
      (article) => article.status === "published",
    ).length,
    draftArticles: activeArticles.filter((article) => article.status === "draft")
      .length,
    digest: createHash("sha256").update(canonicalRows).digest("hex"),
  };
}

async function main(): Promise<void> {
  const manifestPath = path.join(
    process.cwd(),
    "content",
    "article-manifest.json",
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  process.stdout.write(`${JSON.stringify(createContentReleaseDescriptor(manifest))}\n`);
}

const entrypoint = process.argv[1]
  ? path.resolve(process.argv[1])
  : "";
if (entrypoint === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
