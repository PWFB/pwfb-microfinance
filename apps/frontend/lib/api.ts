const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();
const PRODUCTION_API_URL = "https://pwfb-backend.onrender.com";
const API_URL = (CONFIGURED_API_URL || PRODUCTION_API_URL).replace(/\/$/, "");

function absorbNativeAppToken() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(raw);
    const appToken = params.get("app_token");
    if (!appToken) return;
    localStorage.setItem("token", appToken);
    params.delete("app_token");
    const cleanHash = params.toString();
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}${cleanHash ? `#${cleanHash}` : ""}`);
  } catch { /* ignore malformed native handoff */ }
}

function tokenExpiry(token: string | null) {
  if (!token) return 0;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Number(payload?.exp || 0);
  } catch {
    return 0;
  }
}

function getStoredToken() {
  if (typeof window === "undefined") return null;
  const localToken = localStorage.getItem("token");
  const sessionToken = sessionStorage.getItem("token");
  if (!localToken) return sessionToken;
  if (!sessionToken) return localToken;
  return tokenExpiry(sessionToken) >= tokenExpiry(localToken) ? sessionToken : localToken;
}

async function request(endpoint: string, options: RequestInit = {}) {
  absorbNativeAppToken();
  const token = getStoredToken();

  const url = `${API_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, credentials: "include" });
  } catch {
    throw new Error("Unable to connect to PWFB server. Please check your internet connection and try again.");
  }

  let data: any = null;
  try { data = await response.json(); } catch { data = null; }

  if (response.status === 401) {
    throw new Error(data?.message || "Your PWFB session has expired or is no longer valid. Please sign in again.");
  }
  if (response.status === 403) throw new Error(data?.message || "You do not have permission to perform this action.");
  if (!response.ok) throw new Error(data?.message || `PWFB server error (${response.status})`);
  return data;
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  return request(endpoint, options);
}

export async function apiUpload(endpoint: string, formData: FormData) {
  return request(endpoint, { method: "POST", body: formData });
}