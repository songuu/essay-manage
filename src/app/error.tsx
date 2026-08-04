"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("文章页面加载失败", error);
  }, [error]);

  return (
    <main id="main-content" className="status-page">
      <p className="status-page__code">CONNECTION / INTERRUPTED</p>
      <h1>文章库暂时无法访问</h1>
      <p>数据库连接或页面渲染遇到了问题。你可以稍后重试，本页不会泄露内部错误信息。</p>
      <button className="button-link" type="button" onClick={reset}>
        重新加载
      </button>
    </main>
  );
}
