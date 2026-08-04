import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildArticleMetadata,
  createExcerpt,
  normalizeArticleSlug,
} from "../src/lib/content/metadata";

test("中文路径生成稳定、可读且去除尾随空格的 slug", () => {
  assert.equal(normalizeArticleSlug("essay/js循环.md"), "js循环");
  assert.equal(
    normalizeArticleSlug(
      "essay\\react和vue的对比\\react中间context和vue中间的EventBus.md",
    ),
    "react和vue的对比--react中间context和vue中间的eventbus",
  );
  assert.equal(
    normalizeArticleSlug("essay/typescript中间存在的合并 .md"),
    "typescript中间存在的合并",
  );
});

test("摘要从真实正文提取，并忽略非标准标题标记与代码围栏", () => {
  const markdown = [
    "###标题不会成为摘要",
    "",
    "> 这是 **第一段**，应当成为摘要。",
    "",
    "```",
    "const hidden = true",
    "```",
  ].join("\n");

  assert.equal(createExcerpt(markdown), "这是第一段，应当成为摘要。");
});

test("空 Markdown 作为草稿保留，非空 Markdown 才公开", () => {
  const dates = {
    publishedAt: "2019-01-09T07:17:18.000Z",
    sourceUpdatedAt: "2020-07-23T14:46:12.000Z",
  };

  const draft = buildArticleMetadata({
    sourcePath: "essay/react和vue的对比/react中redux和vue中vuex.md",
    contentMarkdown: "",
    ...dates,
  });
  const published = buildArticleMetadata({
    sourcePath: "essay/vue数据响应.md",
    contentMarkdown: "**一:第一步**\n\n响应式内容",
    ...dates,
  });

  assert.equal(draft.status, "draft");
  assert.equal(draft.title, "react中redux和vue中vuex");
  assert.equal(draft.collection, "react和vue的对比");
  assert.equal(published.status, "published");
  assert.equal(published.collection, "技术随笔");
  assert.ok(published.readingMinutes >= 1);
  assert.match(published.sourceHash, /^[a-f0-9]{64}$/);
});

