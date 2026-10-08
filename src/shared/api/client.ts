import type { User } from "@/entities/user/model";

const baseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
let accessToken: string | null = null;
let expiresAt = 0;
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;
let refreshPromise: Promise<User> | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: { field: string; message: string }[] = [],
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
      signal: AbortSignal.timeout(15000),
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError(0, "Не вдалося виконати запит. Спробуйте ще раз.");
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "Перевірте правильність заповнення полів",
      401: "Сесію завершено. Увійдіть знову",
      403: "Оновіть сторінку та спробуйте знову",
      409: "Користувач із такою електронною адресою вже існує",
      429: "Забагато запитів. Спробуйте за хвилину",
    };
    const errorBody: unknown = await response.json().catch(() => null);
    const known = new Set([
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
    ]);
    let message =
      messages[response.status] ??
      "Не вдалося виконати запит. Спробуйте ще раз.";
    const details: { field: string; message: string }[] = [];
    if (errorBody && typeof errorBody === "object") {
      if (
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        known.has(errorBody.message)
      )
        message = errorBody.message;
      if ("details" in errorBody && Array.isArray(errorBody.details)) {
        for (const detail of errorBody.details)
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
    throw new ApiError(response.status, message, details);
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

type AuthResult = { user: User; accessToken: string; expiresIn: number };
function accept(data: AuthResult): User {
  accessToken = data.accessToken;
  expiresAt = Date.now() + data.expiresIn * 1000;
  return data.user;
}
export function clearSession(): void {
  accessToken = null;
  expiresAt = 0;
}

export async function signIn(
  mode: "login" | "register",
  input: unknown,
): Promise<User> {
  return authLock(async () => {
    try {
      return accept(await mutate<AuthResult>(`/auth/${mode}`, input));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        throw new ApiError(401, "Невірна електронна адреса або пароль");
      throw error;
    }
  });
}

export function refreshSession(): Promise<User> {
  refreshPromise ??= authLock(async () => {
    try {
      return accept(await mutate<AuthResult>("/auth/refresh"));
    } catch (error) {
      clearSession();
      throw error;
    }
  }).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export function publicRequest<T>(path: string, envelope = false): Promise<T> {
  return request<T>(path, {}, envelope);
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
  try {
    if (!accessToken || expiresAt <= Date.now() + 5000) await refreshSession();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) expiredSession();
    throw error;
  }
  const headers = {
    ...options.headers,
    ...(["POST", "PATCH", "DELETE"].includes(options.method ?? "GET")
      ? { "X-CSRF-Token": await csrf() }
      : {}),
  };
  const usedToken = accessToken;
  try {
    return await request<T>(
      path,
      {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${usedToken}` },
      },
      envelope,
    );
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    try {
      if (accessToken === usedToken) await refreshSession();
      return await request<T>(
        path,
        {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${accessToken}` },
        },
        envelope,
      );
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        clearSession();
        expiredSession();
      }
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
