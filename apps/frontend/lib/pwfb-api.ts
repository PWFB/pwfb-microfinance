import { apiRequest } from "./api";

export type ApiListParams = Record<string, string | number | boolean | undefined>;

function query(params?: ApiListParams) {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : "";
}

export const pwfbApi = {
  customers: {
    me: () => apiRequest("/customers/me"),
    search: (q?: string) => apiRequest(`/customers${query(q ? { search: q } : undefined)}`),
  },
  staff: {
    search: (q?: string) => apiRequest(`/staff${query(q ? { search: q } : undefined)}`),
    create: (body: unknown) => apiRequest("/staff", { method: "POST", body: JSON.stringify(body) }),
  },
  reports: { summary: () => apiRequest("/reports/summary") },
  periods: {
    list: (params?: ApiListParams) => apiRequest(`/periods${query(params)}`),
    current: () => apiRequest("/periods/current"),
    get: (id: string) => apiRequest(`/periods/${id}`),
    create: (body: unknown) => apiRequest("/periods", { method: "POST", body: JSON.stringify(body) }),
    close: (id: string) => apiRequest(`/periods/${id}/close`, { method: "PATCH" }),
  },
  payroll: {
    list: (params?: ApiListParams) => apiRequest(`/payroll${query(params)}`),
    summary: (params?: ApiListParams) => apiRequest(`/payroll/summary${query(params)}`),
    get: (id: string) => apiRequest(`/payroll/${id}`),
    create: (body: unknown) => apiRequest("/payroll", { method: "POST", body: JSON.stringify(body) }),
    addItem: (id: string, body: unknown) => apiRequest(`/payroll/${id}/items`, { method: "POST", body: JSON.stringify(body) }),
    approve: (id: string) => apiRequest(`/payroll/${id}/approve`, { method: "PATCH" }),
    pay: (id: string) => apiRequest(`/payroll/${id}/pay`, { method: "PATCH" }),
  },
  cashbook: {
    list: (params?: ApiListParams) => apiRequest(`/cashbook${query(params)}`),
    summary: (params?: ApiListParams) => apiRequest(`/cashbook/summary${query(params)}`),
    get: (id: string) => apiRequest(`/cashbook/${id}`),
    create: (body: unknown) => apiRequest("/cashbook", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest(`/cashbook/${id}`, { method: "DELETE" }),
  },
  collections: {
    list: (params?: ApiListParams) => apiRequest(`/collections${query(params)}`),
    summary: (params?: ApiListParams) => apiRequest(`/collections/summary${query(params)}`),
    daily: (date: string) => apiRequest(`/collections/daily/${date}`),
    get: (id: string) => apiRequest(`/collections/${id}`),
    create: (body: unknown) => apiRequest("/collections", { method: "POST", body: JSON.stringify(body) }),
    reconcile: (id: string) => apiRequest(`/collections/${id}/reconcile`, { method: "PATCH" }),
    unreconcile: (id: string) => apiRequest(`/collections/${id}/unreconcile`, { method: "PATCH" }),
  },
  banking: {
    institutions: (params?: ApiListParams) => apiRequest(`/banking/institutions${query(params)}`),
    searchInstitutions: (q?: string) => apiRequest(`/banking/institutions/search${query({ q })}`),
    customerAccounts: (customerId: string) => apiRequest(`/banking/customers/${customerId}/accounts`),
    addCustomerAccount: (customerId: string, body: unknown) => apiRequest(`/banking/customers/${customerId}/accounts`, { method: "POST", body: JSON.stringify(body) }),
    customerVirtualAccounts: (customerId: string) => apiRequest(`/banking/customers/${customerId}/virtual-accounts`),
    ensureCustomerVirtualAccount: (customerId: string, institutionId?: string) => apiRequest(`/banking/customers/${customerId}/virtual-accounts/ensure`, { method: "POST", body: JSON.stringify(institutionId ? { institutionId } : {}) }),
    customerWallet: (customerId: string) => apiRequest(`/banking/customers/${customerId}/wallet`),
    customerTransactions: (customerId: string) => apiRequest(`/banking/customers/${customerId}/transactions`),
    deposit: (customerId: string, body: unknown) => apiRequest(`/banking/customers/${customerId}/deposit`, { method: "POST", body: JSON.stringify(body) }),
    withdraw: (customerId: string, body: unknown) => apiRequest(`/banking/customers/${customerId}/withdraw`, { method: "POST", body: JSON.stringify(body) }),
    transfer: (customerId: string, body: unknown) => apiRequest(`/banking/customers/${customerId}/transfer`, { method: "POST", body: JSON.stringify(body) }),
  },
  dashboards: {
    branch: (branchId: string) => apiRequest(`/dashboards/branch/${branchId}`),
    company: () => apiRequest("/dashboards/co"),
  },
};
