import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { normalizeMarkdownContent } from "../src/lib/content/metadata";
import { scanArticleSources } from "../src/lib/content/source";

const execFileAsync = promisify(execFile);

const ARTICLE_INVENTORY_BASELINE_2026_08_04 = Object.freeze({
  total: 43,
  published: 43,
  draft: 0,
});

const GIT_DATE_ORACLE_ARTICLE = "essay/scrapy运行的过程.md";

async function skipWithoutRepositoryGitHistory(
  t: TestContext,
  repositoryRoot: string,
): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "-1", "--format=%aI"],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    if (stdout.trim()) return false;
  } catch {
    // Article scanning intentionally derives timestamps from Git history.
  }

  t.skip("当前工作区没有可用的 Git 提交历史，跳过依赖 Git 时间的内容库存测试");
  return true;
}

async function getArticleGitHistory(
  repositoryRoot: string,
  sourcePath: string,
): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["log", "--follow", "--format=%aI", "--", sourcePath],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  return stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(absolutePath);
      return entry.isFile() && entry.name.toLowerCase().endsWith(".md")
        ? [absolutePath]
        : [];
    }),
  );

  return files.flat();
}

test("完整扫描全部 Markdown，并按正文是否为空区分公开文章与草稿", async (t) => {
  const repositoryRoot = process.cwd();
  if (await skipWithoutRepositoryGitHistory(t, repositoryRoot)) return;

  const articles = await scanArticleSources(repositoryRoot);
  const markdownFiles = await listMarkdownFiles(
    path.join(repositoryRoot, "essay"),
  );
  const markdownContents = await Promise.all(
    markdownFiles.map((file) => readFile(file, "utf8")),
  );
  const publishedFiles = markdownContents.filter((content) => content.trim());

  assert.ok(markdownFiles.length > 0);
  assert.equal(articles.length, markdownFiles.length);
  assert.equal(
    articles.filter((article) => article.status === "published").length,
    publishedFiles.length,
  );
  assert.equal(
    articles.filter((article) => article.status === "draft").length,
    markdownFiles.length - publishedFiles.length,
  );
  assert.equal(
    new Set(articles.map((article) => article.slug)).size,
    articles.length,
  );
  assert.equal(
    new Set(articles.map((article) => article.sourcePath)).size,
    articles.length,
  );
});

test("已校订文章库存符合 2026-08-04 发布基线", async (t) => {
  const repositoryRoot = process.cwd();
  if (await skipWithoutRepositoryGitHistory(t, repositoryRoot)) return;

  const articles = await scanArticleSources(repositoryRoot);
  const inventory = {
    total: articles.length,
    published: articles.filter((article) => article.status === "published").length,
    draft: articles.filter((article) => article.status === "draft").length,
  };

  assert.deepEqual(inventory, ARTICLE_INVENTORY_BASELINE_2026_08_04);
});

test("Markdown 只规范化换行，正文语义与 canonical hash 保持一致", async (t) => {
  const repositoryRoot = process.cwd();
  if (await skipWithoutRepositoryGitHistory(t, repositoryRoot)) return;

  const articles = await scanArticleSources(repositoryRoot);
  const scrapy = articles.find(
    (article) => article.sourcePath === "essay/scrapy运行的过程.md",
  );

  assert.ok(scrapy);
  assert.match(scrapy.contentMarkdown, /适用于获授权站点的 Scrapy 采集/);

  const source = await readFile(
    path.join(repositoryRoot, ...scrapy.sourcePath.split("/")),
    "utf8",
  );
  const canonicalSource = normalizeMarkdownContent(source);
  assert.equal(scrapy.contentMarkdown, canonicalSource);
  assert.equal(
    scrapy.sourceHash,
    createHash("sha256").update(canonicalSource).digest("hex"),
  );
});

test("Git 首次与最后变更时间分别进入发布时间和源更新时间", async (t) => {
  const repositoryRoot = process.cwd();
  if (await skipWithoutRepositoryGitHistory(t, repositoryRoot)) return;

  const timestamps = await getArticleGitHistory(
    repositoryRoot,
    GIT_DATE_ORACLE_ARTICLE,
  );
  assert.ok(
    timestamps.length >= 2,
    GIT_DATE_ORACLE_ARTICLE + " 应保留至少两次 Git 变更，作为发布时间与更新时间的真实 oracle",
  );

  const articles = await scanArticleSources(repositoryRoot);
  const article = articles.find(
    (candidate) => candidate.sourcePath === GIT_DATE_ORACLE_ARTICLE,
  );

  assert.ok(article, "未扫描到 Git 时间 oracle 文章：" + GIT_DATE_ORACLE_ARTICLE);
  assert.equal(
    article.publishedAt,
    new Date(timestamps.at(-1)!).toISOString(),
  );
  assert.equal(
    article.sourceUpdatedAt,
    new Date(timestamps[0]!).toISOString(),
  );

  for (const candidate of articles) {
    assert.match(candidate.publishedAt, /^20[0-9]{2}-[0-9]{2}-[0-9]{2}T/);
    assert.match(candidate.sourceUpdatedAt, /^20[0-9]{2}-[0-9]{2}-[0-9]{2}T/);
    assert.ok(
      Date.parse(candidate.sourceUpdatedAt) >= Date.parse(candidate.publishedAt),
      candidate.sourcePath,
    );
  }
});
