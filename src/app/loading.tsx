export default function Loading() {
  return (
    <main id="main-content" className="loading-page" aria-busy="true" aria-label="正在加载文章">
      <div className="loading-hero skeleton" />
      <div className="archive-shell">
        <div className="loading-controls skeleton" />
        <div className="article-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="loading-card skeleton" key={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
