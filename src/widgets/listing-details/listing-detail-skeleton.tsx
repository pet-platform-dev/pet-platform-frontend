export function ListingDetailSkeleton() {
  return (
    <div role="status" aria-label="Завантажуємо оголошення">
      <span className="sr-only">Завантажуємо оголошення…</span>
      <div
        className="listing-detail-grid listing-detail-skeleton"
        aria-hidden="true"
      >
        <div className="listing-detail-media skeleton-block" />
        <div className="listing-detail-summary">
          <div className="skeleton-line skeleton-short" />
          <div className="skeleton-line skeleton-name" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-short" />
          <div className="skeleton-line" />
        </div>
        <div className="listing-detail-panel">
          <div className="skeleton-line skeleton-name" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
        <div className="listing-detail-panel">
          <div className="skeleton-line skeleton-short" />
          <div className="skeleton-line" />
        </div>
      </div>
    </div>
  );
}
