import { useRef } from "react";

export function MediaUploadTrigger({
  id,
  label,
  disabled,
  multiple = false,
  describedBy,
  invalid = false,
  onAdd,
}: {
  id: string;
  label: string;
  disabled: boolean;
  multiple?: boolean;
  describedBy?: string;
  invalid?: boolean;
  onAdd: (files: FileList | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <label className="breeder-visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input
        ref={input}
        className="breeder-visually-hidden"
        tabIndex={-1}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        onChange={(event) => {
          onAdd(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="button secondary breeder-upload-trigger"
        disabled={disabled}
        aria-controls={id}
        aria-describedby={describedBy}
        onClick={() => input.current?.click()}
      >
        {label}
      </button>
    </>
  );
}
