import type { LegalDocument } from "./content/legal-document";

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const related =
    document.slug === "privacy"
      ? { href: "/terms", title: "Умови користування" }
      : { href: "/privacy", title: "Політика конфіденційності" };
  return (
    <main className="page-shell legal-shell">
      <article className="legal-document" aria-labelledby="legal-title">
        <header className="legal-heading">
          <p className="legal-eyebrow">Лапа · Інформація для користувачів</p>
          <h1 id="legal-title">{document.title}</h1>
          <p>{document.description}</p>
        </header>
        <aside className="legal-draft-notice" aria-label="Статус документа">
          <strong>Чернетка для ознайомлення</strong>
          <p>
            Документ ще не затверджено для остаточної публікації. Реквізити й
            контакт оператора уточнюються.
          </p>
        </aside>
        <details className="legal-toc">
          <summary>Зміст документа</summary>
          <nav aria-label="Розділи документа">
            <ol>
              {document.sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </details>
        {document.sections.map((section, index) => (
          <section
            className="legal-section"
            id={section.id}
            key={section.id}
            aria-labelledby={`${section.id}-title`}
          >
            <h2 id={`${section.id}-title`}>
              {index + 1}. {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets && (
              <ul>
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <nav className="legal-related" aria-label="Пов’язаний документ">
          <span>Також ознайомтеся</span>
          <a href={related.href}>{related.title}</a>
        </nav>
      </article>
    </main>
  );
}
