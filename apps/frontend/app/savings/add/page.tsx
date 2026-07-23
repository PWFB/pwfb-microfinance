"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "https://pwfb-microfinance-lnsm.onrender.com";

export default function AddSavingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    customerId: "",
    amount: "",
    accountType: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/savings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            amount: Number(form.amount),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to create savings"
        );
      }

      router.push("/savings");

    } catch (error) {
      console.error(error);
      alert("Unable to save savings record.");
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        padding: 30,
        fontFamily: "Arial",
        maxWidth: 600,
      }}
    >
      <h1>
        Add Savings
      </h1>

      <form onSubmit={handleSubmit}>

        <input
          name="customerId"
          placeholder="Customer ID"
          value={form.customerId}
          onChange={handleChange}
          required
        />

        <br />
        <br />

        <input
          name="amount"
          type="number"
          placeholder="Amount"
          value={form.amount}
          onChange={handleChange}
          required
        />

        <br />
        <br />

        <input
          name="accountType"
          placeholder="Account Type"
          value={form.accountType}
          onChange={handleChange}
        />

        <br />
        <br />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Saving..."
            : "Save Savings"}
        </button>

      </form>
    </main>
  );
}
