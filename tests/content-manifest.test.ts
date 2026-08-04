import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  createContentManifest,
  getComparableManifest,
  type ContentManifest,
} from "../scripts/generate-content-manifest";

test("metadata-only manifest 与当前全部 Markdown 源保持一致", async () => {
  const repositoryRoot = process.cwd();
  const manifestPath = path.join(
    repositoryRoot,
    "content",
    "article-manifest.json",
  );
  const stored = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as ContentManifest;
  const expected = await createContentManifest(repositoryRoot, stored.generatedAt);

  assert.deepEqual(getComparableManifest(stored), getComparableManifest(expected));
  assert.ok(stored.articles.length > 0);
  assert.equal(stored.articles.length, expected.articles.length);
  assert.ok(
    stored.articles.every(
      (article) => article.status === "published" || article.status === "draft",
    ),
  );
  assert.ok(
    stored.articles.every(
      (article) => !("contentMarkdown" in (article as unknown as object)),
    ),
  );
});
