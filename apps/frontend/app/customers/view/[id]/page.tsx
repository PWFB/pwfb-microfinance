"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  createdAt?: string;
  updatedAt?: string;
  branch?: { id: string; name: string } | null;
  assignedStaff?: { id: string; firstName: string; lastName: string } | null;
  clientGroup?: { id: string; name: string } | null;
  user?: { id: string; email: string; role: string; createdAt?: string } | null;
  bankAccounts?: Array<{
    id: string;
    accountNumber: string;
    accountName?: string | null;
    status: string;
    isPrimary: boolean;
    institution?: { name: string; code?: string | null } | null;
  }>;
  virtualAccounts?: Array<{
    id: string;
    accountNumber?: string | null;
    accountName?: string | null;
    provider?: string | null;
    providerCustomerId?: string | null;
    providerReference?: string | null;
    status: string;
    institution?: { name: string } | null;
  }>;
  wallet?: { balance: number; currency: string; status: string } | null;
}

export default function ViewCustomerPage() {
  const { id } = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    apiRequest(`/customers/${id}`)
      .then((data) => setCustomer(data))
      .catch(() => setCustomer(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function resetPassword() {
    if (!window.confirm("Reset this customer's login password? The current password cannot be recovered.")) return;
    setResetting(true);
    setMessage("");
    try {
      const result = await apiRequest(`/customers/${id}/reset-password`, { method: "POST" });
      setTemporaryPassword(result.temporaryPassword || "");
      setMessage("Password reset successfully. Give the temporary password to the customer securely.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset password");
    } finally {
      setResetting(false);
    }
  }

  if (loading) return <main style={{ padding: 30 }}>Loading customer...</main>;
  if (!customer) {
    return <main style={{ padding: 30 }}><h2>Customer not found.</h2><button onClick={() => router.push("/customers")}>Back</button></main>;
  }

  return (
    <main style={{ padding: 30, fontFamily: "Arial", maxWidth: 1000 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <p className="pwfb-eyebrow">SUPER ADMIN • CUSTOMER PROFILE</p>
          <h1>Customer Profile</h1>
          <p>{customer.firstName} {customer.lastName} • {customer.id}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => router.push(`/customers/edit/${customer.id}`)}>Edit Profile</button>
          <button onClick={resetPassword} disabled={resetting}>{resetting ? "Resetting..." : "Reset Password"}</button>
          <button onClick={() => router.push("/customers")}>Back</button>
        </div>
      </div>

      {message && <div style={{ margin: "16px 0", padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>{message}</div>}
      {temporaryPassword && <div style={{ margin: "16px 0", padding: 16, border: "1px solid #ccc", borderRadius: 8 }}><strong>Temporary password:</strong> {temporaryPassword}<br /><small>This is shown once. PWFB does not display the customer's previous plaintext password.</small></div>}

      <section style={{ marginTop: 24 }}>
        <h2>Personal information</h2>
        <p><strong>First name:</strong> {customer.firstName}</p>
        <p><strong>Last name:</strong> {customer.lastName}</p>
        <p><strong>Email:</strong> {customer.email || "—"}</p>
        <p><strong>Phone:</strong> {customer.phone || "—"}</p>
        <p><strong>Address:</strong> {customer.address || "—"}</p>
        <p><strong>Date of birth:</strong> {customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString() : "—"}</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Account & assignment</h2>
        <p><strong>Login email:</strong> {customer.user?.email || customer.email || "—"}</p>
        <p><strong>Role:</strong> {customer.user?.role || "CUSTOMER"}</p>
        <p><strong>Branch:</strong> {customer.branch?.name || "—"}</p>
        <p><strong>Assigned staff:</strong> {customer.assignedStaff ? `${customer.assignedStaff.firstName} ${customer.assignedStaff.lastName}` : "—"}</p>
        <p><strong>Group:</strong> {customer.clientGroup?.name || "—"}</p>
        <p><strong>Registered:</strong> {customer.createdAt ? new Date(customer.createdAt).toLocaleString() : "—"}</p>
        <p><strong>Last updated:</strong> {customer.updatedAt ? new Date(customer.updatedAt).toLocaleString() : "—"}</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Wallet</h2>
        <p><strong>Balance:</strong> {customer.wallet ? `${customer.wallet.currency} ${customer.wallet.balance.toLocaleString()}` : "No wallet"}</p>
        <p><strong>Status:</strong> {customer.wallet?.status || "—"}</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Registered bank accounts</h2>
        {customer.bankAccounts?.length ? customer.bankAccounts.map((account) => (
          <div key={account.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 8 }}>
            <strong>{account.institution?.name || "Bank"}</strong> — {account.accountNumber}<br />
            Name: {account.accountName || "—"} • Status: {account.status}{account.isPrimary ? " • Primary" : ""}
          </div>
        )) : <p>No bank account registered.</p>}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Virtual accounts</h2>
        {customer.virtualAccounts?.length ? customer.virtualAccounts.map((account) => (
          <div key={account.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 8 }}>
            <strong>{account.institution?.name || account.provider || "Provider"}</strong><br />
            Account number: {account.accountNumber || "Not generated"}<br />
            Account name: {account.accountName || "—"}<br />
            Provider: {account.provider || "—"} • Status: {account.status}<br />
            Provider customer: {account.providerCustomerId || "—"}
          </div>
        )) : <p>No virtual account record.</p>}
      </section>
    </main>
  );
}
