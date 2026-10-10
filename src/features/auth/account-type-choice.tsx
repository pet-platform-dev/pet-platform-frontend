import {
  accountTypes,
  accountTypePresentation,
} from "@/entities/user/account-type";
export function AccountTypeChoice({
  disabled,
  error,
}: {
  disabled: boolean;
  error?: string;
}) {
  return (
    <fieldset
      className="account-type-choice"
      disabled={disabled}
      aria-describedby={error ? "accountType-error" : undefined}
    >
      <legend>Як ви плануєте користуватися платформою?</legend>
      <div className="account-type-options">
        {accountTypes.map((type) => (
          <label className="account-type-option" key={type}>
            <input
              type="radio"
              name="accountType"
              value={type}
              defaultChecked={type === "SELLER"}
            />
            <span>
              <strong>{accountTypePresentation[type].label}</strong>
              <span className="muted">
                {accountTypePresentation[type].description}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p className="field-error" id="accountType-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
