import { listPublishedArticles } from "@/lib/db/articles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getEssayBaseUrl(): string {
  const configuredUrl = (process.env.SITE_URL ?? "https://songuu.top/essay").replace(/\/$/, "");
  return configuredUrl.endsWith("/essay") ? configuredUrl : `${configuredUrl}/essay`;
}

export async function GET() {
  const baseUrl = getEssayBaseUrl();
  const articles = await listPublishedArticles({ page: 1, pageSize: 100 });
  const items = articles.items
    .map((article) => {
      const articleUrl = `${baseUrl}/${encodeURIComponent(article.slug)}/`;
      return [
        "    <item>",
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${escapeXml(articleUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>`,
        `      <description>${escapeXml(article.excerpt)}</description>`,
        `      <category>${escapeXml(article.collection)}</category>`,
        `      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>折页 · 个人技术文章档案</title>",
    `    <link>${escapeXml(baseUrl)}</link>`,
    "    <description>把散落的工程经验，整理成可以再次检索的知识。</description>",
    "    <language>zh-CN</language>",
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
