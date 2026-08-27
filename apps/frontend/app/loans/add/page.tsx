"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Form = {
  customerId: string; firstName: string; middleName: string; lastName: string; phone: string; email: string;
  address: string; dateOfBirth: string; loanType: string; amount: string; interestRate: string;
  duration: string; repaymentFrequency: string; purpose: string; passportPhoto: string; guarantorId: string;
};

const initial: Form = {
  customerId: "", firstName: "", middleName: "", lastName: "", phone: "", email: "", address: "", dateOfBirth: "",
  loanType: "Loan", amount: "", interestRate: "", duration: "", repaymentFrequency: "Weekly", purpose: "", passportPhoto: "", guarantorId: ""
};

export default function AddLoanPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initial);
  const [message, setMessage] = useState("");
  const set = (name: keyof Form, value: string) => setForm((old) => ({ ...old, [name]: value }));
  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });

  async function passport(file?: File) {
    if (!file) return;
    try { set("passportPhoto", await fileToDataUrl(file)); } catch { setMessage("Could not read passport photo."); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Creating loan registration...");
    const token = localStorage.getItem("token") ?? "";
    const response = await fetch(`${API_URL}/loans`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, amount: Number(form.amount), interestRate: Number(form.interestRate), duration: Number(form.duration), status: "Pending" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.message || "Unable to create loan."); return; }
    const loanId = data.id ?? data.loan?.id;
    setMessage("Loan registration created successfully.");
    if (loanId) setTimeout(() => router.push(`/loans/guarantor/add?loanId=${encodeURIComponent(loanId)}`), 700);
    else setTimeout(() => router.push("/loans"), 700);
  }

  return <main>
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">PWFB LOANS</p><h1 className="pwfb-page-title">Add Loan</h1><p className="pwfb-page-description">Complete the customer loan registration, passport capture and guarantor details.</p></div></div>
    <section className="pwfb-panel" style={{ maxWidth: 1000 }}>
      <div className="pwfb-panel-header"><div><h2>Loan Registration Form</h2><p>Register the borrower first. After the loan is created, the guarantor form opens automatically.</p></div></div>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <h3>Customer information</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
          <input className="w-full border p-3 rounded" placeholder="Customer ID" value={form.customerId} onChange={e => set("customerId", e.target.value)} required />
          <input className="w-full border p-3 rounded" placeholder="First name" value={form.firstName} onChange={e => set("firstName", e.target.value)} required />
          <input className="w-full border p-3 rounded" placeholder="Middle name" value={form.middleName} onChange={e => set("middleName", e.target.value)} />
          <input className="w-full border p-3 rounded" placeholder="Last name" value={form.lastName} onChange={e => set("lastName", e.target.value)} required />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
          <input className="w-full border p-3 rounded" placeholder="Phone number" value={form.phone} onChange={e => set("phone", e.target.value)} required />
          <input className="w-full border p-3 rounded" type="email" placeholder="Email" value={form.email} onChange={e => set("email", e.target.value)} />
          <input className="w-full border p-3 rounded" type="date" value={form.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} />
        </div>
        <input className="w-full border p-3 rounded" placeholder="Residential address" value={form.address} onChange={e => set("address", e.target.value)} />

        <label className="border rounded p-4"><strong>Passport photograph</strong><p style={{ margin: "4px 0 8px" }}>Take a passport snap with the phone camera or upload an existing photo.</p><input type="file" accept="image/*" capture="user" onChange={e => passport(e.target.files?.[0])} />{form.passportPhoto && <p>✓ Passport photo captured</p>}</label>

        <h3>Loan details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
          <select className="w-full border p-3 rounded" value={form.loanType} onChange={e => set("loanType", e.target.value)}><option>Loan</option><option>Weekly Loan</option><option>Finance Service</option></select>
          <input className="w-full border p-3 rounded" type="number" min="0" placeholder="Loan amount (₦)" value={form.amount} onChange={e => set("amount", e.target.value)} required />
          <input className="w-full border p-3 rounded" type="number" min="0" step="0.01" placeholder="Interest rate (%)" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} required />
          <input className="w-full border p-3 rounded" type="number" min="1" placeholder="Duration" value={form.duration} onChange={e => set("duration", e.target.value)} required />
          <select className="w-full border p-3 rounded" value={form.repaymentFrequency} onChange={e => set("repaymentFrequency", e.target.value)}><option>Weekly</option><option>Daily</option><option>Monthly</option></select>
          <input className="w-full border p-3 rounded" placeholder="Loan purpose" value={form.purpose} onChange={e => set("purpose", e.target.value)} required />
        </div>

        <div className="rounded border p-4" style={{ background: "#fff7ed" }}><strong>Guarantor registration</strong><p style={{ margin: "5px 0" }}>The guarantor form is part of the loan creation workflow. After this loan is saved, PWFB will open the full guarantor registration page where you can capture guarantor identity, passport and ID document.</p><input className="w-full border p-3 rounded" placeholder="Existing guarantor ID (optional)" value={form.guarantorId} onChange={e => set("guarantorId", e.target.value)} /></div>

        <div style={{ display: "flex", gap: 10 }}><button className="pwfb-primary-button" type="submit">Create Loan + Register Guarantor</button><button type="button" className="border rounded px-4 py-2" onClick={() => router.push("/loans")}>Cancel</button></div>
        {message && <p>{message}</p>}
      </form>
    </section>
  </main>;
}
