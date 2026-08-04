import {
  describeDatabaseError,
  getDatabaseClient,
  type DatabaseClient,
} from "./client";

export interface ArticleListItem {
  slug: string;
  title: string;
  excerpt: string;
  collection: string;
  publishedAt: string;
  sourceUpdatedAt: string;
  wordCount: number;
  readingMinutes: number;
}

export interface ArticleDetail extends ArticleListItem {
  sourcePath: string;
  sourceHash: string;
  contentMarkdown: string;
}

export interface ListPublishedArticlesOptions {
  query?: string;
  collection?: string;
  page?: number;
  pageSize?: number;
}

export interface ListPublishedArticlesResult {
  items: ArticleListItem[];
  total: number;
  page: number;
  pageCount: number;
  collections: string[];
}

export interface AdjacentArticles {
  previous: ArticleListItem | null;
  next: ArticleListItem | null;
}

export interface DatabaseHealth {
  publishedArticles: number;
}

interface ArticleListRow {
  slug: string;
  title: string;
  excerpt: string;
  collection: string;
  published_at: Date | string;
  source_updated_at: Date | string;
  word_count: number | string;
  reading_minutes: number | string;
}

interface ArticleDetailRow extends ArticleListRow {
  source_path: string;
  source_hash: string;
  content_markdown: string;
}

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum?: number,
): number {
  if (!Number.isFinite(value) || value === undefined || value < 1) {
    return fallback;
  }

  const integer = Math.floor(value);
  return maximum === undefined ? integer : Math.min(integer, maximum);
}

function normalizeOptionalText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function toIsoString(value: Date | string, fieldName: string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`数据库字段 ${fieldName} 不是有效时间`);
  }

  return date.toISOString();
}

function toSafeNumber(value: number | string, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`数据库字段 ${fieldName} 不是有效数字`);
  }

  return parsed;
}

function mapArticleListRow(row: ArticleListRow): ArticleListItem {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    collection: row.collection,
    publishedAt: toIsoString(row.published_at, "published_at"),
    sourceUpdatedAt: toIsoString(row.source_updated_at, "source_updated_at"),
    wordCount: toSafeNumber(row.word_count, "word_count"),
    readingMinutes: toSafeNumber(row.reading_minutes, "reading_minutes"),
  };
}

function mapArticleDetailRow(row: ArticleDetailRow): ArticleDetail {
  return {
    ...mapArticleListRow(row),
    sourcePath: row.source_path,
    sourceHash: row.source_hash,
    contentMarkdown: row.content_markdown,
  };
}

function databaseQueryError(context: string, error: unknown): Error {
  return new Error(`${context}: ${describeDatabaseError(error)}`);
}

