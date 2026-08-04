import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleMeta } from "@/components/article-meta";
import { MarkdownArticle } from "@/components/markdown-article";
import { decodeArticleRouteSlug } from "@/lib/content/route-slug";
import {
  getAdjacentArticles,
  getPublishedArticleBySlug,
} from "@/lib/db/articles";

export const dynamic = "force-dynamic";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug: routeSlug } = await params;
  const slug = decodeArticleRouteSlug(routeSlug);

  if (!slug) return { title: "文章未找到" };

  try {
    const article = await getPublishedArticleBySlug(slug);
    if (!article) return { title: "文章未找到" };

    return {
      title: article.title,
      description: article.excerpt,
      alternates: { canonical: `/essay/${article.slug}/` },
      openGraph: {
        type: "article",
        title: article.title,
        description: article.excerpt,
        publishedTime: new Date(article.publishedAt).toISOString(),
        modifiedTime: new Date(article.sourceUpdatedAt).toISOString(),
      },
    };
  } catch {
    return { title: "技术文章" };
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug: routeSlug } = await params;
  const slug = decodeArticleRouteSlug(routeSlug);

  if (!slug) notFound();
  const article = await getPublishedArticleBySlug(slug);

  if (!article) notFound();

  const adjacent = await getAdjacentArticles(article.slug);

  return (
    <main id="main-content" className="article-page">
      <article>
        <header className="article-hero">
          <Link className="back-link" href="/">
            <span aria-hidden="true">←</span> 返回文章列表
          </Link>
          <div className="article-hero__content">
            <p className="article-hero__collection">{article.collection}</p>
            <h1>{article.title}</h1>
            {article.excerpt ? <p className="article-hero__excerpt">{article.excerpt}</p> : null}
            <ArticleMeta
              publishedAt={article.publishedAt}
              sourceUpdatedAt={article.sourceUpdatedAt}
              readingMinutes={article.readingMinutes}
              showUpdated
            />
          </div>
          <div className="article-hero__rail" aria-hidden="true">
            <span>ARTICLE</span>
            <span>MARKDOWN</span>
          </div>
        </header>

        <div className="article-content-shell">
          <aside className="reading-rail" aria-label="阅读提示">
            <span>READ</span>
            <i />
            <small>{Math.max(1, article.readingMinutes)} MIN</small>
          </aside>
          <MarkdownArticle markdown={article.contentMarkdown} />
        </div>
      </article>

      <nav className="article-adjacent" aria-label="相邻文章">
        {adjacent.previous ? (
          <Link href={`/${adjacent.previous.slug}`} className="article-adjacent__item">
            <small>← 较早一篇</small>
            <strong>{adjacent.previous.title}</strong>
          </Link>
        ) : (
          <span className="article-adjacent__item is-empty">
            <small>← 较早一篇</small>
            <strong>已经是最早的文章</strong>
          </span>
        )}
        {adjacent.next ? (
          <Link
            href={`/${adjacent.next.slug}`}
            className="article-adjacent__item article-adjacent__item--next"
          >
            <small>较新一篇 →</small>
            <strong>{adjacent.next.title}</strong>
          </Link>
        ) : (
          <span className="article-adjacent__item article-adjacent__item--next is-empty">
            <small>较新一篇 →</small>
            <strong>已经是最新的文章</strong>
          </span>
        )}
      </nav>
    </main>
  );
}
