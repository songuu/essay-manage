import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  pageCount: number;
  query: string;
  collection: string;
}

function getPageHref(page: number, query: string, collection: string): string {
  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (collection) search.set("collection", collection);
  if (page > 1) search.set("page", String(page));
  const suffix = search.toString();
  return suffix ? `/?${suffix}` : "/";
}

function getVisiblePages(currentPage: number, pageCount: number): number[] {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.min(Math.max(1, currentPage - 2), pageCount - 4);
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export function Pagination({
  currentPage,
  pageCount,
  query,
  collection,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const visiblePages = getVisiblePages(currentPage, pageCount);

  return (
    <nav className="pagination" aria-label="文章分页">
      {currentPage > 1 ? (
        <Link
          className="pagination__direction"
          href={getPageHref(currentPage - 1, query, collection)}
          rel="prev"
        >
          ← 上一页
        </Link>
      ) : (
        <span className="pagination__direction is-disabled">← 上一页</span>
      )}

      <div className="pagination__pages">
        {visiblePages[0] > 1 ? <span aria-hidden="true">…</span> : null}
        {visiblePages.map((page) => (
          <Link
            key={page}
            className={page === currentPage ? "is-current" : undefined}
            href={getPageHref(page, query, collection)}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </Link>
        ))}
        {visiblePages.at(-1)! < pageCount ? <span aria-hidden="true">…</span> : null}
      </div>

      {currentPage < pageCount ? (
        <Link
          className="pagination__direction"
          href={getPageHref(currentPage + 1, query, collection)}
          rel="next"
        >
          下一页 →
        </Link>
      ) : (
        <span className="pagination__direction is-disabled">下一页 →</span>
      )}
    </nav>
  );
}
