const API_URL = "https://pwfb-microfinance-lnsm.onrender.com";

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  return response.json();
}
