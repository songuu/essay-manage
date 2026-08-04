import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("数据库导入在校验 hash 与写库前规范化 Markdown 换行", async () => {
  const script = await readFile(
    path.join(process.cwd(), "scripts", "import-markdown.ts"),
    "utf8",
  );

  assert.match(script, /normalizeMarkdownContent\(\s*await readFile/);
  assert.match(
    script,
    /createHash\("sha256"\)\s*\.update\(contentMarkdown\)/,
  );
  assert.match(script, /content_markdown: article\.contentMarkdown/);
});
