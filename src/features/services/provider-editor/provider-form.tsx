"use client";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  providerInputSchema,
  validationFeedback,
  emptyProvider,
  type ProviderInput,
} from "@/entities/service-provider/validation";
import {
  createProvider,
  getProvider,
  updateProvider,
} from "@/entities/service-provider/api";
import type { OwnedProvider } from "@/entities/service-provider/model";
import {
  useWorkspaceAction,
  useWorkspaceBusy,
  useWorkspaceRefresh,
} from "../workspace/session";
import { Feedback, Select, ConfirmButton } from "../workspace/ui";
import { WorkspaceTextField } from "../workspace/text-field";
export function ProviderForm({ profile }: { profile?: OwnedProvider }) {
  const workspaceBusy = useWorkspaceBusy(profile?.id);
  const router = useRouter(),
    [step, setStep] = useState(0),
    [validation, setValidation] = useState<Error | null>(null),
    [saved, setSaved] = useState(false),
    [revision, setRevision] = useState(profile?.updatedAt ?? "");
  // Explicit input projection: private response metadata never becomes a request field.
  const initial: ProviderInput = profile
    ? {
        kind: profile.kind,
        publicName: profile.publicName,
        description: profile.description,
        phone: profile.phone,
        telegram: profile.telegram,
        viber: profile.viber,
        whatsapp: profile.whatsapp,
        website: profile.website,
      }
    : emptyProvider;
  const form = useForm<ProviderInput>({ defaultValues: initial });
  useEffect(() => {
    if (profile && profile.updatedAt !== revision && !form.formState.isDirty) {
      form.reset(
        providerInputSchema.parse({
          kind: profile.kind,
          publicName: profile.publicName,
          description: profile.description,
          phone: profile.phone,
          telegram: profile.telegram,
          viber: profile.viber,
          whatsapp: profile.whatsapp,
          website: profile.website,
        }),
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Rebase a pristine RHF snapshot after location/media writes; dirty forms retain their original optimistic revision.
      setRevision(profile.updatedAt);
    }
  }, [profile, revision, form, form.formState.isDirty]);
  const kind = useWatch({ control: form.control, name: "kind" });
  const action = useWorkspaceAction(
    (value: ProviderInput) =>
      profile
        ? updateProvider(profile.id, value, revision)
        : createProvider(value),
    profile?.id,
  );
  const refresh = useWorkspaceRefresh([profile?.id, "provider"], (signal) => {
    if (!profile) throw Error("Профіль ще не створено");
    return getProvider(profile.id, signal);
  });
  async function reload() {
    if (!profile) return;
    let latest: OwnedProvider;
    try {
      latest = await refresh.mutateAsync(undefined);
    } catch {
      return;
    }
    form.reset({
      kind: latest.kind,
      publicName: latest.publicName,
      description: latest.description,
      phone: latest.phone,
      telegram: latest.telegram,
      viber: latest.viber,
      whatsapp: latest.whatsapp,
      website: latest.website,
    });
    setRevision(latest.updatedAt);
    action.reset();
    setValidation(null);
    setSaved(false);
  }
  async function save(value: ProviderInput) {
    setSaved(false);
    const parsed = providerInputSchema.safeParse(value);
    if (!parsed.success) {
      setValidation(validationFeedback(parsed.error));
      return;
    }
    setValidation(null);
    try {
      const row = await action.mutateAsync(parsed.data);
      if (!profile) {
        router.push(`/my-services/${row.id}/edit`);
        return;
      }
      form.reset(parsed.data);
      setRevision(row.updatedAt);
      setSaved(true);
    } catch {
      /* Mutation feedback retains every input. */
    }
  }
  const busy = workspaceBusy || action.isPending || form.formState.isSubmitting;
  const field = (
    name: Exclude<keyof ProviderInput, "kind">,
    label: string,
    type = "text",
  ) => (
    <WorkspaceTextField
      key={name}
      control={form.control}
      name={name}
      label={label}
      type={type}
      multiline={name === "description"}
      maxLength={
        name === "description"
          ? 5000
          : name === "publicName"
            ? 160
            : name === "website"
              ? 2048
              : 40
      }
    />
  );
  return (
    <form
      className="workspace-form"
      noValidate
      onSubmit={form.handleSubmit(save)}
    >
      {!profile && (
        <ol className="workspace-steps" aria-label="Кроки створення">
          <li aria-current={step === 0 ? "step" : undefined}>
            1. Основні дані
          </li>
          <li aria-current={step === 1 ? "step" : undefined}>
            2. Публічні контакти
          </li>
        </ol>
      )}
      <fieldset disabled={busy}>
        <legend>
          {profile
            ? "Дані профілю"
            : step === 0
              ? "Представте свої послуги"
              : "Як із вами зв’язатися"}
        </legend>
        {(profile || step === 0) && (
          <>
            {!profile && (
              <Select
                label="Тип надавача"
                value={kind}
                onChange={(v) =>
                  form.setValue("kind", v as ProviderInput["kind"], {
                    shouldDirty: true,
                  })
                }
                options={[
                  { value: "INDIVIDUAL", label: "Спеціаліст" },
                  { value: "ORGANIZATION", label: "Організація" },
                ]}
              />
            )}
            {profile && (
              <p className="muted">
                Тип профілю не змінюється після створення.
              </p>
            )}
            {field(
              "publicName",
              kind === "ORGANIZATION"
                ? "Назва організації"
                : "Ім’я або назва спеціаліста",
            )}
            {field("description", "Опис послуг і досвіду")}
          </>
        )}
        {(profile || step === 1) && (
          <>
            <p className="muted">
              Ці контакти будуть публічними після схвалення. Усі поля
              необов’язкові для чернетки; для модерації потрібен хоча б один
              контакт. Пошта акаунта не публікується.
            </p>
            <div className="workspace-field-grid">
              {field("phone", "Телефон", "tel")}
              {field("telegram", "Telegram username")}
              {field("viber", "Viber", "tel")}
              {field("whatsapp", "WhatsApp", "tel")}
              {field("website", "Вебсайт", "url")}
            </div>
          </>
        )}
      </fieldset>
      <Feedback
        error={validation ?? refresh.error ?? action.error}
        success={saved ? "Профіль збережено." : undefined}
      />
      {profile && profile.updatedAt !== revision && (
        <p role="status">
          Є новіша версія запису. Форма зберігає ваш текст; завантажте актуальні
          дані перед збереженням.
        </p>
      )}
      <div className="workspace-actions">
        {!profile && step === 0 ? (
          <button
            type="button"
            className="button primary"
            onClick={() => {
              if (form.getValues("publicName").trim()) {
                setValidation(null);
                setStep(1);
              } else {
                setValidation(Error("Вкажіть ім’я або назву"));
                form.setFocus("publicName");
              }
            }}
          >
            Далі
          </button>
        ) : (
          <>
            <button className="button primary" type="submit" disabled={busy}>
              {busy
                ? "Збереження…"
                : profile
                  ? "Зберегти профіль"
                  : "Створити профіль"}
            </button>
            {!profile && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setStep(0)}
              >
                Назад
              </button>
            )}
          </>
        )}
        {profile && (
          <ConfirmButton
            label="Завантажити актуальні дані"
            title="Замінити незбережені дані форми?"
            description="Буде завантажено актуальну версію із сервера. Ваш незбережений текст буде замінено."
            onConfirm={reload}
            disabled={busy}
          />
        )}
      </div>
      {!profile && (
        <p className="muted">
          Після створення додайте місця надання послуг і фотографії. Категорія
          обирається для кожної пропозиції окремо.
        </p>
      )}
    </form>
  );
}
