const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
) {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token')
      : null;

  const headers = new Headers(options.headers);

  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Request failed',
    );
  }

  return data;
}
