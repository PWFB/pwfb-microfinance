const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function request(endpoint: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || sessionStorage.getItem("token")
      : null;

  const url = `${API_URL}${endpoint}`;
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isFormData) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, { ...options, headers });
  let data: any = null;
  try { data = await response.json(); } catch { data = null; }

  if (response.status === 401) throw new Error(data?.message || `Unauthorized: ${endpoint}`);
  if (response.status === 403) throw new Error(data?.message || "You do not have permission to perform this action.");
  if (!response.ok) throw new Error(data?.message || "Request failed");
  return data;
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  return request(endpoint, options);
}

export async function apiUpload(endpoint: string, formData: FormData) {
  return request(endpoint, { method: 'POST', body: formData });
}
