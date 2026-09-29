"use client";
import { apiRequest } from "../../../lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", middleName: "", lastName: "", email: "", phone: "", address: "", dateOfBirth: "", registrationFee: "", clientCardFee: "", otherFee: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { setForm({ ...form, [e.target.name]: e.target.value }); }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    try { await apiRequest("/customers", { method: "POST", body: JSON.stringify({
        ...form,
        registrationFee: Number(form.registrationFee || 0),
        clientCardFee: Number(form.clientCardFee || 0),
        otherFee: Number(form.otherFee || 0),
      }) }); setMessage("Customer created successfully."); setTimeout(() => router.push("/customers"), 800); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create customer."); }
    finally { setLoading(false); }
  }
  return <main className="pwfb-panel" style={{ maxWidth: 760 }}>
    <div className="pwfb-panel-header"><div><p className="pwfb-eyebrow">CUSTOMER REGISTRATION</p><h1 className="pwfb-page-title">Add Customer</h1><p className="pwfb-page-description">Register the customer using their complete legal name.</p></div></div>
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <input name="firstName" placeholder="First Name" value={form.firstName} onChange={handleChange} required />
        <input name="middleName" placeholder="Middle Name" value={form.middleName} onChange={handleChange} />
        <input name="lastName" placeholder="Last Name" value={form.lastName} onChange={handleChange} required />
      </div>
      <input name="email" type="email" placeholder="Email (optional)" value={form.email} onChange={handleChange} />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
      <input name="address" placeholder="Address" value={form.address} onChange={handleChange} />
      <label>Date of Birth<input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} /></label>
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
        <p className="pwfb-eyebrow">INITIAL FIELD COLLECTION</p>
        <p className="pwfb-page-description">Collect onboarding fees during registration. Each fee is recorded against this customer and the registering staff member.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
          <input name="registrationFee" type="number" min="0" step="0.01" placeholder="Registration Fee (₦)" value={form.registrationFee} onChange={handleChange} />
          <input name="clientCardFee" type="number" min="0" step="0.01" placeholder="Client Card Fee (₦)" value={form.clientCardFee} onChange={handleChange} />
          <input name="otherFee" type="number" min="0" step="0.01" placeholder="Other Fee (₦)" value={form.otherFee} onChange={handleChange} />
        </div>
      </div>
      <button className="pwfb-primary-button" type="submit" disabled={loading}>{loading ? "Saving..." : "Create Customer"}</button>
      {message && <p>{message}</p>}
    </form>
  </main>;
}
