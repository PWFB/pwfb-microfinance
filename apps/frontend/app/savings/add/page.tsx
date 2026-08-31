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
      await apiRequest("/savings", {
        method: "POST",
        body: JSON.stringify({ customerId: form.customerId, amount: Number(form.amount), accountType: form.accountType }),
      });
      router.push("/savings");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save savings record.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pwfb-savings-create-page">
      <div className="pwfb-savings-create-hero">
        <div>
          <p className="pwfb-eyebrow">SAVINGS OPERATIONS</p>
          <h1 className="pwfb-page-title">Create New Savings</h1>
          <p className="pwfb-page-description">Register a customer savings account and record the opening deposit.</p>
        </div>
        <button type="button" className="pwfb-savings-back" onClick={() => router.push("/savings")}>← Back to Savings</button>
      </div>

      <section className="pwfb-savings-create-card">
        <div className="pwfb-savings-card-heading">
          <div className="pwfb-savings-icon">₦</div>
          <div>
            <h2>New Savings Account</h2>
            <p>Enter the customer and savings information below.</p>
          </div>
        </div>

        {error && <div className="pwfb-error">{error}</div>}

        <form onSubmit={handleSubmit} className="pwfb-savings-form">
          <div className="pwfb-savings-section-title">Account Information</div>

          <div className="pwfb-savings-fields">
            <div className="pwfb-savings-field pwfb-savings-field-wide">
              <label htmlFor="customerId">Customer ID</label>
              <input id="customerId" name="customerId" placeholder="Enter customer ID" value={form.customerId} onChange={handleChange} required />
              <small>Enter the registered customer ID for this savings account.</small>
            </div>

            <div className="pwfb-savings-field">
              <label htmlFor="amount">Opening Deposit</label>
              <div className="pwfb-money-input"><span>₦</span><input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={handleChange} required /></div>
              <small>Enter the initial amount to record.</small>
            </div>

            <div className="pwfb-savings-field">
              <label htmlFor="accountType">Account Type</label>
              <select id="accountType" name="accountType" value={form.accountType} onChange={handleChange} required>
                <option>Regular Savings</option>
                <option>Daily Savings</option>
                <option>Target Savings</option>
                <option>Fixed Savings</option>
              </select>
              <small>Select the type of savings account.</small>
            </div>
          </div>

          <div className="pwfb-savings-note">
            <strong>✓ Savings record</strong>
            <span>The account will be created for the selected customer after you save.</span>
          </div>

          <div className="pwfb-savings-actions">
            <button type="button" className="pwfb-secondary-button" onClick={() => router.push("/savings")} disabled={loading}>Cancel</button>
            <button type="submit" className="pwfb-primary-button pwfb-save-savings" disabled={loading}>{loading ? "Saving..." : "Save Savings Account"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
