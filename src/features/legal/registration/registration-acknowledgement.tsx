import type { RegistrationLegalState } from "./registration-legal-state";

export function RegistrationAcknowledgement({
  state,
  pending,
  onCheck,
  onRetry,
}: {
  state: RegistrationLegalState;
  pending: boolean;
  onCheck: (checked: boolean) => void;
  onRetry: () => void;
}) {
  return (
    <div className="registration-legal" aria-busy={state.status === "loading"}>
      {state.changed && (
        <p role="status" className="registration-legal-notice">
          Умови користування або Політика конфіденційності оновилися.
          Ознайомтеся з актуальними документами та підтвердьте їх повторно.
        </p>
      )}
      <div className="registration-legal-status" aria-live="polite">
        {state.status === "loading" && <p>Завантажуємо юридичні документи…</p>}
        {state.status === "error" && (
          <p role="alert">
            Не вдалося завантажити юридичні документи. Спробуйте ще раз.
          </p>
        )}
        {state.status === "mismatch" && (
          <p role="alert">
            Юридичні документи оновлюються. Зараз неможливо підтвердити їхню
            актуальність. Спробуйте пізніше.
          </p>
        )}
        {state.status === "ready" && !state.metadata?.acceptanceRequired && (
          <p>
            Документи наразі є чернетками для ознайомлення. Підтверджувати їх
            прийняття не потрібно.
          </p>
        )}
      </div>
      {state.status === "ready" && state.metadata?.acceptanceRequired && (
        <>
          <label
            className="registration-legal-checkbox"
            htmlFor="registration-legal-accepted"
          >
            <input
              id="registration-legal-accepted"
              type="checkbox"
              checked={state.checked}
              required
              disabled={pending}
              onChange={(event) => onCheck(event.target.checked)}
              aria-invalid={Boolean(state.error)}
              aria-describedby={
                state.error ? "registration-legal-error" : undefined
              }
            />
            <span>
              Я ознайомився(-лася) з Умовами користування та Політикою
              конфіденційності й погоджуюся з Умовами користування.
            </span>
          </label>
          {state.error && (
            <p
              className="field-error"
              id="registration-legal-error"
              role="alert"
            >
              {state.error}
            </p>
          )}
        </>
      )}
      <nav className="registration-legal-links" aria-label="Юридичні документи">
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Умови користування (відкриється в новій вкладці)"
        >
          Умови користування
        </a>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Політика конфіденційності (відкриється в новій вкладці)"
        >
          Політика конфіденційності
        </a>
      </nav>
      <p className="registration-legal-link-hint">
        Документи відкриються в новій вкладці.
      </p>
      {(state.status === "error" || state.status === "mismatch") && (
        <button
          className="button secondary"
          type="button"
          disabled={pending}
          onClick={onRetry}
        >
          Спробувати ще раз
        </button>
      )}
    </div>
  );
}
