import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

/* -------------------------------------------------------------------------- */
/* Access token — kept in memory only.                                        */
/*                                                                             */
/* The access token is never written to localStorage/sessionStorage: it       */
/* lives only in this module's variable, so it disappears on a full page      */
/* reload or a new tab. Session continuity across reloads is handled by       */
/* the httpOnly refresh cookie instead (see refreshAccessToken below and      */
/* auth.tsx's initial-load effect) — that cookie is never readable from JS,   */
/* which is the whole point: an XSS payload that runs in this page can no    */
/* longer read a long-lived credential out of storage.                       */
/* -------------------------------------------------------------------------- */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* -------------------------------------------------------------------------- */
/* Silent refresh on 401                                                      */
/*                                                                             */
/* Since the access token is short-lived and kept only in memory, an          */
/* ordinary request can 401 just because the token expired mid-session        */
/* (not because the user is actually logged out). On a 401, try refreshing    */
/* once via the httpOnly cookie and retry the original request. If the        */
/* refresh itself fails, the user is genuinely logged out.                    */
/* -------------------------------------------------------------------------- */

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Requests that must never trigger a refresh-and-retry cycle, either
// because a 401 there is an expected, meaningful result (bad login) or
// because retrying them could recurse into this same interceptor.
const NO_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];

function isNoRefreshPath(url?: string): boolean {
  if (!url) return false;
  return NO_REFRESH_PATHS.some((path) => url.includes(path));
}

// Multiple requests can 401 at roughly the same time (e.g. several
// widgets loading in parallel right as the token expires). Share one
// in-flight refresh instead of firing a refresh call per request.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then((response) => {
        const token = unwrap<{ accessToken?: string }>(response)?.accessToken;
        setAccessToken(token || null);
        return token || null;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    const shouldAttemptRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isNoRefreshPath(originalRequest.url);

    if (!shouldAttemptRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const newToken = await refreshAccessToken();

    if (!newToken) {
      // Refresh failed — this is a real logout, not a transient expiry.
      return Promise.reject(error);
    }

    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${newToken}`;

    return api(originalRequest);
  },
);

interface ApiEnvelope<T> {
  data?: T;
  message?: string;
  success?: boolean;
}

export function unwrap<T>(
  response: AxiosResponse<ApiEnvelope<T> | T>,
): T {
  const payload = response.data;

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data !== undefined
  ) {
    return payload.data as T;
  }

  return payload as T;
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

export function errorMessage(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      fallback
    );
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}