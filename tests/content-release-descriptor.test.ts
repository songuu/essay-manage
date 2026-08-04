import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { createContentReleaseDescriptor } from "../scripts/content-release-descriptor";

test("内容发布描述符按 C 排序生成可核对的活动文章摘要", () => {
  const manifest = {
    version: 1,
    generatedAt: "2026-08-04T00:00:00.000Z",
    sourceCommit: "a".repeat(40),
    articles: [
      {
        sourcePath: "essay/中文.md",
        sourceHash: "b".repeat(64),
        status: "published",
      },
      {
        sourcePath: "essay/a.md",
        sourceHash: "c".repeat(64),
        status: "draft",
      },
      {
        sourcePath: "essay/old.md",
        sourceHash: "d".repeat(64),
        status: "archived",
      },
    ],
  };
  const canonical = [
    `essay/a.md|${"c".repeat(64)}|draft`,
    `essay/中文.md|${"b".repeat(64)}|published`,
    "",
  ].join("\n");

  assert.deepEqual(createContentReleaseDescriptor(manifest), {
    sourceCommit: "a".repeat(40),
    totalArticles: 2,
    publishedArticles: 1,
    draftArticles: 1,
    digest: createHash("sha256").update(canonical).digest("hex"),
  });
});

test("内容发布描述符拒绝空清单和非法 hash", () => {
  assert.throws(
    () =>
      createContentReleaseDescriptor({
        version: 1,
        sourceCommit: "a".repeat(40),
        articles: [],
      }),
    /没有可同步的活动文章/,
  );
  assert.throws(
    () =>
      createContentReleaseDescriptor({
        version: 1,
        sourceCommit: "a".repeat(40),
        articles: [
          {
            sourcePath: "essay/a.md",
            sourceHash: "bad",
            status: "published",
          },
        ],
      }),
    /sourceHash/,
  );
});
