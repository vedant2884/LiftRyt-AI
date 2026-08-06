import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import type { AuthResponse } from "../types/auth";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// withCredentials so the browser attaches the httpOnly refresh_token cookie
// on requests to /auth/refresh and /auth/logout (its Path=/auth scope means
// it's never sent anywhere else).
export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Endpoints where a 401 means "this credential itself is invalid" rather
// than "the access token expired" — retrying with a refreshed token would
// be meaningless (or, for /auth/refresh, would recurse).
const NO_REFRESH_RETRY = /\/auth\/(login|signup|refresh)$/;

// Concurrent 401s (e.g. a page firing several requests at once right after
// the access token expires) must share one refresh call, not each fire
// their own — otherwise every refresh after the first would be replaying an
// already-rotated, now-revoked cookie and fail.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post<AuthResponse>(
      `${baseURL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    useAuthStore.getState().setAuth(res.data.access_token, res.data.user);
    return res.data.access_token;
  } catch {
    useAuthStore.getState().clearAuth();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !NO_REFRESH_RETRY.test(original.url ?? "")
    ) {
      original._retry = true;
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      const newToken = await refreshInFlight;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);
