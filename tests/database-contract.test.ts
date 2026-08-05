import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { describeDatabaseError } from "../src/lib/db/client";
import {
  getCompatibleMigrationChecksums,
  normalizeMigrationSql,
  reconcileAppliedMigrationChecksums,
} from "../scripts/migrate-database";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("文章迁移包含发布状态、唯一源和中文 trigram 搜索索引", async () => {
  const migration = await readFile(
    path.join(process.cwd(), "migrations", "0001_create_articles.sql"),
    "utf8",
  );

  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pg_trgm/);
  assert.match(migration, /slug text NOT NULL UNIQUE/);
  assert.match(migration, /source_path text NOT NULL UNIQUE/);
  assert.match(
    migration,
    /status IN \('published', 'draft', 'archived'\)/,
  );
  assert.match(migration, /content_markdown text NOT NULL/);
  assert.match(migration, /source_hash char\(64\) NOT NULL/);
  assert.match(migration, /USING gin/);
  assert.match(migration, /gin_trgm_ops/);
});

test("迁移运行器使用 advisory lock 并跟踪 checksum", async () => {
  const runner = await readFile(
    path.join(process.cwd(), "scripts", "migrate-database.ts"),
    "utf8",
  );

  assert.match(runner, /pg_advisory_xact_lock/);
  assert.match(runner, /CREATE TABLE IF NOT EXISTS schema_migrations/);
  assert.match(runner, /checksum char\(64\) NOT NULL/);
  assert.match(runner, /checksum 漂移/);
  assert.match(runner, /await sql\.end\(\{ timeout: 5 \}\)/);
});

test("迁移 checksum 跨 LF、CRLF、CR 一致，并在事务分支收敛历史记录", async () => {
  const lfSql =
    "CREATE TABLE articles (id bigint);\nCREATE INDEX articles_id_idx ON articles (id);\n";
  const crlfSql = lfSql.replaceAll("\n", "\r\n");
  const crSql = lfSql.replaceAll("\n", "\r");

  assert.equal(normalizeMigrationSql(crlfSql), lfSql);
  assert.equal(normalizeMigrationSql(crSql), lfSql);

  const checksums = getCompatibleMigrationChecksums(lfSql);
  const canonicalChecksum = sha256(lfSql);
  const migration = {
    version: "0001_create_articles",
    checksum: canonicalChecksum,
    compatibleChecksums: checksums,
  };

  assert.ok(checksums.has(canonicalChecksum));
  assert.ok(checksums.has(sha256(crlfSql)));
  assert.ok(checksums.has(sha256(crSql)));
  assert.equal(
    checksums.has(sha256("CREATE TABLE articles (id text);\n")),
    false,
  );

  for (const legacySql of [crlfSql, crSql]) {
    const updates: Array<{ version: string; checksum: string }> = [];
    await reconcileAppliedMigrationChecksums(
      [{ version: migration.version, checksum: sha256(legacySql) }],
      [migration],
      async (version, checksum) => {
        updates.push({ version, checksum });
      },
    );
    assert.deepEqual(updates, [
      { version: migration.version, checksum: canonicalChecksum },
    ]);
  }

  await reconcileAppliedMigrationChecksums(
    [{ version: migration.version, checksum: canonicalChecksum }],
    [migration],
    async () => {
      assert.fail("canonical checksum must not be rewritten");
    },
  );

  await assert.rejects(
    () =>
      reconcileAppliedMigrationChecksums(
        [
          {
            version: migration.version,
            checksum: sha256("CREATE TABLE articles (id text);\n"),
          },
        ],
        [migration],
        async () => {
          assert.fail("drifted checksum must not be rewritten");
        },
      ),
    /已应用迁移 checksum 漂移: 0001_create_articles/,
  );
});

test("数据库错误上下文会清除连接凭据和密钥", () => {
  const message = describeDatabaseError(
    new Error(
      "connect postgresql://writer:super-secret@db.example/essay?password=hidden-value",
    ),
  );

  assert.doesNotMatch(message, /writer|super-secret|hidden-value/);
  assert.match(message, /credentials-redacted/);
  assert.match(message, /password=\[redacted\]/);
});
