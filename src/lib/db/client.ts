import postgres from "postgres";

export type DatabaseClient = postgres.Sql;

interface CreateDatabaseClientOptions {
  databaseUrl?: string;
  maxConnections?: number;
}

let sharedDatabaseClient: DatabaseClient | undefined;

function requireDatabaseUrl(explicitUrl?: string): string {
  const databaseUrl = explicitUrl?.trim() || process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL 未配置，无法连接 PostgreSQL");
  }

  return databaseUrl;
}

export function describeDatabaseError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const configuredUrl = process.env.DATABASE_URL?.trim();
  let redacted = configuredUrl
    ? rawMessage.replaceAll(configuredUrl, "[DATABASE_URL]")
    : rawMessage;

  redacted = redacted
    .replace(
      /(postgres(?:ql)?:\/\/)([^@\s/]+)@/giu,
      "$1[credentials-redacted]@",
    )
    .replace(
      /((?:password|passwd|token|api[_-]?key)\s*[=:]\s*)[^\s,;]+/giu,
      "$1[redacted]",
    );

  return redacted || "未知数据库错误";
}

export function createDatabaseClient(
  options: CreateDatabaseClientOptions = {},
): DatabaseClient {
  const databaseUrl = requireDatabaseUrl(options.databaseUrl);

  try {
    return postgres(databaseUrl, {
      max: options.maxConnections ?? 10,
      connect_timeout: 10,
      idle_timeout: 20,
      prepare: true,
    });
  } catch (error) {
    throw new Error(`初始化 PostgreSQL 客户端失败: ${describeDatabaseError(error)}`);
  }
}

export function getDatabaseClient(): DatabaseClient {
  sharedDatabaseClient ??= createDatabaseClient();
  return sharedDatabaseClient;
}
