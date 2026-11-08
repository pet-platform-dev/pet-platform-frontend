"use client";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { publicRequest } from "@/shared/api/client";
import {
  categories,
  saveOffer,
  getOffer,
  listLocations,
} from "@/entities/service-provider/api";
import {
  validateOffer,
  validationFeedback,
  type OfferInput,
  type Details,
} from "@/entities/service-provider/validation";
import type {
  OwnedProvider,
  OwnedOffer,
} from "@/entities/service-provider/model";
import { categorySlugs } from "@/entities/service-offer/model";
import {
  useWorkspaceAction,
  useWorkspaceQuery,
  useWorkspaceBusy,
  useWorkspaceRefresh,
} from "../workspace/session";
import { Feedback, Select, ConfirmButton, Loading } from "../workspace/ui";
import { ConfirmChange } from "../workspace/confirm-change";
import { CategoryFields } from "./category-fields";
import { WorkspaceTextField } from "../workspace/text-field";
import { offerCategories } from "./references";
export function offerValues(row?: OwnedOffer): OfferInput {
  return row
    ? {
        categoryId: row.categoryId,
        title: row.title,
        description: row.description,
        mode: row.mode,
        price: {
          mode: row.price.mode,
          amount: row.price.amount,
          unit: row.price.unit,
        },
        speciesIds: row.species.map((s) => s.id),
        providerLocationIds: row.locations.map((l) => l.id),
        detailsVersion: 1,
        details: row.details as Details,
      }
    : {
        categoryId: "",
        title: "",
        description: "",
        mode: "REMOTE",
        price: { mode: "ON_REQUEST", amount: null, unit: null },
        speciesIds: [],
        providerLocationIds: [],
        detailsVersion: 1,
        details: {},
      };
}
export function OfferForm({
  provider,
  offer,
}: {
  provider: OwnedProvider;
  offer?: OwnedOffer;
}) {
  const workspaceBusy = useWorkspaceBusy(provider.id);
  const router = useRouter(),
    [base, setBase] = useState(offer),
    [details, setDetails] = useState<Details>(
      (offer?.details ?? {}) as Details,
    ),
    [change, setChange] = useState<{
      field: "categoryId" | "mode";
      value: string;
    } | null>(null),
    [categoryConfirmed, setCategoryConfirmed] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [saved, setSaved] = useState(false);
  const form = useForm<OfferInput>({ defaultValues: offerValues(offer) });
  useEffect(() => {
    if (
      offer &&
      offer.updatedAt !== base?.updatedAt &&
      !form.formState.isDirty &&
      JSON.stringify(details) === JSON.stringify(base?.details ?? {})
    ) {
      form.reset(offerValues(offer));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reconcile pristine external form/media revisions; never replace unsaved category details.
      setBase(offer);
      setDetails(offer.details as Details);
    }
  }, [offer, base, form, form.formState.isDirty, details]);
  const categoryId = useWatch({ control: form.control, name: "categoryId" }),
    mode = useWatch({ control: form.control, name: "mode" }),
    priceMode = useWatch({ control: form.control, name: "price.mode" }),
    priceUnit = useWatch({ control: form.control, name: "price.unit" }),
    speciesIds = useWatch({ control: form.control, name: "speciesIds" }),
    locationIds = useWatch({
      control: form.control,
      name: "providerLocationIds",
    });
  const refs = useQuery({
      queryKey: ["service-categories"],
      queryFn: ({ signal }) => categories(signal),
    }),
    places = useWorkspaceQuery([provider.id, "locations"], (signal) =>
      listLocations(provider.id, signal),
    );
  const species = useQuery({
    queryKey: ["species"],
    queryFn: async ({ signal }) =>
      z
        .array(
          z.object({
            id: z.uuid(),
            slug: z.enum(["dog", "cat"]),
            name: z.string(),
          }),
        )
        .parse(await publicRequest("/species", false, { signal })),
  });
  const action = useWorkspaceAction(
    (input: OfferInput) =>
      saveOffer(provider.id, input, base, categoryConfirmed),
    provider.id,
  );
  const categoryOptions = offerCategories(refs.data ?? [], base, provider.kind);
  const category = categoryOptions.find((c) => c.id === categoryId),
    slug = z.enum(categorySlugs).safeParse(category?.slug).data;
  function selectCategory(value: string) {
    if (value === categoryId) return;
    if (Object.keys(details).length || (base && value !== base.categoryId)) {
      setChange({ field: "categoryId", value });
      return;
    }
    form.setValue("categoryId", value, { shouldDirty: true });
  }
  function selectMode(value: string) {
    if (value !== mode && locationIds.length) {
      setChange({ field: "mode", value });
      return;
    }
    form.setValue("mode", value as OfferInput["mode"], { shouldDirty: true });
  }
  function confirmChange() {
    if (!change) return;
    if (change.field === "categoryId") {
      form.setValue("categoryId", change.value, { shouldDirty: true });
      setDetails({});
      setCategoryConfirmed(true);
    } else {
      form.setValue("mode", change.value as OfferInput["mode"], {
        shouldDirty: true,
      });
      form.setValue("providerLocationIds", [], { shouldDirty: true });
    }
    setChange(null);
  }
  async function save(value: OfferInput) {
    setSaved(false);
    try {
      if (!slug) throw Error("Оберіть категорію");
      const normalized = Object.fromEntries(
        Object.entries(details).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.map((s) => s.trim()).filter(Boolean) : v,
        ]),
      );
      const input = validateOffer({ ...value, details: normalized }, slug);
      setError(null);
      const row = await action.mutateAsync(input);
      if (!offer) {
        router.push(`/my-services/${provider.id}/offers/${row.id}/edit`);
        return;
      }
      setBase(row);
      form.reset(offerValues(row));
      setDetails(row.details as Details);
      setCategoryConfirmed(false);
      setSaved(true);
    } catch (e) {
      if (e instanceof z.ZodError) setError(validationFeedback(e));
      else if (!action.error)
        setError(e instanceof Error ? e : Error("Перевірте форму"));
    }
  }
  const busy = workspaceBusy || action.isPending || form.formState.isSubmitting;
  const refresh = useWorkspaceRefresh(
    [provider.id, "offer", offer?.id],
    (signal) => {
      if (!offer) throw Error("Послугу ще не створено");
      return getOffer(provider.id, offer.id, signal);
    },
  );
  async function reload() {
    if (!offer) return;
    let latest: OwnedOffer;
    try {
      latest = await refresh.mutateAsync(undefined);
    } catch {
      return;
    }
    form.reset(offerValues(latest));
    setDetails(latest.details as Details);
    setBase(latest);
    setError(null);
    setCategoryConfirmed(false);
    action.reset();
    setSaved(false);
  }
  if (refs.isPending || species.isPending || places.isPending)
    return <Loading />;
  if (refs.isError || species.isError || places.isError)
    return (
      <Feedback
        error={refs.error ?? species.error ?? places.error}
        onRefresh={() => {
          void refs.refetch();
          void species.refetch();
          void places.refetch();
        }}
      />
    );
  return (
    <form
      className="workspace-form"
      onSubmit={form.handleSubmit(save)}
      noValidate
    >
      <fieldset disabled={busy}>
        <legend>Основні дані послуги</legend>
        <Select
          label="Категорія послуги"
          value={categoryId}
          onChange={selectCategory}
          options={[
            { value: "", label: "Оберіть категорію" },
            ...categoryOptions
              .filter(
                (c) =>
                  c.allowedProviderKinds.includes(provider.kind) ||
                  c.id === base?.categoryId,
              )
              .map((c) => ({ value: c.id, label: c.nameUk })),
          ]}
        />
        {slug === "veterinary-care" && (
          <p role="status" className="workspace-feedback">
            Ветеринарну послугу можна зберегти та надіслати на перевірку.
            Публікація заблокована до впровадження перевірки у S10.
          </p>
        )}
        <WorkspaceTextField
          control={form.control}
          name="title"
          label="Назва послуги"
          maxLength={160}
        />
        <WorkspaceTextField
          control={form.control}
          name="description"
          label="Опис послуги"
          maxLength={5000}
          multiline
        />
        <Select
          label="Формат надання"
          value={mode}
          onChange={selectMode}
          options={[
            { value: "REMOTE", label: "Дистанційно" },
            { value: "ONSITE", label: "За адресою надавача" },
            { value: "MOBILE", label: "З виїздом" },
          ]}
        />
        <fieldset>
          <legend>Види тварин</legend>
          {species.data?.map((s) => (
            <label className="workspace-check" key={s.id}>
              <input
                type="checkbox"
                checked={speciesIds.includes(s.id)}
                onChange={(e) =>
                  form.setValue(
                    "speciesIds",
                    e.target.checked
                      ? [...speciesIds, s.id]
                      : speciesIds.filter((id) => id !== s.id),
                    { shouldDirty: true },
                  )
                }
              />
              {s.slug === "dog" ? "Собаки" : "Коти"}
            </label>
          ))}
        </fieldset>
        {mode !== "REMOTE" && (
          <fieldset>
            <legend>Місця надання послуги</legend>
            <p className="muted">
              {mode === "ONSITE"
                ? "Оберіть філії профілю."
                : "Оберіть території обслуговування профілю."}{" "}
              Додати їх можна в редакторі профілю.
            </p>
            {places.data?.data
              .filter(
                (l) =>
                  l.kind === (mode === "ONSITE" ? "BASE" : "SERVICE_AREA") &&
                  (l.location.isActive || locationIds.includes(l.id)),
              )
              .map((l) => (
                <label key={l.id} className="workspace-check">
                  <input
                    type="checkbox"
                    checked={locationIds.includes(l.id)}
                    onChange={(e) =>
                      form.setValue(
                        "providerLocationIds",
                        e.target.checked
                          ? [...locationIds, l.id]
                          : locationIds.filter((id) => id !== l.id),
                        { shouldDirty: true },
                      )
                    }
                  />
                  {l.location.city} · {l.location.region}
                  {l.publicAddress ? ` · ${l.publicAddress}` : ""}
                  {!l.location.isActive ? " (неактивне місце)" : ""}
                </label>
              ))}
          </fieldset>
        )}
        <Select
          label="Модель ціни"
          value={priceMode}
          onChange={(v) => {
            form.setValue("price.mode", v as OfferInput["price"]["mode"], {
              shouldDirty: true,
            });
            if (v === "ON_REQUEST") {
              form.setValue("price.amount", null);
              form.setValue("price.unit", null);
            } else if (!form.getValues("price.unit"))
              form.setValue("price.unit", "SERVICE");
          }}
          options={[
            { value: "ON_REQUEST", label: "За запитом" },
            { value: "FIXED", label: "Фіксована" },
            { value: "FROM", label: "Від указаної суми" },
          ]}
        />
        {priceMode !== "ON_REQUEST" && (
          <div className="workspace-field-grid">
            <WorkspaceTextField
              control={form.control}
              name="price.amount"
              label="Сума, грн"
              decimal
              placeholder="500.00"
            />
            <Select
              label="Одиниця ціни"
              value={priceUnit ?? "SERVICE"}
              onChange={(v) =>
                form.setValue(
                  "price.unit",
                  v as NonNullable<OfferInput["price"]["unit"]>,
                  { shouldDirty: true },
                )
              }
              options={[
                ["SERVICE", "Послуга"],
                ["VISIT", "Візит"],
                ["SESSION", "Заняття"],
                ["HOUR", "Година"],
                ["DAY", "Доба"],
                ["TRIP", "Поїздка"],
                ["KM", "Кілометр"],
              ].map(([value, label]) => ({ value, label }))}
            />
          </div>
        )}
        {slug && (
          <CategoryFields slug={slug} value={details} onChange={setDetails} />
        )}
      </fieldset>
      <Feedback
        error={error ?? refresh.error ?? action.error}
        success={saved ? "Послугу збережено." : undefined}
      />
      {offer && offer.updatedAt !== base?.updatedAt && (
        <p role="status">
          Запис має новішу версію. Незбережені дані залишаються у формі.
        </p>
      )}
      <div className="workspace-actions">
        <button type="submit" disabled={busy} className="button primary">
          {busy
            ? "Збереження…"
            : offer
              ? "Зберегти послугу"
              : "Створити чернетку послуги"}
        </button>
        {offer && (
          <ConfirmButton
            label="Завантажити актуальні дані"
            title="Замінити незбережені дані?"
            description="Буде завантажено актуальну версію із сервера. Ваш незбережений текст буде замінено."
            disabled={busy}
            onConfirm={reload}
          />
        )}
      </div>
      {change && (
        <ConfirmChange
          title={
            change.field === "categoryId"
              ? "Змінити категорію?"
              : "Змінити формат?"
          }
          description={
            change.field === "categoryId"
              ? "Особливості попередньої категорії буде очищено. Зміна набуде чинності лише після збереження форми."
              : "Вибрані місця буде очищено, оскільки новий формат потребує іншого типу місць."
          }
          onCancel={() => setChange(null)}
          onConfirm={confirmChange}
        />
      )}
    </form>
  );
}
