interface ArticleMetaProps {
  publishedAt: string | Date;
  sourceUpdatedAt?: string | Date;
  readingMinutes: number;
  showUpdated?: boolean;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Shanghai",
});

function toIsoString(value: string | Date): string | undefined {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function formatArticleDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "日期未知" : DATE_FORMATTER.format(date);
}

export function ArticleMeta({
  publishedAt,
  sourceUpdatedAt,
  readingMinutes,
  showUpdated = false,
}: ArticleMetaProps) {
  return (
    <dl className="article-meta">
      <div>
        <dt>发布</dt>
        <dd>
          <time dateTime={toIsoString(publishedAt)}>{formatArticleDate(publishedAt)}</time>
        </dd>
      </div>
      {showUpdated && sourceUpdatedAt ? (
        <div>
          <dt>更新</dt>
          <dd>
            <time dateTime={toIsoString(sourceUpdatedAt)}>
              {formatArticleDate(sourceUpdatedAt)}
            </time>
          </dd>
        </div>
      ) : null}
      <div>
        <dt>阅读</dt>
        <dd>{Math.max(1, readingMinutes)} 分钟</dd>
      </div>
    </dl>
  );
}
