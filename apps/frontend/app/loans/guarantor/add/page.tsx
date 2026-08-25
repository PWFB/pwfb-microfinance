"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Form = { loanId: string; firstName: string; middleName: string; lastName: string; phone: string; email: string; address: string; dateOfBirth: string; relationship: string; idType: string; idNumber: string; idDocument: string; passportPhoto: string; verificationNote: string };

export default function AddGuarantorPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<Form>({ loanId: params.get("loanId") ?? "", firstName: "", middleName: "", lastName: "", phone: "", email: "", address: "", dateOfBirth: "", relationship: "", idType: "National ID (NIN)", idNumber: "", idDocument: "", passportPhoto: "", verificationNote: "" });

  const set = (name: keyof Form, value: string) => setForm((old) => ({ ...old, [name]: value }));
  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });

  async function handleFile(name: "passportPhoto" | "idDocument", file?: File) { if (!file) return; try { set(name, await fileToDataUrl(file)); } catch { setMessage("Could not read the selected file."); } }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.loanId) { setMessage("Enter the loan ID for this guarantor."); return; }
    setMessage("Saving guarantor...");
    const token = localStorage.getItem("token") ?? "";
    const response = await fetch(`${API_URL}/loans/${form.loanId}/guarantors`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.message || "Unable to save guarantor."); return; }
    setMessage("Guarantor saved. This is a temporary record and has not been identity-verified.");
    setTimeout(() => router.push(`/loans/view/${form.loanId}`), 700);
  }

  return <main>
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">LOAN SECURITY</p><h1 className="pwfb-page-title">Guarantor Registration</h1><p className="pwfb-page-description">Capture guarantor details, passport and one valid ID for the loan file.</p></div></div>
    <section className="pwfb-panel" style={{ maxWidth: 900 }}>
      <div className="pwfb-panel-header"><div><h2>Guarantor information</h2><p>Temporary onboarding only — no NIN/BVN/ID verification is performed here.</p></div></div>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <input className="w-full border p-3 rounded" placeholder="Loan ID" value={form.loanId} onChange={(e) => set("loanId", e.target.value)} required />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}><input className="w-full border p-3 rounded" placeholder="First name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required /><input className="w-full border p-3 rounded" placeholder="Middle name" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} /><input className="w-full border p-3 rounded" placeholder="Last name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}><input className="w-full border p-3 rounded" placeholder="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} required /><input className="w-full border p-3 rounded" type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
        <input className="w-full border p-3 rounded" placeholder="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}><input className="w-full border p-3 rounded" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} /><input className="w-full border p-3 rounded" placeholder="Relationship to customer" value={form.relationship} onChange={(e) => set("relationship", e.target.value)} /><select className="w-full border p-3 rounded" value={form.idType} onChange={(e) => set("idType", e.target.value)}><option>National ID (NIN)</option><option>International Passport</option><option>Driver's Licence</option><option>Voter's Card</option><option>Other Government ID</option></select></div>
        <input className="w-full border p-3 rounded" placeholder="ID card / document number" value={form.idNumber} onChange={(e) => set("idNumber", e.target.value)} required />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}><label className="border rounded p-4"><strong>Guarantor passport</strong><br /><small>Photo of guarantor</small><input type="file" accept="image/*" onChange={(e) => handleFile("passportPhoto", e.target.files?.[0])} /></label><label className="border rounded p-4"><strong>Valid ID card</strong><br /><small>Any accepted ID — temporary capture only</small><input type="file" accept="image/*,.pdf" onChange={(e) => handleFile("idDocument", e.target.files?.[0])} /></label></div>
        <textarea className="w-full border p-3 rounded" placeholder="Temporary verification note (optional)" value={form.verificationNote} onChange={(e) => set("verificationNote", e.target.value)} rows={3} />
        <div style={{ padding: 14, borderRadius: 10, background: "#fff7ed" }}><strong>Temporary verification status</strong><p style={{ margin: "6px 0 0" }}>This guarantor will be stored as <b>not verified</b>. No external identity check is claimed or performed.</p></div>
        <button className="pwfb-primary-button" type="submit">Save Guarantor</button>
        {message && <p>{message}</p>}
      </form>
    </section>
  </main>;
}
