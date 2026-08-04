import Link from "next/link";

interface ArticleFiltersProps {
  query: string;
  collection: string;
  collections: string[];
  resultCount: number;
}

export function ArticleFilters({
  query,
  collection,
  collections,
  resultCount,
}: ArticleFiltersProps) {
  const hasFilters = Boolean(query || collection);

  return (
    <section className="archive-controls" aria-labelledby="archive-heading">
      <div className="archive-controls__heading">
        <div>
          <p className="section-kicker">ARCHIVE / INDEX</p>
          <h2 id="archive-heading">文章索引</h2>
        </div>
        <p className="archive-controls__count" aria-live="polite">
          <strong>{resultCount}</strong> 篇结果
        </p>
      </div>

      <form className="filter-form" action="/essay/" method="get" role="search">
        <label className="search-field">
          <span className="sr-only">搜索文章</span>
          <span className="search-field__icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="搜索标题或正文…"
            autoComplete="off"
          />
        </label>

        <label className="select-field">
          <span className="sr-only">按集合筛选</span>
          <select name="collection" defaultValue={collection}>
            <option value="">全部集合</option>
            {collections.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <button className="filter-submit" type="submit">
          检索
        </button>
        {hasFilters ? (
          <Link className="filter-reset" href="/">
            清除
          </Link>
        ) : null}
      </form>
    </section>
  );
}
