"use client";
import { apiRequest } from "../../../lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", middleName: "", lastName: "", email: "", phone: "", address: "", dateOfBirth: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { setForm({ ...form, [e.target.name]: e.target.value }); }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    try { await apiRequest("/customers", { method: "POST", body: JSON.stringify(form) }); setMessage("Customer created successfully."); setTimeout(() => router.push("/customers"), 800); }
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
      <button className="pwfb-primary-button" type="submit" disabled={loading}>{loading ? "Saving..." : "Create Customer"}</button>
      {message && <p>{message}</p>}
    </form>
  </main>;
}
