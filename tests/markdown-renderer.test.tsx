import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { MarkdownArticle } from "../src/components/markdown-article";

test("类似 HTML 标签的项目占位符会保留为文本且不会注入元素", () => {
  const rendered = renderToStaticMarkup(
    <MarkdownArticle markdown={"运行 <projectName> build，不执行 <script>alert(1)</script>。"} />,
  );

  assert.match(rendered, /&lt;projectName&gt;/);
  assert.match(rendered, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(rendered, /<projectname(?:\s|>)/i);
  assert.doesNotMatch(rendered, /<script(?:\s|>)/i);
});

test("Markdown 外链在新窗口打开并阻断 opener", () => {
  const rendered = renderToStaticMarkup(
    <MarkdownArticle markdown={"[示例站点](https://example.com/docs)"} />,
  );

  assert.match(rendered, /href="https:\/\/example\.com\/docs"/);
  assert.match(rendered, /target="_blank"/);
  assert.match(rendered, /rel="noopener noreferrer"/);
});
