"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = "https://pwfb-microfinance-lnsm.onrender.com";

export default function EditSavingsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    customerId: "",
    amount: "",
    accountType: "",
  });

  useEffect(() => {
    if (!id) return;

    fetch(`${API_URL}/savings/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setForm({
          customerId: data.customerId || "",
          amount: data.amount?.toString() || "",
          accountType: data.accountType || "",
        });

        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

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

    const response = await fetch(
      `${API_URL}/savings/${id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      }
    );

    if (response.ok) {
      router.push("/savings");
    } else {
      alert("Unable to update savings.");
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 30 }}>
        Loading...
      </main>
    );
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
        Edit Savings
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

        <button type="submit">
          Update Savings
        </button>

      </form>
    </main>
  );
}
