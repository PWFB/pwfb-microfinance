const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  return response.json();
}
