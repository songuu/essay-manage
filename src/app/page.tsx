import Link from "next/link";

import { ArticleCard } from "@/components/article-card";
import { ArticleFilters } from "@/components/article-filters";
import { Pagination } from "@/components/pagination";
import { listPublishedArticles } from "@/lib/db/articles";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

function parsePage(value: string): number {
  const page = Number.parseInt(value, 10);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const query = firstValue(resolvedSearchParams.q).slice(0, 120);
  const collection = firstValue(resolvedSearchParams.collection).slice(0, 120);
  const requestedPage = parsePage(firstValue(resolvedSearchParams.page));

  const [articles, overview] = await Promise.all([
    listPublishedArticles({ query, collection, page: requestedPage, pageSize: PAGE_SIZE }),
    listPublishedArticles({ page: 1, pageSize: 1 }),
  ]);

  const currentPage = articles.page;

  return (
    <main id="main-content">
      <section className="archive-hero" aria-labelledby="archive-title">
        <div className="archive-hero__grid" aria-hidden="true" />
        <div className="archive-hero__orb" aria-hidden="true">
          <span>MD</span>
        </div>

        <div className="archive-hero__copy">
          <p className="hero-eyebrow">
            <span>ENGINEERING NOTES</span>
            <span>2019—2020 · 2026 校订</span>
          </p>
          <h1 id="archive-title">
            经验写下来，
            <em>才能被再次使用。</em>
          </h1>
          <p className="archive-hero__lead">
            关于 JavaScript、工程实践与产品构建的个人技术档案。保留原始 Markdown 的思考痕迹；原文已按官方资料逐篇校订，让每一次检索更快抵达答案。
          </p>
          <a className="hero-action" href="#archive-heading">
            浏览文章 <span aria-hidden="true">↓</span>
          </a>
        </div>

        <dl className="archive-stats" aria-label="文章库概况">
          <div>
            <dt>{overview.total}</dt>
            <dd>公开文章</dd>
          </div>
          <div>
            <dt>{overview.collections.length}</dt>
            <dd>主题集合</dd>
          </div>
          <div>
            <dt>MD</dt>
            <dd>原稿驱动</dd>
          </div>
        </dl>
      </section>

      <div className="archive-shell">
        <ArticleFilters
          query={query}
          collection={collection}
          collections={overview.collections}
          resultCount={articles.total}
        />

        {articles.items.length > 0 ? (
          <div className="article-grid">
            {articles.items.map((article, index) => (
              <ArticleCard
                key={article.slug}
                article={article}
                index={(currentPage - 1) * PAGE_SIZE + index + 1}
              />
            ))}
          </div>
        ) : (
          <section className="empty-state">
            <span aria-hidden="true">∅</span>
            <h2>没有找到匹配的文章</h2>
            <p>换一个关键词，或清除当前集合筛选后再试。</p>
            <Link className="button-link" href="/">
              查看全部文章
            </Link>
          </section>
        )}

        <Pagination
          currentPage={currentPage}
          pageCount={articles.pageCount}
          query={query}
          collection={collection}
        />
      </div>
    </main>
  );
}
