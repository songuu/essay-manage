import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { scanArticleSources } from "../src/lib/content/source";

test("完整扫描现有 43 篇 Markdown，公开 42 篇并保留 1 篇草稿", async () => {
  const articles = await scanArticleSources(process.cwd());

  assert.equal(articles.length, 43);
  assert.equal(
    articles.filter((article) => article.status === "published").length,
    42,
  );
  assert.equal(
    articles.filter((article) => article.status === "draft").length,
    1,
  );
  assert.equal(new Set(articles.map((article) => article.slug)).size, 43);
  assert.equal(new Set(articles.map((article) => article.sourcePath)).size, 43);
});

test("原始 Markdown 不做不可逆清洗，hash 与磁盘内容一致", async () => {
  const articles = await scanArticleSources(process.cwd());
  const scrapy = articles.find(
    (article) => article.sourcePath === "essay/scrapy运行的过程.md",
  );

  assert.ok(scrapy);
  assert.match(scrapy.contentMarkdown, /<projectName>/);

  const source = await readFile(
    path.join(process.cwd(), ...scrapy.sourcePath.split("/")),
    "utf8",
  );
  assert.equal(
    scrapy.sourceHash,
    createHash("sha256").update(source).digest("hex"),
  );
});

test("Git 首次与最后变更时间分别进入发布时间和源更新时间", async () => {
  const articles = await scanArticleSources(process.cwd());

  for (const article of articles) {
    assert.match(article.publishedAt, /^20\d{2}-\d{2}-\d{2}T/);
    assert.match(article.sourceUpdatedAt, /^20\d{2}-\d{2}-\d{2}T/);
    assert.ok(
      Date.parse(article.sourceUpdatedAt) >= Date.parse(article.publishedAt),
      article.sourcePath,
    );
  }
});
