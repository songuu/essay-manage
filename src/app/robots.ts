import type { MetadataRoute } from "next";

function getEssayBaseUrl(): string {
  const configuredUrl = (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://songuu.top/essay"
  ).replace(/\/$/, "");
  return configuredUrl.endsWith("/essay") ? configuredUrl : `${configuredUrl}/essay`;
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/essay/" },
    sitemap: `${getEssayBaseUrl()}/sitemap.xml`,
  };
}
