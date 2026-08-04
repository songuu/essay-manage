import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("master push 按文章或代码变更选择内容同步与完整部署", async () => {
  const workflow = await readFile(
    path.join(
      process.cwd(),
      ".github",
      "workflows",
      "essay-manage-deploy.yml",
    ),
    "utf8",
  );

  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- master/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /group: essay-manage-production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /queue: max/);
  assert.match(workflow, /essay\/\*\.md\|content\/article-manifest\.json/);
  assert.match(workflow, /MODE=content/);
  assert.match(workflow, /MODE=full/);
  assert.match(workflow, /ESSAY_DEPLOY_SSH_PRIVATE_KEY/);
  assert.match(workflow, /ESSAY_DEPLOY_KNOWN_HOSTS/);
  assert.match(workflow, /StrictHostKeyChecking=yes/);
  assert.doesNotMatch(workflow, /ssh-keyscan/);
  assert.match(workflow, /DEPLOYED_SHA/);
  assert.match(workflow, /readlink -f "\$ROOT\/current"/);
  assert.doesNotMatch(workflow, /for link in "\$ROOT\/content-current"/);
  assert.match(
    workflow,
    /git diff --name-only -z "\$DEPLOYED_SHA" "\$GITHUB_SHA"/,
  );
  assert.doesNotMatch(workflow, /BEFORE_SHA/);
  assert.match(workflow, /pnpm content:manifest/);
  assert.match(workflow, /pnpm test/);
  assert.match(workflow, /pnpm lint/);
  assert.match(workflow, /pnpm typecheck/);
  assert.match(workflow, /sync-content-production\.ps1/);
  assert.match(workflow, /deploy-production\.ps1/);
  assert.match(workflow, /GITHUB_RUN_ID.*GITHUB_RUN_ATTEMPT/);
  assert.match(workflow, /-SourceCommit "\$GITHUB_SHA"/);

  const qualityGate = workflow.indexOf("pnpm test");
  const contentSync = workflow.indexOf("sync-content-production.ps1");
  const fullDeploy = workflow.indexOf("deploy-production.ps1");

  assert.ok(qualityGate >= 0);
  assert.ok(qualityGate < contentSync);
  assert.ok(qualityGate < fullDeploy);
});
