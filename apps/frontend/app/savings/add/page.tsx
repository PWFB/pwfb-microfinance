"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";

export default function AddSavingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    amount: "",
    accountType: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      await apiRequest("/savings", {
        method: "POST",
        body: JSON.stringify({
          customerId: form.customerId,
          amount: Number(form.amount),
          accountType: form.accountType,
        }),
      });

      router.push("/savings");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save savings record.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">SAVINGS OPERATIONS</p>
          <h1 className="pwfb-page-title">Add Savings</h1>
          <p className="pwfb-page-description">
            Create a new customer savings record.
          </p>
        </div>
      </div>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>New Savings Account</h2>
            <p>
              Enter the customer and savings information below.
            </p>
          </div>
        </div>

        {error && (
          <div className="pwfb-error">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="pwfb-form"
        >
          <div className="pwfb-form-grid">
            <div className="pwfb-form-field">
              <label htmlFor="customerId">
                Customer ID
              </label>

              <input
                id="customerId"
                name="customerId"
                placeholder="Enter customer ID"
                value={form.customerId}
                onChange={handleChange}
                required
              />
            </div>

            <div className="pwfb-form-field">
              <label htmlFor="amount">
                Amount
              </label>

              <input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount"
                value={form.amount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="pwfb-form-field">
              <label htmlFor="accountType">
                Account Type
              </label>

              <input
                id="accountType"
                name="accountType"
                placeholder="e.g. Regular Savings"
                value={form.accountType}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="pwfb-form-actions">
            <button
              type="button"
              className="pwfb-secondary-button"
              onClick={() => router.push("/savings")}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="pwfb-primary-button"
              disabled={loading}
            >
              {loading
                ? "Saving..."
                : "Save Savings"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
