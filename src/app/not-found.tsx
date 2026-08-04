import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="status-page">
      <p className="status-page__code">404 / ARCHIVE GAP</p>
      <h1>这张折页不存在</h1>
      <p>文章可能已移动、尚未公开，或链接有误。回到索引继续浏览已有内容。</p>
      <Link className="button-link" href="/">
        返回文章列表
      </Link>
    </main>
  );
}
