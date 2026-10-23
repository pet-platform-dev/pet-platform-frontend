import type { User } from "@/entities/user/model";

const baseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
let accessToken: string | null = null;
let accessUserId: string | null = null;
let expiresAt = 0;
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;
let refreshPromise: Promise<User> | null = null;
let sessionGeneration = 0;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: {
      field: string;
      message: string;
      code?: string;
    }[] = [],
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  envelope = false,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: AbortSignal.any([
        AbortSignal.timeout(
          options.body instanceof FormData ||
            (options.method === "PATCH" && /^\/listings\/[^/]+$/.test(path))
            ? 45000
            : 15000,
        ),
        ...(options.signal ? [options.signal] : []),
      ]),
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Не вдалося виконати запит. Спробуйте ще раз.");
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "Перевірте правильність заповнення полів",
      401: "Сесію завершено. Увійдіть знову",
      403: "Оновіть сторінку та спробуйте знову",
      409:
        path === "/auth/register"
          ? "Користувач із такою електронною адресою вже існує"
          : "Дані змінилися. Оновіть сторінку та спробуйте знову",
      429: "Забагато запитів. Спробуйте за хвилину",
      413: "Файл завеликий",
    };
    const errorBody: unknown = await response.json().catch(() => null);
    const known = new Set([
      "Спочатку вкажіть стать тварини",
      "Оберіть доступний населений пункт",
      "Тварина вже має активне оголошення про в’язку",
      "Щоб змінити тип акаунта, спочатку видаліть профіль розплідника.",
      "Додайте щонайменше одну фотографію перед публікацією.",
      "Активне оголошення повинно мати щонайменше одну фотографію",
      "Тип оголошення можна змінити лише в чернетці",
      "Завершене або недоступне оголошення не можна редагувати",
      "Оберіть фотографії цього оголошення",
      "Заповніть заголовок, опис і умови передачі перед публікацією",
      "Недопустимий перехід статусу оголошення",
      "Завантаження фото не налаштовано. Зверніться до адміністратора",
      "Формат зображення не підтримується",
      "Файл завеликий",
      "Можна додати не більше 10 фотографій",
      "Оберіть власні завантажені фотографії",
      "Сесію завантаження не знайдено або завершено",
      "Забагато сесій завантаження. Спробуйте пізніше",
      "Вкажіть ім’я тварини",
      "Ім’я має містити не більше 150 символів",
      "Некоректний ідентифікатор",
      "Оберіть доступний вид тварини",
      "Оберіть доступну породу для вибраного виду тварини",
      "Оберіть коректну стать",
      "Вкажіть коректну дату народження",
      "Дата народження не може бути в майбутньому",
      "Колір має містити не більше 150 символів",
      "Опис має містити не більше 5000 символів",
      "Номер чіпа має містити не більше 50 символів",
      "Тварина з таким номером чіпа вже існує",
      "Не можна видалити тварину з пов’язаними оголошеннями",
      "Профіль тварини не знайдено",
      "Запит містить недозволені поля",
      "Перевірте правильність заповнення поля",
      "Вкажіть хоча б одне поле для зміни",
      "Оберіть доступне місце розташування",
      "Оберіть тип оголошення",
      "Заголовок має містити щонайменше 5 символів",
      "Заголовок має містити не більше 160 символів",
      "Вкажіть опис оголошення",
      "Вкажіть ціну з не більш ніж двома десятковими знаками",
      "Для продажу потрібна додатна ціна; безоплатна передача й адопція не мають ціни",
    ]);
    let message =
      messages[response.status] ??
      "Не вдалося виконати запит. Спробуйте ще раз.";
    const details: { field: string; message: string; code?: string }[] = [];
    const legalCodes = new Set([
      "LEGAL_ACCEPTANCE_REQUIRED",
      "LEGAL_ACCEPTANCE_NOT_CONFIRMED",
      "LEGAL_ACCEPTANCE_INVALID",
      "LEGAL_VERSION_STALE",
      "LEGAL_VERSION_UNKNOWN",
      "LEGAL_DOCUMENTS_UNPUBLISHED",
      "LEGAL_REGISTRY_MISMATCH",
    ]);
    if (errorBody && typeof errorBody === "object") {
      if (
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        known.has(errorBody.message)
      )
        message = errorBody.message;
      if ("details" in errorBody && Array.isArray(errorBody.details)) {
        for (const detail of errorBody.details) {
          if (
            (path === "/auth/register" || path === "/legal/current") &&
            detail &&
            typeof detail === "object" &&
            detail.field === "legalAcceptance" &&
            typeof detail.code === "string" &&
            legalCodes.has(detail.code)
          ) {
            details.push({
              field: "legalAcceptance",
              code: detail.code,
              message:
                "Перегляньте актуальні юридичні документи та спробуйте ще раз.",
            });
          }
          if (
            detail &&
            typeof detail === "object" &&
            "field" in detail &&
            typeof detail.field === "string" &&
            "message" in detail &&
            typeof detail.message === "string" &&
            known.has(detail.message)
          )
            details.push({ field: detail.field, message: detail.message });
        }
      }
    }
    throw new ApiError(
      response.status,
      message,
      details,
      response.status === 429
        ? retryAfterSeconds(response.headers.get("Retry-After"))
        : undefined,
    );
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as { data: T };
  return envelope ? (body as T) : body.data;
}