async function queryArticleList(
  sql: DatabaseClient,
  query: string | null,
  collection: string | null,
  pageSize: number,
  offset: number,
): Promise<ArticleListRow[]> {
  const searchPattern = query === null ? null : `%${escapeLikePattern(query)}%`;

  return sql<ArticleListRow[]>`
    SELECT
      slug,
      title,
      excerpt,
      collection,
      published_at,
      source_updated_at,
      word_count,
      reading_minutes
    FROM articles
    WHERE status = 'published'
      AND (
        ${searchPattern}::text IS NULL
        OR (
          title || E'\n' || excerpt || E'\n' || content_markdown
        ) ILIKE ${searchPattern} ESCAPE E'\\\\'
      )
      AND (${collection}::text IS NULL OR collection = ${collection})
    ORDER BY published_at DESC, slug ASC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;
}

export async function listPublishedArticles(
  options: ListPublishedArticlesOptions = {},
): Promise<ListPublishedArticlesResult> {
  const page = normalizePositiveInteger(options.page, 1);
  const pageSize = normalizePositiveInteger(
    options.pageSize,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const query = normalizeOptionalText(options.query);
  const collection = normalizeOptionalText(options.collection);
  const searchPattern = query === null ? null : `%${escapeLikePattern(query)}%`;
  const offset = (page - 1) * pageSize;

  try {
    const sql = getDatabaseClient();
    const [rows, countRows, collectionRows] = await Promise.all([
      queryArticleList(sql, query, collection, pageSize, offset),
      sql<{ total: number | string }[]>`
        SELECT count(*)::bigint AS total
        FROM articles
        WHERE status = 'published'
          AND (
            ${searchPattern}::text IS NULL
            OR (
              title || E'\n' || excerpt || E'\n' || content_markdown
            ) ILIKE ${searchPattern} ESCAPE E'\\\\'
          )
          AND (${collection}::text IS NULL OR collection = ${collection})
      `,
      sql<{ collection: string }[]>`
        SELECT DISTINCT collection
        FROM articles
        WHERE status = 'published'
        ORDER BY collection ASC
      `,
    ]);
    const total = toSafeNumber(countRows[0]?.total ?? 0, "total");

    return {
      items: rows.map(mapArticleListRow),
      total,
      page,
      pageCount: Math.ceil(total / pageSize),
      collections: collectionRows.map((row) => row.collection),
    };
  } catch (error) {
    throw databaseQueryError("查询已发布文章列表失败", error);
  }
}

export async function getPublishedArticleBySlug(
  slug: string,
): Promise<ArticleDetail | null> {
  try {
    const sql = getDatabaseClient();
    const rows = await sql<ArticleDetailRow[]>`
      SELECT
        slug,
        source_path,
        source_hash,
        title,
        excerpt,
        collection,
        content_markdown,
        published_at,
        source_updated_at,
        word_count,
        reading_minutes
      FROM articles
      WHERE status = 'published' AND slug = ${slug}
      LIMIT 1
    `;

    return rows[0] ? mapArticleDetailRow(rows[0]) : null;
  } catch (error) {
    throw databaseQueryError(`查询已发布文章详情失败 (slug=${slug})`, error);
  }
}

export async function getAdjacentArticles(slug: string): Promise<AdjacentArticles> {
  try {
    const sql = getDatabaseClient();
    const currentRows = await sql<
      { published_at: Date | string; slug: string }[]
    >`
      SELECT published_at, slug
      FROM articles
      WHERE status = 'published' AND slug = ${slug}
      LIMIT 1
    `;
    const current = currentRows[0];

    if (!current) {
      return { previous: null, next: null };
    }

    const [previousRows, nextRows] = await Promise.all([
      sql<ArticleListRow[]>`
        SELECT
          slug,
          title,
          excerpt,
          collection,
          published_at,
          source_updated_at,
          word_count,
          reading_minutes
        FROM articles
        WHERE status = 'published'
          AND (
            published_at < ${current.published_at}
            OR (published_at = ${current.published_at} AND slug > ${current.slug})
          )
        ORDER BY published_at DESC, slug ASC
        LIMIT 1
      `,
      sql<ArticleListRow[]>`
        SELECT
          slug,
          title,
          excerpt,
          collection,
          published_at,
          source_updated_at,
          word_count,
          reading_minutes
        FROM articles
        WHERE status = 'published'
          AND (
            published_at > ${current.published_at}
            OR (published_at = ${current.published_at} AND slug < ${current.slug})
          )
        ORDER BY published_at ASC, slug DESC
        LIMIT 1
      `,
    ]);

    return {
      previous: previousRows[0] ? mapArticleListRow(previousRows[0]) : null,
      next: nextRows[0] ? mapArticleListRow(nextRows[0]) : null,
    };
  } catch (error) {
    throw databaseQueryError(`查询相邻文章失败 (slug=${slug})`, error);
  }
}

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  try {
    const sql = getDatabaseClient();
    const rows = await sql<{ published_articles: number | string }[]>`
      SELECT count(*)::bigint AS published_articles
      FROM articles
      WHERE status = 'published'
    `;

    return {
      publishedArticles: toSafeNumber(
        rows[0]?.published_articles ?? 0,
        "published_articles",
      ),
    };
  } catch (error) {
    throw databaseQueryError("检查文章数据库健康状态失败", error);
  }
}
