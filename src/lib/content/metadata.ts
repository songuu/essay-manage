import { createHash } from "node:crypto";
import path from "node:path";

export type ArticleStatus = "draft" | "published" | "archived";

export interface ArticleMetadata {
  sourcePath: string;
  sourceHash: string;
  slug: string;
  title: string;
  excerpt: string;
  collection: string;
  status: ArticleStatus;
  publishedAt: string;
  sourceUpdatedAt: string;
  wordCount: number;
  readingMinutes: number;
}

export interface ArticleSource extends ArticleMetadata {
  contentMarkdown: string;
}

interface BuildArticleMetadataInput {
  sourcePath: string;
  contentMarkdown: string;
  publishedAt: string;
  sourceUpdatedAt: string;
}

const MARKDOWN_EXTENSION = /\.md$/i;
const CODE_FENCE = /```[\s\S]*?```/g;
const CJK_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const LATIN_WORD = /[\p{Letter}\p{Number}]+/gu;

export function normalizeMarkdownContent(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

function normalizePath(sourcePath: string): string {
  return sourcePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function normalizeSlugSegment(segment: string): string {
  return segment
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeArticleSlug(sourcePath: string): string {
  const normalized = normalizePath(sourcePath)
    .replace(/^essay\//, "")
    .replace(MARKDOWN_EXTENSION, "");
  const segments = normalized.split("/").map(normalizeSlugSegment).filter(Boolean);

  if (segments.length === 0) {
    throw new Error(`无法从文章路径生成 slug: ${sourcePath}`);
  }

  return segments.join("--");
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])/gu, "$1")
    .trim();
}

export function createExcerpt(markdown: string, maxLength = 150): string {
  const withoutCode = markdown.replace(CODE_FENCE, "");

  for (const sourceLine of withoutCode.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || /^#{1,6}/.test(line) || /^[-=]{3,}$/.test(line)) {
      continue;
    }

    const plainText = stripInlineMarkdown(line);
    if (!plainText) {
      continue;
    }

    return plainText.length > maxLength
      ? `${plainText.slice(0, maxLength).trimEnd()}…`
      : plainText;
  }

  return "";
}

function getCollection(sourcePath: string): string {
  const normalized = normalizePath(sourcePath).replace(/^essay\//, "");
  const directory = path.posix.dirname(normalized);
  return directory === "." ? "技术随笔" : directory.split("/")[0];
}

function countWords(markdown: string): {
  wordCount: number;
  readingMinutes: number;
} {
  const prose = markdown.replace(CODE_FENCE, " ");
  const cjkCount = prose.match(CJK_CHARACTER)?.length ?? 0;
  const latinCount = prose
    .replace(CJK_CHARACTER, " ")
    .match(LATIN_WORD)?.length ?? 0;
  const wordCount = cjkCount + latinCount;
  const minutes = cjkCount / 300 + latinCount / 200;

  return {
    wordCount,
    readingMinutes: wordCount === 0 ? 0 : Math.max(1, Math.ceil(minutes)),
  };
}

export function buildArticleMetadata({
  sourcePath,
  contentMarkdown,
  publishedAt,
  sourceUpdatedAt,
}: BuildArticleMetadataInput): ArticleMetadata {
  const normalizedSourcePath = normalizePath(sourcePath);
  const normalizedMarkdown = normalizeMarkdownContent(contentMarkdown);
  const fileName = path.posix.basename(normalizedSourcePath).replace(MARKDOWN_EXTENSION, "");
  const { wordCount, readingMinutes } = countWords(normalizedMarkdown);

  return {
    sourcePath: normalizedSourcePath,
    sourceHash: createHash("sha256").update(normalizedMarkdown).digest("hex"),
    slug: normalizeArticleSlug(normalizedSourcePath),
    title: fileName.trim(),
    excerpt: createExcerpt(normalizedMarkdown),
    collection: getCollection(normalizedSourcePath),
    status: normalizedMarkdown.trim() ? "published" : "draft",
    publishedAt: new Date(publishedAt).toISOString(),
    sourceUpdatedAt: new Date(sourceUpdatedAt).toISOString(),
    wordCount,
    readingMinutes,
  };
}
