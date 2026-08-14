import { apiRequest } from "./api";

export type ApiListParams = Record<
  string,
  string | number | boolean | undefined
>;

function query(params?: ApiListParams) {
  if (!params) return "";

  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  });

  const result = search.toString();

  return result ? `?${result}` : "";
}

export const pwfbApi = {
  reports: {
    summary: () => apiRequest("/reports/summary"),
  },

  periods: {
    list: (params?: ApiListParams) =>
      apiRequest(`/periods${query(params)}`),

    current: () =>
      apiRequest("/periods/current"),

    get: (id: string) =>
      apiRequest(`/periods/${id}`),

    create: (body: unknown) =>
      apiRequest("/periods", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    close: (id: string) =>
      apiRequest(`/periods/${id}/close`, {
        method: "PATCH",
      }),
  },

  payroll: {
    list: (params?: ApiListParams) =>
      apiRequest(`/payroll${query(params)}`),

    summary: (params?: ApiListParams) =>
      apiRequest(`/payroll/summary${query(params)}`),

    get: (id: string) =>
      apiRequest(`/payroll/${id}`),

    create: (body: unknown) =>
      apiRequest("/payroll", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    addItem: (id: string, body: unknown) =>
      apiRequest(`/payroll/${id}/items`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    approve: (id: string) =>
      apiRequest(`/payroll/${id}/approve`, {
        method: "PATCH",
      }),

    pay: (id: string) =>
      apiRequest(`/payroll/${id}/pay`, {
        method: "PATCH",
      }),
  },

  cashbook: {
    list: (params?: ApiListParams) =>
      apiRequest(`/cashbook${query(params)}`),

    summary: (params?: ApiListParams) =>
      apiRequest(`/cashbook/summary${query(params)}`),

    get: (id: string) =>
      apiRequest(`/cashbook/${id}`),

    create: (body: unknown) =>
      apiRequest("/cashbook", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    remove: (id: string) =>
      apiRequest(`/cashbook/${id}`, {
        method: "DELETE",
      }),
  },

  collections: {
    list: (params?: ApiListParams) =>
      apiRequest(`/collections${query(params)}`),

    summary: (params?: ApiListParams) =>
      apiRequest(`/collections/summary${query(params)}`),

    daily: (date: string) =>
      apiRequest(`/collections/daily/${date}`),

    get: (id: string) =>
      apiRequest(`/collections/${id}`),

    create: (body: unknown) =>
      apiRequest("/collections", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    reconcile: (id: string) =>
      apiRequest(`/collections/${id}/reconcile`, {
        method: "PATCH",
      }),

    unreconcile: (id: string) =>
      apiRequest(`/collections/${id}/unreconcile`, {
        method: "PATCH",
      }),
  },

  dashboards: {
    branch: (branchId: string) =>
      apiRequest(`/dashboards/branch/${branchId}`),

    company: () =>
      apiRequest("/dashboards/co"),
  },
};
