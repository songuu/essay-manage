import Link from "next/link";

import { ArticleMeta } from "@/components/article-meta";

interface ArticleCardProps {
  article: {
    slug: string;
    title: string;
    excerpt: string;
    collection: string;
    publishedAt: string | Date;
    sourceUpdatedAt: string | Date;
    readingMinutes: number;
  };
  index: number;
}

export function ArticleCard({ article, index }: ArticleCardProps) {
  return (
    <article className="article-card">
      <div className="article-card__topline">
        <span className="article-card__index" aria-hidden="true">
          {String(index).padStart(2, "0")}
        </span>
        <Link
          className="collection-chip"
          href={`/?collection=${encodeURIComponent(article.collection)}`}
        >
          {article.collection}
        </Link>
      </div>

      <div className="article-card__body">
        <h2>
          <Link href={`/${article.slug}`}>{article.title}</Link>
        </h2>
        <p>{article.excerpt || "这篇文章暂时没有摘要，点击进入阅读完整内容。"}</p>
      </div>

      <div className="article-card__footer">
        <ArticleMeta
          publishedAt={article.publishedAt}
          sourceUpdatedAt={article.sourceUpdatedAt}
          readingMinutes={article.readingMinutes}
        />
        <Link className="article-card__read" href={`/${article.slug}`}>
          阅读全文 <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
