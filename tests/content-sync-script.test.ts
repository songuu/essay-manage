import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("内容同步复用当前镜像并在失败时恢复旧内容快照", async () => {
  const script = await readFile(
    path.join(process.cwd(), "scripts", "sync-content-production.ps1"),
    "utf8",
  );

  assert.match(script, /Invoke-Native "pnpm" @\("content:manifest"\)/);
  assert.match(script, /Invoke-Native "pnpm" @\("content:verify"\)/);
  assert.match(script, /Assert-CommittedWorktree @\("essay"\)/);
  assert.match(script, /CONTENT_LINK="\$ROOT\/content-current"/);
  assert.match(script, /\.source-commit/);
  assert.match(script, /run_content_import\(\)/);
  assert.match(script, /verify_database_snapshot\(\)/);
  assert.match(script, /SYNC_STARTED=1/);
  assert.match(
    script,
    /run_content_import "\$OLD_CONTENT" \|\| restore_status=\$\?/,
  );
  assert.match(script, /ACTUAL_DIGEST/);
  assert.match(script, /EXPECTED_DIGEST/);
  assert.match(script, /flock -w 900 9/);
  assert.match(script, /trap .* HUP/);
  assert.match(script, /trap .* INT/);
  assert.match(script, /trap .* TERM/);
  assert.match(script, /trap - ERR HUP INT TERM/);
  assert.match(script, /publishedArticles/);
  assert.match(script, /mv -Tf "\$CONTENT_LINK\.next" "\$CONTENT_LINK"/);
  assert.doesNotMatch(script, /--retry-all-errors/);

  const importNewContent = script.indexOf(
    "'run_content_import \"$CONTENT_RELEASE\"',",
  );
  const verifyDigest = script.indexOf("'if [ \"$ACTUAL_DIGEST\"");
  const commitContentLink = script.indexOf(
    "'mv -Tf \"$CONTENT_LINK.next\" \"$CONTENT_LINK\"',",
  );

  assert.ok(importNewContent >= 0);
  assert.ok(importNewContent < verifyDigest);
  assert.ok(verifyDigest < commitContentLink);

  const committedWorktree = script.indexOf('Assert-CommittedWorktree @("essay")');
  const manifestGeneration = script.indexOf(
    'Invoke-Native "pnpm" @("content:manifest")',
  );
  assert.ok(committedWorktree >= 0);
  assert.ok(committedWorktree < manifestGeneration);
});
