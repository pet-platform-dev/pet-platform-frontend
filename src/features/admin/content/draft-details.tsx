import { SelectDropdown } from "@/shared/ui/select-dropdown";
export type DraftDetailsValues = {
  ownerReference: string;
  breederDraftId: string;
};
export function DraftDetails({
  value,
  onChange,
  locked = false,
}: {
  value: DraftDetailsValues;
  locked?: boolean;
  onChange: (value: DraftDetailsValues) => void;
}) {
  return (
    <fieldset>
      <legend>Пов’язаний власник або розплідник — необов’язково</legend>
      <p className="muted">
        Дозвіл на використання інформації та фото оператор отримує поза
        додатком. Чернетка залишається приватною.
      </p>
      {locked && (
        <p className="muted">
          Оголошення пов’язане з поточним розплідником. Перепризначення
          недоступне.
        </p>
      )}
      {(
        [
          ["ownerReference", "Довідка про власника", 200],
          ["breederDraftId", "ID підготовленої чернетки розплідника", 36],
        ] as const
      )
        .filter(([key]) => !(locked && key === "breederDraftId"))
        .map(([key, label, maxLength]) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            <input
              id={key}
              maxLength={maxLength}
              readOnly={key === "breederDraftId" && locked}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          </div>
        ))}
    </fieldset>
  );
}
export function ContentState({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <span>Стан приватної чернетки</span>
      <SelectDropdown
        label="Стан приватної чернетки"
        value={value}
        onChange={onChange}
        options={[
          { value: "DRAFT", label: "Чернетка" },
          { value: "READY_FOR_REVIEW", label: "Готова до перевірки" },
          { value: "ARCHIVED", label: "В архіві" },
        ]}
      />
      <p className="muted">
        Готовність до перевірки не публікує оголошення. Передача власнику —
        наступний етап.
      </p>
    </div>
  );
}
