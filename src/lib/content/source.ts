import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  type ArticleSource,
  buildArticleMetadata,
  normalizeMarkdownContent,
} from "./metadata";

const execFileAsync = promisify(execFile);

async function listMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listMarkdownFiles(absolutePath);
      }
      return entry.isFile() && entry.name.toLocaleLowerCase().endsWith(".md")
        ? [absolutePath]
        : [];
    }),
  );

  return nestedFiles.flat().sort((left, right) => left.localeCompare(right, "zh-CN"));
}

async function getGitDates(
  repositoryRoot: string,
  sourcePath: string,
): Promise<{ publishedAt: string; sourceUpdatedAt: string }> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--follow", "--format=%aI", "--", sourcePath],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    const timestamps = stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (timestamps.length === 0) {
      throw new Error("Git 历史中没有该文件");
    }

    return {
      publishedAt: timestamps.at(-1)!,
      sourceUpdatedAt: timestamps[0],
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`读取文章 Git 时间失败 (${sourcePath}): ${detail}`, {
      cause: error,
    });
  }
}

export async function scanArticleSources(
  repositoryRoot: string,
): Promise<ArticleSource[]> {
  const essayRoot = path.join(repositoryRoot, "essay");
  const files = await listMarkdownFiles(essayRoot);
  const seenSlugs = new Map<string, string>();
  const articles: ArticleSource[] = [];

  for (const absolutePath of files) {
    const sourcePath = path.relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
    const [rawMarkdown, dates] = await Promise.all([
      readFile(absolutePath, "utf8"),
      getGitDates(repositoryRoot, sourcePath),
    ]);
    const contentMarkdown = normalizeMarkdownContent(rawMarkdown);
    const metadata = buildArticleMetadata({
      sourcePath,
      contentMarkdown,
      ...dates,
    });
    const conflictingPath = seenSlugs.get(metadata.slug);

    if (conflictingPath) {
      throw new Error(
        `文章 slug 冲突: ${metadata.slug} (${conflictingPath}, ${sourcePath})`,
      );
    }

    seenSlugs.set(metadata.slug, sourcePath);
    articles.push({ ...metadata, contentMarkdown });
  }

  return articles;
}
