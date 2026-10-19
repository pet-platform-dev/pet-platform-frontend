export function BreederDirectorySkeleton() {
  return (
    <section role="status" aria-label="Завантажуємо розплідники">
      <div className="breeder-directory-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="breeder-directory-card breeder-directory-skeleton"
            key={index}
          >
            <div className="breeder-directory-identity">
              <span className="breeder-directory-logo">
                <span className="breeder-directory-avatar skeleton" />
              </span>
              <span className="breeder-directory-skeleton-title skeleton" />
            </div>
            <span className="breeder-directory-location skeleton" />
            <span className="breeder-directory-species skeleton" />
            <div className="breeder-breed-list breeder-directory-breeds">
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
            <span className="breeder-directory-description skeleton" />
            <span className="breeder-directory-cta">
              <span className="skeleton" />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
