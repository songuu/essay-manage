import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  createDatabaseClient,
  describeDatabaseError,
} from "../src/lib/db/client";

export interface MigrationChecksumRecord {
  version: string;
  checksum: string;
  compatibleChecksums: ReadonlySet<string>;
}

interface MigrationFile extends MigrationChecksumRecord {
  sql: string;
}

export interface AppliedMigrationRow {
  version: string;
  checksum: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

interface MigrateDatabaseOptions {
  databaseUrl?: string;
  repositoryRoot?: string;
}

export function normalizeMigrationSql(sql: string): string {
  return sql.replace(/\r\n?/g, "\n");
}

function checksumSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export function getCompatibleMigrationChecksums(
  sql: string,
): ReadonlySet<string> {
  const canonicalSql = normalizeMigrationSql(sql);
  return new Set([
    checksumSql(canonicalSql),
    checksumSql(canonicalSql.replaceAll("\n", "\r\n")),
    checksumSql(canonicalSql.replaceAll("\n", "\r")),
  ]);
}

export async function reconcileAppliedMigrationChecksums(
  appliedRows: readonly AppliedMigrationRow[],
  migrations: readonly MigrationChecksumRecord[],
  updateChecksum: (version: string, checksum: string) => Promise<void>,
): Promise<void> {
  const migrationByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );

  for (const applied of appliedRows) {
    const localMigration = migrationByVersion.get(applied.version);

    if (!localMigration) {
      throw new Error(
        `数据库存在本地缺失的已应用迁移: ${applied.version}`,
      );
    }

    const appliedChecksum = applied.checksum.trim();
    if (!localMigration.compatibleChecksums.has(appliedChecksum)) {
      throw new Error(
        `已应用迁移 checksum 漂移: ${applied.version}`,
      );
    }

    if (localMigration.checksum !== appliedChecksum) {
      await updateChecksum(applied.version, localMigration.checksum);
    }
  }
}

async function loadMigrations(repositoryRoot: string): Promise<MigrationFile[]> {
  const migrationsDirectory = path.join(repositoryRoot, "migrations");
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const fileNames = entries
    .filter(
      (entry) => entry.isFile() && /^\d+[_-].+\.sql$/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));

  if (fileNames.length === 0) {
    throw new Error(`没有找到数据库迁移文件: ${migrationsDirectory}`);
  }

  return Promise.all(
    fileNames.map(async (fileName) => {
      const sourceSql = await readFile(
        path.join(migrationsDirectory, fileName),
        "utf8",
      );
      const sql = normalizeMigrationSql(sourceSql);
      return {
        version: fileName.replace(/\.sql$/i, ""),
        checksum: checksumSql(sql),
        compatibleChecksums: getCompatibleMigrationChecksums(sql),
        sql,
      };
    }),
  );
}

export async function migrateDatabase(
  options: MigrateDatabaseOptions = {},
): Promise<MigrationResult> {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const migrations = await loadMigrations(repositoryRoot);
  const sql = createDatabaseClient({
    databaseUrl: options.databaseUrl,
    maxConnections: 1,
  });

  try {
    return await sql.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtext('essay-manage:schema-migrations')
        )
      `;
      await transaction`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version text PRIMARY KEY,
          checksum char(64) NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      const appliedRows = await transaction<AppliedMigrationRow[]>`
        SELECT version, checksum
        FROM schema_migrations
        ORDER BY version ASC
      `;
      await reconcileAppliedMigrationChecksums(
        appliedRows,
        migrations,
        async (version, checksum) => {
          await transaction`
            UPDATE schema_migrations
            SET checksum = ${checksum}
            WHERE version = ${version}
          `;
        },
      );

      const appliedChecksums = new Map(
        appliedRows.map((migration) => [
          migration.version,
          migration.checksum.trim(),
        ]),
      );
      const result: MigrationResult = { applied: [], skipped: [] };

      for (const migration of migrations) {
        if (appliedChecksums.has(migration.version)) {
          result.skipped.push(migration.version);
          continue;
        }

        await transaction.unsafe(migration.sql);
        await transaction`
          INSERT INTO schema_migrations (version, checksum)
          VALUES (${migration.version}, ${migration.checksum})
        `;
        result.applied.push(migration.version);
      }

      return result;
    });
  } catch (error) {
    throw new Error(`数据库迁移失败: ${describeDatabaseError(error)}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function isDirectExecution(): boolean {
  return path.basename(process.argv[1] ?? "").toLocaleLowerCase() ===
    "migrate-database.ts";
}

if (isDirectExecution()) {
  migrateDatabase()
    .then((result) => {
      console.log(
        `数据库迁移完成：新增 ${result.applied.length}，已存在 ${result.skipped.length}`,
      );
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
