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
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    throw new ApiError(
      response.status,
      messages[response.status] ??
        "Не вдалося виконати запит. Спробуйте ще раз.",
    );
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as { data: T };
  return body.data;
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

export async function authenticatedRequest<T>(path: string): Promise<T> {
  if (!accessToken || expiresAt <= Date.now() + 5000) await refreshSession();
  const usedToken = accessToken;
  try {
    return await request<T>(path, {
      headers: { Authorization: `Bearer ${usedToken}` },
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (accessToken === usedToken) await refreshSession();
    // A single retry; a second 401 never enters another refresh loop.
    try {
      return await request<T>(path, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401)
        clearSession();
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
