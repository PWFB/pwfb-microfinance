"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";

export default function AddSavingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ customerId: "", amount: "", accountType: "Regular Savings" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiRequest("/savings", { method: "POST", body: JSON.stringify({ customerId: form.customerId, amount: Number(form.amount), accountType: form.accountType }) });
      router.push("/savings");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save savings record.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pwfb-savings-create-page" style={{ maxWidth: 980, margin: "0 auto" }}>
      <style>{`\n        .pwfb-savings-create-page{padding-bottom:40px}\n        .pwfb-savings-create-hero{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px;padding:24px;border-radius:20px;background:linear-gradient(135deg,#0a5c28,#0f7b35);box-shadow:0 12px 28px rgba(10,92,40,.16)}\n        .pwfb-savings-create-hero .pwfb-eyebrow{color:#f8a83a}\n        .pwfb-savings-create-hero .pwfb-page-title{color:#fff}\n        .pwfb-savings-create-hero .pwfb-page-description{color:#d3eadb}\n        .pwfb-savings-back{min-height:42px;padding:0 15px;border:1px solid rgba(255,255,255,.25);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;font-weight:750;white-space:nowrap}\n        .pwfb-savings-create-card{overflow:hidden;border:1px solid #dfe7e2;border-radius:20px;background:#fff;box-shadow:0 8px 28px rgba(15,123,53,.08)}\n        .pwfb-savings-card-heading{display:flex;align-items:center;gap:14px;padding:22px 24px;background:#f7fbf8;border-bottom:1px solid #e6eee9}\n        .pwfb-savings-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:#0a5c28;color:#fff;font-size:22px;font-weight:900}\n        .pwfb-savings-card-heading h2{margin:0;color:#0a5c28;font-size:20px}\n        .pwfb-savings-card-heading p{margin:5px 0 0;color:#66736b;font-size:12px}\n        .pwfb-savings-form{padding:24px}\n        .pwfb-savings-section-title{margin-bottom:16px;color:#0a5c28;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}\n        .pwfb-savings-fields{display:grid;grid-template-columns:1fr 1fr;gap:18px}\n        .pwfb-savings-field-wide{grid-column:1/-1}\n        .pwfb-savings-field label{display:block;margin-bottom:7px;color:#26362c;font-size:12px;font-weight:800}\n        .pwfb-savings-field input,.pwfb-savings-field select{width:100%;min-height:48px;padding:11px 13px;border:1px solid #d3dfd7;border-radius:11px;background:#fff;color:#17211b;outline:none}\n        .pwfb-savings-field input:focus,.pwfb-savings-field select:focus{border-color:#0f7b35;box-shadow:0 0 0 3px rgba(15,123,53,.1)}\n        .pwfb-savings-field small{display:block;margin-top:6px;color:#7a877f;font-size:10px}\n        .pwfb-money-input{display:flex}.pwfb-money-input span{display:grid;place-items:center;width:48px;border:1px solid #d3dfd7;border-right:0;border-radius:11px 0 0 11px;background:#eaf7ef;color:#0a5c28;font-weight:900}.pwfb-money-input input{border-radius:0 11px 11px 0!important}\n        .pwfb-savings-note{display:flex;align-items:center;gap:10px;margin-top:22px;padding:13px 15px;border:1px solid #cfe6d5;border-radius:12px;background:#f0faf3;color:#42604c;font-size:11px}.pwfb-savings-note strong{color:#0a5c28}\n        .pwfb-savings-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:20px;border-top:1px solid #e8eee9}.pwfb-save-savings{min-width:190px}\n        .pwfb-error{margin-bottom:18px;padding:12px 14px;border:1px solid #efc4bb;border-radius:10px;background:#fff2ef;color:#a43b25;font-size:11px;font-weight:700}\n        @media(max-width:700px){.pwfb-savings-create-hero{align-items:flex-start;flex-direction:column;padding:20px}.pwfb-savings-back{width:100%}.pwfb-savings-fields{grid-template-columns:1fr}.pwfb-savings-field-wide{grid-column:auto}.pwfb-savings-form{padding:18px}.pwfb-savings-card-heading{padding:18px}.pwfb-savings-actions{flex-direction:column-reverse}.pwfb-savings-actions button{width:100%}}\n      `}</style>

      <div className="pwfb-savings-create-hero">
        <div>
          <p className="pwfb-eyebrow">SAVINGS OPERATIONS</p>
          <h1 className="pwfb-page-title">Create New Savings</h1>
          <p className="pwfb-page-description">Open a savings record and capture the customer’s opening deposit.</p>
        </div>
        <button type="button" className="pwfb-savings-back" onClick={() => router.push("/savings")}>← Back to Savings</button>
      </div>

      <section className="pwfb-savings-create-card">
        <div className="pwfb-savings-card-heading">
          <div className="pwfb-savings-icon">₦</div>
          <div><h2>New Savings Account</h2><p>Enter the customer and savings information below.</p></div>
        </div>

        <div style={{ padding: "20px 24px 0" }}>{error && <div className="pwfb-error">{error}</div>}</div>

        <form onSubmit={handleSubmit} className="pwfb-savings-form">
          <div className="pwfb-savings-section-title">Account Information</div>
          <div className="pwfb-savings-fields">
            <div className="pwfb-savings-field pwfb-savings-field-wide">
              <label htmlFor="customerId">Customer ID</label>
              <input id="customerId" name="customerId" placeholder="Enter customer ID" value={form.customerId} onChange={handleChange} required />
              <small>Use the ID of an existing PWFB customer.</small>
            </div>
            <div className="pwfb-savings-field">
              <label htmlFor="amount">Opening Deposit</label>
              <div className="pwfb-money-input"><span>₦</span><input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={handleChange} required /></div>
              <small>Enter the initial savings amount.</small>
            </div>
            <div className="pwfb-savings-field">
              <label htmlFor="accountType">Account Type</label>
              <select id="accountType" name="accountType" value={form.accountType} onChange={handleChange} required>
                <option>Regular Savings</option><option>Daily Savings</option><option>Target Savings</option><option>Fixed Savings</option>
              </select>
              <small>Select the appropriate savings product.</small>
            </div>
          </div>

          <div className="pwfb-savings-note"><strong>✓ Ready to save</strong><span>The new record will be created for this customer when you confirm.</span></div>
          <div className="pwfb-savings-actions">
            <button type="button" className="pwfb-secondary-button" onClick={() => router.push("/savings")} disabled={loading}>Cancel</button>
            <button type="submit" className="pwfb-primary-button pwfb-save-savings" disabled={loading}>{loading ? "Saving..." : "Save Savings Account"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
