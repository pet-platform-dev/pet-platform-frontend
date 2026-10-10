import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  setBreederVisibility,
  type OwnBreederAnimal,
} from "@/entities/breeder/animals";
import { invalidateBreederAnimals } from "./cache";
export function VisibilityControl({
  animal,
  userId,
}: {
  animal: OwnBreederAnimal;
  userId: string;
}) {
  const client = useQueryClient(),
    lock = useRef(false),
    id = "breeder-visibility-" + animal.id;
  const mutation = useMutation({
    retry: false,
    mutationFn: (value: boolean) => setBreederVisibility(animal.id, value),
    onSuccess: () => invalidateBreederAnimals(client, userId),
    onSettled: () => {
      lock.current = false;
    },
  });
  return (
    <div className="breeder-visibility">
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={animal.showOnBreederProfile}
          disabled={mutation.isPending}
          aria-describedby={id + "-help " + id + "-feedback"}
          onChange={(event) => {
            if (lock.current) return;
            lock.current = true;
            mutation.mutate(event.target.checked);
          }}
        />
        Показувати у профілі розплідника
      </label>
      <p id={id + "-help"} className="muted">
        Тварина буде доступна у публічному розділі «Наші тварини».
      </p>
      <div id={id + "-feedback"}>
        {mutation.isPending ? (
          <p role="status">Зберігаємо видимість…</p>
        ) : mutation.isError ? (
          <p role="alert" className="field-error">
            Не вдалося змінити видимість. Спробуйте ще раз.
          </p>
        ) : (
          <p role="status">
            {animal.showOnBreederProfile
              ? "Відображається у профілі"
              : "Не відображається у профілі"}
          </p>
        )}
      </div>
    </div>
  );
}
