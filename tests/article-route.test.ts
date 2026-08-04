import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeArticleRouteSlug } from "../src/lib/content/route-slug";

test("文章路由兼容 Next 传入的中文百分号编码 slug", () => {
  const slug = "react和vue的对比--react中间context和vue中间的eventbus";

  assert.equal(decodeArticleRouteSlug(encodeURIComponent(slug)), slug);
  assert.equal(decodeArticleRouteSlug(slug), slug);
});

test("损坏的百分号编码作为无效路由处理", () => {
  assert.equal(decodeArticleRouteSlug("broken%route"), null);
});
