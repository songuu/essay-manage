import type { Metadata, Viewport } from "next";

import { SiteFooter, SiteHeader } from "@/components/site-header";

import "./globals.css";

export const dynamic = "force-dynamic";

function getMetadataBase(): URL {
  const configuredUrl =
    process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://songuu.top/essay";
  try {
    return new URL(configuredUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "折页 · 个人技术文章档案",
    template: "%s · 折页",
  },
  description: "从 Markdown 原稿整理而来的个人技术文章档案。",
  applicationName: "折页",
  alternates: { canonical: "/essay/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "折页",
    title: "折页 · 个人技术文章档案",
    description: "把散落的工程经验，整理成可以再次检索的知识。",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0c12",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到正文
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
