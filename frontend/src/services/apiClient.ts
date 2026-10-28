// ============================================================================
// API CLIENT — Centralized Fetch Wrapper for FastAPI Backend (http://127.0.0.1:8000/api/v1)
// ============================================================================

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string) ||
  (typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? "https://cen-k7rz.onrender.com/api/v1"
    : "http://127.0.0.1:8000/api/v1");

const TOKEN_KEY = "cen_auth_token";
const USER_KEY = "cen_auth_user";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): any | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: any): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      let errorCode = "";
      try {
        const errorData = await response.json();
        if (errorData.code) {
          errorCode = errorData.code;
        }
        if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
          }
        }
        // Intercept Community Suspension and broadcast event for immediate route lockdown
        if (
          errorCode === "SOCIETY_SUSPENDED" ||
          errorMessage.toLowerCase().includes("suspended by platform") ||
          errorMessage.toLowerCase().includes("community network") && errorMessage.toLowerCase().includes("suspended")
        ) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("cen:society_suspended", {
                detail: {
                  code: "SOCIETY_SUSPENDED",
                  message: errorMessage,
                },
              })
            );
          }
        }
      } catch {
        // Use fallback error message
      }
      const errObj: any = new Error(errorMessage);
      errObj.code = errorCode;
      throw errObj;
    }


    if (response.status === 204) {
      return null as T;
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (null as T);
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}
