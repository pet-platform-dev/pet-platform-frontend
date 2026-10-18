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
              <span className="breeder-directory-avatar skeleton" />
              <span className="skeleton" />
            </div>
            <span className="skeleton" />
            <span className="skeleton" />
            <span className="skeleton" />
          </div>
        ))}
      </div>
    </section>
  );
}
