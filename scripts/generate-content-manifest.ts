import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { ArticleMetadata } from "../src/lib/content/metadata";
import { scanArticleSources } from "../src/lib/content/source";

const execFileAsync = promisify(execFile);

export const CONTENT_MANIFEST_VERSION = 1 as const;

export type ContentManifestArticle = ArticleMetadata;

export interface ContentManifest {
  version: typeof CONTENT_MANIFEST_VERSION;
  generatedAt: string;
  sourceCommit: string;
  articles: ContentManifestArticle[];
}

export type ComparableContentManifest = Omit<ContentManifest, "generatedAt">;

async function getSourceCommit(repositoryRoot: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "-1", "--format=%H", "--", "essay"],
      {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    const commit = stdout.trim();

    if (!/^[a-f0-9]{40}$/i.test(commit)) {
      throw new Error(`Git 返回了无效提交: ${commit || "<empty>"}`);
    }

    return commit;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`读取内容源提交失败: ${detail}`);
  }
}

export function getComparableManifest(
  manifest: ContentManifest,
): ComparableContentManifest {
  return {
    version: manifest.version,
    sourceCommit: manifest.sourceCommit,
    articles: manifest.articles,
  };
}

export async function createContentManifest(
  repositoryRoot: string,
  generatedAt = new Date().toISOString(),
): Promise<ContentManifest> {
  const [sources, sourceCommit] = await Promise.all([
    scanArticleSources(repositoryRoot),
    getSourceCommit(repositoryRoot),
  ]);
  const articles = sources.map((source) => {
    const { contentMarkdown, ...metadata } = source;
    void contentMarkdown;
    return metadata;
  });

  return {
    version: CONTENT_MANIFEST_VERSION,
    generatedAt,
    sourceCommit,
    articles,
  };
}

function serializeManifest(manifest: ContentManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function isDirectExecution(): boolean {
  return path.basename(process.argv[1] ?? "").toLocaleLowerCase() ===
    "generate-content-manifest.ts";
}

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const manifestPath = path.join(
    repositoryRoot,
    "content",
    "article-manifest.json",
  );
  const expected = await createContentManifest(repositoryRoot);

  if (process.argv.includes("--check")) {
    let stored: ContentManifest;

    try {
      stored = JSON.parse(await readFile(manifestPath, "utf8")) as ContentManifest;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`读取内容 manifest 失败 (${manifestPath}): ${detail}`);
    }

    if (
      JSON.stringify(getComparableManifest(stored)) !==
      JSON.stringify(getComparableManifest(expected))
    ) {
      throw new Error(
        "content/article-manifest.json 与 Markdown/Git 内容不一致，请运行 pnpm content:manifest",
      );
    }

    console.log(`内容 manifest 一致：${stored.articles.length} 篇`);
    return;
  }

  try {
    const stored = JSON.parse(
      await readFile(manifestPath, "utf8"),
    ) as ContentManifest;
    const storedGeneratedAt = Date.parse(stored.generatedAt);
    if (
      Number.isFinite(storedGeneratedAt) &&
      JSON.stringify(getComparableManifest(stored)) ===
        JSON.stringify(getComparableManifest(expected))
    ) {
      console.log(`内容 manifest 无需更新：${stored.articles.length} 篇`);
      return;
    }
  } catch {
    // Missing or invalid generated output is replaced by the verified scan below.
  }

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, serializeManifest(expected), "utf8");
  console.log(`已生成内容 manifest：${expected.articles.length} 篇`);
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
