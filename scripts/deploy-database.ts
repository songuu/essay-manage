import path from "node:path";

import { importMarkdownArticles } from "./import-markdown";
import { migrateDatabase } from "./migrate-database";

export async function deployDatabase(): Promise<void> {
  const migration = await migrateDatabase();
  console.log(
    `数据库迁移完成：新增 ${migration.applied.length}，已存在 ${migration.skipped.length}`,
  );

  const imported = await importMarkdownArticles();
  console.log(
    `Markdown 导入完成：manifest ${imported.manifestArticles}，变更 ${imported.changedArticles}，归档 ${imported.archivedArticles}`,
  );
}

function isDirectExecution(): boolean {
  const entrypoint = path.basename(process.argv[1] ?? "").toLocaleLowerCase();
  return entrypoint === "deploy-database.ts" || entrypoint === "db-deploy.mjs";
}

if (isDirectExecution()) {
  deployDatabase().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