async function csrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfPromise ??= request<{ csrfToken: string }>("/auth/csrf")
    .then((data) => {
      csrfToken = data.csrfToken;
      return data.csrfToken;
    })
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

// Cookies are shared between tabs. Web Locks serialize their mutations without exposing tokens.
async function authLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("pet-platform-auth", work);
  return work();
}

async function mutate<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "X-CSRF-Token": await csrf() },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export function retryAfterSeconds(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 86400
    ? seconds
    : undefined;
}

/** Public credential POST with the existing Origin/CSRF/cookie/no-store contract. */
export function publicMutation<T>(path: string, body: unknown): Promise<T> {
  return mutate<T>(path, body);
}

type AuthResult = { user: User; accessToken: string; expiresIn: number };
function accept(data: AuthResult): User {
  accessToken = data.accessToken;
  accessUserId = data.user.id;
  expiresAt = Date.now() + data.expiresIn * 1000;
  return data.user;
}
export function clearSession(): void {
  sessionGeneration++;
  accessToken = null;
  accessUserId = null;
  expiresAt = 0;
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("pet-platform-session-changed"));
}
export const currentSessionGeneration = () => sessionGeneration;
export async function messagingAccessToken(userId: string): Promise<string> {
  const generation = sessionGeneration;
  try {
    if (!accessToken || expiresAt <= Date.now() + 5000) await refreshSession();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) expiredSession();
    throw error;
  }
  if (
    generation !== sessionGeneration ||
    accessUserId !== userId ||
    !accessToken
  )
    throw new DOMException("Session changed", "AbortError");
  return accessToken;
}

export async function signIn(
  mode: "login" | "register",
  input: unknown,
): Promise<User> {
  return authLock(async () => {
    try {
      const result = await mutate<AuthResult>(`/auth/${mode}`, input);
      clearSession();
      return accept(result);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        throw new ApiError(401, "Невірна електронна адреса або пароль");
      throw error;
    }
  });
}

export function refreshSession(): Promise<User> {
  if (refreshPromise) return refreshPromise;
  const generation = sessionGeneration;
  const pending = authLock(async () => {
    try {
      if (generation !== sessionGeneration)
        throw new DOMException("Session changed", "AbortError");
      const result = await mutate<AuthResult>("/auth/refresh");
      if (generation !== sessionGeneration)
        throw new DOMException("Session changed", "AbortError");
      return accept(result);
    } catch (error) {
      if (generation === sessionGeneration) clearSession();
      throw error;
    }
  }).finally(() => {
    if (refreshPromise === pending) refreshPromise = null;
  });
  refreshPromise = pending;
  return refreshPromise;
}

export function publicRequest<T>(
  path: string,
  envelope = false,
  options: Pick<RequestInit, "signal"> = {},
): Promise<T> {
  return request<T>(path, options, envelope);
}
function expiredSession() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("pet-platform-session-expired"));
}
export async function authenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
  envelope = false,
): Promise<T> {
  const generation = sessionGeneration;
  const ensureCurrent = () => {
    options.signal?.throwIfAborted();
    if (generation !== sessionGeneration)
      throw new DOMException("Session changed", "AbortError");
  };
  // A failed refresh clears its own generation. Never expire a newer login.
  const expireCurrent = () => {
    if (generation === sessionGeneration) {
      clearSession();
      expiredSession();
    } else if (generation + 1 === sessionGeneration && !accessToken)
      expiredSession();
  };
  ensureCurrent();
  try {
    if (!accessToken || expiresAt <= Date.now() + 5000) await refreshSession();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) expireCurrent();
    throw error;
  }
  ensureCurrent();
  const headers = {
    ...options.headers,
    ...(["POST", "PATCH", "DELETE"].includes(options.method ?? "GET")
      ? { "X-CSRF-Token": await csrf() }
      : {}),
  };
  ensureCurrent();
  const usedToken = accessToken;
  try {
    const result = await request<T>(
      path,
      {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${usedToken}` },
      },
      envelope,
    );
    ensureCurrent();
    return result;
  } catch (error) {
    ensureCurrent();
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    try {
      if (accessToken === usedToken) await refreshSession();
      ensureCurrent();
      const result = await request<T>(
        path,
        {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${accessToken}` },
        },
        envelope,
      );
      ensureCurrent();
      return result;
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        if (generation !== sessionGeneration && accessToken) ensureCurrent();
        expireCurrent();
      } else ensureCurrent();
      throw retryError;
    }
  }
}

export async function currentUser(): Promise<User | null> {
  try {
    return await authenticatedRequest<User>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function signOut(): Promise<void> {
  await authLock(async () => {
    await mutate<void>("/auth/logout");
    clearSession();
  });
}
