import assert from "node:assert/strict";
import { test } from "node:test";

import nextConfig from "../next.config";

test("Next 以 /essay 独立部署并启用必要安全响应头", async () => {
  assert.equal(nextConfig.basePath, "/essay");
  assert.equal(nextConfig.output, "standalone");
  assert.equal(nextConfig.trailingSlash, true);
  assert.equal(nextConfig.poweredByHeader, false);
  assert.equal("experimental" in nextConfig, false);

  const rules = await nextConfig.headers?.();
  assert.ok(rules);
  assert.equal(rules.length, 1);
  assert.equal(rules[0]?.source, "/:path*");

  const headers = new Map(
    rules[0]?.headers.map(({ key, value }) => [key.toLocaleLowerCase(), value]),
  );
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("x-accel-buffering"), "no");
  assert.ok(headers.has("content-security-policy"));
  assert.ok(headers.has("permissions-policy"));
  assert.ok(headers.has("referrer-policy"));
});
