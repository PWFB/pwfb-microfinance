"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function EditLoanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [message, setMessage] = useState("Loading loan...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/loans/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Unable to load loan");
        setCustomerId(data.customerId || "");
        setAmount(String(data.amount ?? ""));
        setInterestRate(data.interestRate == null ? "" : String(data.interestRate));
        setStatus(data.status || "PENDING");
        setMessage("");
      })
      .catch((error) => setMessage(error.message || "Unable to load loan"));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("Saving changes...");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/loans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          customerId,
          amount: Number(amount),
          interestRate: interestRate === "" ? undefined : Number(interestRate),
          status,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update loan");
      router.push("/loans");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update loan");
      setSaving(false);
    }
  }

  return (
    <main className="pwfb-page">
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">LOAN MANAGEMENT</p>
          <h1 className="pwfb-page-title">Edit Loan</h1>
          <p className="pwfb-page-description">Correct the customer, amount, interest rate or loan status.</p>
        </div>
      </div>
      <section className="pwfb-panel" style={{ maxWidth: 620 }}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <label>Customer ID<input className="w-full border p-2 rounded" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required /></label>
          <label>Loan Amount<input className="w-full border p-2 rounded" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
          <label>Interest Rate (%)<input className="w-full border p-2 rounded" type="number" min="0" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} /></label>
          <label>Status<select className="w-full border p-2 rounded" value={status} onChange={(e) => setStatus(e.target.value)}><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="APPROVED">Approved</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option><option value="DEFAULTED">Defaulted</option></select></label>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="pwfb-primary-button" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            <button type="button" className="pwfb-secondary-button" onClick={() => router.push("/loans")} disabled={saving}>Cancel</button>
          </div>
          {message && <p>{message}</p>}
        </form>
      </section>
    </main>
  );
}
