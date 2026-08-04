import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("生产部署兼容旧版 curl 且应用与 Nginx 切换可事务回滚", async () => {
  const script = await readFile(
    path.join(process.cwd(), "scripts", "deploy-production.ps1"),
    "utf8",
  );

  assert.doesNotMatch(script, /--retry-all-errors/);
  assert.match(
    script,
    /if \[ -L "\$ROOT\/current" \]; then[\s\S]*OLD_CURRENT=\$\(readlink -f "\$ROOT\/current"\)/,
  );
  assert.match(script, /restore_previous_app\(\)/);
  assert.match(script, /APP_SWITCH_STARTED=1/);
  assert.match(script, /restore_previous_app \|\| app_restore_status=\$\?/);
  assert.match(script, /restore_release_links\(\)/);
  assert.match(script, /LINKS_MUTATED=1/);
  assert.match(script, /nginx_restore_status=0/);
  assert.match(
    script,
    /automatic deployment compensation failed \(links=\$links_restore_status nginx=\$nginx_restore_status app=\$app_restore_status\)/,
  );
  assert.doesNotMatch(script, /restore_current \|\| true/);
  assert.match(
    script,
    /current_compose up --detach --no-deps --wait app \|\| app_restore_status=\$\?/,
  );
  assert.match(script, /restore_current_links\(\)/);
  assert.match(script, /ROLLBACK_LINKS_MUTATED=1/);
  assert.match(script, /abort_rollback 76 "rollback release link commit failed"/);
  assert.match(
    script,
    /for candidate in \/etc\/nginx\/sites-enabled\/\* \/etc\/nginx\/conf\.d\/\*\.conf/,
  );
  assert.match(script, /wait_for_http_status\(\)/);
  assert.match(
    script,
    /wait_for_http_status 308 "https:\/\/\$DOMAIN\/essay" 12/,
  );

  const captureCurrent = script.indexOf(
    "'if [ -L \"$ROOT/current\" ]; then',",
  );
  const switchApp = script.indexOf(
    "'if ! compose up --detach --remove-orphans --wait; then',",
  );
  const commitCurrent = script.indexOf(
    "'ln -sfn \"$RELEASE\" \"$ROOT/current\"',",
  );
  const armLinkCompensation = script.indexOf("'LINKS_MUTATED=1',");

  assert.ok(captureCurrent >= 0);
  assert.ok(captureCurrent < switchApp);
  assert.ok(switchApp < armLinkCompensation);
  assert.ok(armLinkCompensation < commitCurrent);
  assert.ok(switchApp < commitCurrent);
});
