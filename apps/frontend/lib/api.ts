const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") ||
        sessionStorage.getItem("token")
      : null;

  const url = `${API_URL}${endpoint}`;

  console.log("[PWFB API REQUEST]", {
    url,
    method: options.method || "GET",
    hasToken: !!token,
    tokenLength: token?.length || 0,
  });

  const headers = new Headers(options.headers);

  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  console.log("[PWFB API RESPONSE]", {
    url,
    status: response.status,
    ok: response.ok,
    data,
  });

  if (response.status === 401) {
    throw new Error(
      data?.message ||
      `Unauthorized: ${endpoint}`,
    );
  }

  if (response.status === 403) {
    throw new Error(
      data?.message ||
      "You do not have permission to perform this action.",
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      "Request failed",
    );
  }

  return data;
}
