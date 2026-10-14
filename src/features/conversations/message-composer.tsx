"use client";
import { useId, useRef, useState } from "react";
import { ApiError } from "@/shared/api/client";
import { messageInputSchema } from "./model";
export function MessageComposer({
  onSend,
  pending = false,
  disabled = false,
}: {
  onSend: (text: string) => Promise<unknown>;
  pending?: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const id = useId(),
    locked = useRef(false),
    input = useRef<HTMLTextAreaElement>(null);
  async function submit() {
    if (locked.current || pending || disabled) return;
    const result = messageInputSchema.safeParse({ text });
    if (!result.success) {
      setError(result.error.issues[0].message);
      input.current?.focus();
      return;
    }
    locked.current = true;
    setError("");
    try {
      await onSend(result.data.text);
      setText("");
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? "Розмова недоступна."
          : e instanceof ApiError && e.status === 409
            ? "Розмова зараз недоступна для надсилання."
            : "Не вдалося надіслати повідомлення. Спробуйте ще раз.",
      );
    } finally {
      locked.current = false;
      input.current?.focus();
    }
  }
  return (
    <form
      className="message-composer"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={id}>Повідомлення</label>
      <textarea
        ref={input}
        id={id}
        value={text}
        maxLength={3000}
        rows={3}
        required
        disabled={pending || disabled}
        onChange={(e) => {
          setText(e.target.value);
          setError("");
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={id + "-help" + (error ? " " + id + "-error" : "")}
      />
      <p className="form-hint" id={id + "-help"}>
        До 3000 символів · {text.trim().length}/3000. Enter — новий рядок.
      </p>
      {error && (
        <p className="error-banner" id={id + "-error"} role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={pending || disabled}>
        {pending ? "Надсилаємо…" : "Надіслати"}
      </button>
    </form>
  );
}
