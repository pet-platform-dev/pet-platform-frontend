export function AuthFields({
  registering,
  pending,
  errors,
}: {
  registering: boolean;
  pending: boolean;
  errors: Record<string, string>;
}) {
  const fields = [
    ...(registering
      ? [
          {
            name: "firstName",
            label: "Ім’я",
            type: "text",
            autocomplete: "given-name",
          },
          {
            name: "lastName",
            label: "Прізвище",
            type: "text",
            autocomplete: "family-name",
          },
        ]
      : []),
    {
      name: "email",
      label: "Електронна адреса",
      type: "email",
      autocomplete: "email",
    },
    {
      name: "password",
      label: "Пароль",
      type: "password",
      autocomplete: registering ? "new-password" : "current-password",
    },
    ...(registering
      ? [
          {
            name: "confirmPassword",
            label: "Підтвердження пароля",
            type: "password",
            autocomplete: "new-password",
          },
        ]
      : []),
  ];
  return (
    <>
      {fields.map((field) => (
        <div className="field" key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          <input
            id={field.name}
            name={field.name}
            type={field.type}
            autoComplete={field.autocomplete}
            required
            maxLength={
              field.name === "email"
                ? 254
                : field.type === "password"
                  ? 128
                  : 100
            }
            aria-invalid={Boolean(errors[field.name])}
            aria-describedby={
              errors[field.name] ? `${field.name}-error` : undefined
            }
            disabled={pending}
          />
          {errors[field.name] && (
            <p className="field-error" id={`${field.name}-error`}>
              {errors[field.name]}
            </p>
          )}
        </div>
      ))}
    </>
  );
}
