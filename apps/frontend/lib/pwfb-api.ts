import { apiRequest } from "./api";

export type ApiListParams = Record<string, string | number | boolean | undefined>;

function query(params?: ApiListParams) {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") search.set(key, String(value)); });
  const result = search.toString();
  return result ? `?${result}` : "";
}

function sortBanks(value: any) {
  const list = Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.institutions) ? value.institutions : [];
  const sorted = [...list].sort((a: any, b: any) => String(a?.name ?? a?.bankName ?? a?.institutionName ?? "").localeCompare(String(b?.name ?? b?.bankName ?? b?.institutionName ?? ""), undefined, { sensitivity: "base" }));
  if (Array.isArray(value)) return sorted;
  if (value && Array.isArray(value.data)) return { ...value, data: sorted };
  if (value && Array.isArray(value.institutions)) return { ...value, institutions: sorted };
  return sorted;
}

export const pwfbApi = {
  customers: { me: () => apiRequest("/customers/me"), search: (q?: string) => apiRequest(`/customers${query(q ? { search: q } : undefined)}`) },
  staff: { search: (q?: string) => apiRequest(`/staff${query(q ? { search: q } : undefined)}`), create: (body: unknown) => apiRequest("/staff", { method: "POST", body: JSON.stringify(body) }) },
  transactions: { list: () => apiRequest("/transactions"), get: (id: string) => apiRequest(`/transactions/${id}`), create: (body: unknown) => apiRequest("/transactions", { method: "POST", body: JSON.stringify(body) }), update: (id: string, body: unknown) => apiRequest(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify(body) }), remove: (id: string) => apiRequest(`/transactions/${id}`, { method: "DELETE" }) },
  reports: { summary: () => apiRequest("/reports/summary"), operations: (params?: ApiListParams) => apiRequest(`/reports/operations${query(params)}`) },
  permissions: { list: () => apiRequest("/permissions/wallet"), update: (body: { role: string; permission: string; enabled: boolean }) => apiRequest("/permissions/wallet", { method: "PATCH", body: JSON.stringify(body) }) },
  audit: { list: (params?: ApiListParams) => apiRequest(`/audit${query(params)}`) },
  periods: { list: (params?: ApiListParams) => apiRequest(`/periods${query(params)}`), current: () => apiRequest("/periods/current"), get: (id: string) => apiRequest(`/periods/${id}`), create: (body: unknown) => apiRequest("/periods", { method: "POST", body: JSON.stringify(body) }), close: (id: string) => apiRequest(`/periods/${id}/close`, { method: "PATCH" }) },
  payroll: { list: (params?: ApiListParams) => apiRequest(`/payroll${query(params)}`), summary: (params?: ApiListParams) => apiRequest(`/payroll/summary${query(params)}`), get: (id: string) => apiRequest(`/payroll/${id}`), create: (body: unknown) => apiRequest("/payroll", { method: "POST", body: JSON.stringify(body) }), addItem: (id: string, body: unknown) => apiRequest(`/payroll/${id}/items`, { method: "POST", body: JSON.stringify(body) }), approve: (id: string) => apiRequest(`/payroll/${id}/approve`, { method: "PATCH" }), pay: (id: string) => apiRequest(`/payroll/${id}/pay`, { method: "PATCH" }) },
  cashbook: { list: (params?: ApiListParams) => apiRequest(`/cashbook${query(params)}`), summary: (params?: ApiListParams) => apiRequest(`/cashbook/summary${query(params)}`), get: (id: string) => apiRequest(`/cashbook/${id}`), create: (body: unknown) => apiRequest("/cashbook", { method: "POST", body: JSON.stringify(body) }), remove: (id: string) => apiRequest(`/cashbook/${id}`, { method: "DELETE" }) },
  collections: { list: (params?: ApiListParams) => apiRequest(`/collections${query(params)}`), summary: (params?: ApiListParams) => apiRequest(`/collections/summary${query(params)}`), daily: (date: string) => apiRequest(`/collections/daily/${date}`), get: (id: string) => apiRequest(`/collections/${id}`), create: (body: unknown) => apiRequest("/collections", { method: "POST", body: JSON.stringify(body) }), reconcile: (id: string) => apiRequest(`/collections/${id}/reconcile`, { method: "PATCH" }), unreconcile: (id: string) => apiRequest(`/collections/${id}/unreconcile`, { method: "PATCH" }) },
  banking: {
    institutions: async (params?: ApiListParams) => sortBanks(await apiRequest(`/banking/institutions${query(params)}`)),
    searchInstitutions: async (q?: string) => sortBanks(await apiRequest(`/banking/institutions/search${query({ q })}`)),
    accountName: (bankCode: string, accountNumber: string, provider?: string) => apiRequest(`/banking/account-name${query({ bankCode, accountNumber, provider, verifyAt: Date.now() })}`),
    customerAccounts: (customerId: string) => apiRequest(`/banking/customers/${customerId}/accounts`),
    addCustomerAccount: (customerId: string, body: unknown) => apiRequest(`/banking/customers/${customerId}/accounts`, { method: "POST", body: JSON.stringify(body) }),
    customerVirtualAccounts: (customerId: string) => apiRequest(`/banking/customers/${customerId}/virtual-accounts`),
    ensureCustomerVirtualAccount: (customerId: string, institutionId?: string) => apiRequest(`/banking/customers/${customerId}/virtual-accounts/ensure`, { method: "POST", body: JSON.stringify(institutionId ? { institutionId } : {}) }),
    customerWallet: (customerId: string) => apiRequest(`/banking/customers/${customerId}/wallet`),
    customerTransactions: (customerId: string) => apiRequest(`/banking/customers/${customerId}/transactions`),
    deposit: (customerId: string, body: unknown) => apiRequest(`/banking/customers/${customerId}/deposit`, { method: "POST", body: JSON.stringify(body) }),
    withdraw: (customerId: string, body: unknown) => apiRequest(`/banking/customers/${customerId}/withdraw`, { method: "POST", body: JSON.stringify(body) }),
    transfer: (customerId: string, body: unknown) => apiRequest(`/banking/customers/${customerId}/transfer`, { method: "POST", body: JSON.stringify(body) }),
    bankTransfer: (customerId: string, body: unknown) => apiRequest(`/banking/customers/${customerId}/bank-transfer`, { method: "POST", body: JSON.stringify(body) }),
    initializePaystackDeposit: (customerId: string, amount: number) => apiRequest(`/banking/customers/${customerId}/paystack/initialize`, { method: "POST", body: JSON.stringify({ amount }) }),
    verifyPaystackDeposit: (reference: string) => apiRequest(`/banking/paystack/verify/${encodeURIComponent(reference)}`, { method: "POST" }),
  },
  dashboards: { branch: (branchId: string) => apiRequest(`/dashboards/branch/${branchId}`), company: () => apiRequest("/dashboards/co") },
};
