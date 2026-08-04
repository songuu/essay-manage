import type { MetadataRoute } from "next";

import { listPublishedArticles } from "@/lib/db/articles";

export const dynamic = "force-dynamic";

function getEssayBaseUrl(): string {
  const configuredUrl = (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://songuu.top/essay"
  ).replace(/\/$/, "");
  return configuredUrl.endsWith("/essay") ? configuredUrl : `${configuredUrl}/essay`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getEssayBaseUrl();
  const fallback: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
  ];

  try {
    const articles = await listPublishedArticles({ page: 1, pageSize: 100 });
    return [
      ...fallback,
      ...articles.items.map((article) => ({
        url: `${baseUrl}/${encodeURIComponent(article.slug)}/`,
        lastModified: new Date(article.sourceUpdatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    console.error("[sitemap] 无法从数据库读取文章，返回站点入口", error);
    return fallback;
  }
}
