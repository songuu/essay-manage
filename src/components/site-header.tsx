import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/" aria-label="折页，返回文章列表">
          <span className="site-brand__mark" aria-hidden="true">
            折
          </span>
          <span className="site-brand__copy">
            <strong>折页</strong>
            <small>ESSAY / 个人技术档案</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="主导航">
          <Link href="/">文章</Link>
          <a href="/essay/feed.xml/">RSS</a>
          <a href="#about">关于本站</a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer" id="about">
      <div>
        <p className="site-footer__brand">折页 · Essay Archive</p>
        <p>把散落的工程经验，整理成可以再次检索的知识。</p>
      </div>
      <p className="site-footer__note">
        Markdown 原稿 · PostgreSQL 索引 · <a href="/essay/feed.xml/">RSS 订阅</a>
      </p>
    </footer>
  );
}
