"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = "https://pwfb-microfinance-lnsm.onrender.com";

interface Savings {
  id: string;
  customerId: string;
  amount: number;
  accountType?: string;
  createdAt?: string;
}

export default function ViewSavingsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [saving, setSaving] = useState<Savings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    fetch(`${API_URL}/savings/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setSaving(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <main style={{ padding: 30 }}>
        Loading savings...
      </main>
    );
  }

  if (!saving) {
    return (
      <main style={{ padding: 30 }}>
        <h2>Savings record not found.</h2>

        <button
          onClick={() => router.push("/savings")}
        >
          Back
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 30,
        fontFamily: "Arial",
      }}
    >
      <h1>
        Savings Details
      </h1>

      <hr />

      <p>
        <strong>ID:</strong> {saving.id}
      </p>

      <p>
        <strong>Customer ID:</strong>{" "}
        {saving.customerId}
      </p>

      <p>
        <strong>Amount:</strong>{" "}
        {saving.amount}
      </p>

      <p>
        <strong>Account Type:</strong>{" "}
        {saving.accountType || "-"}
      </p>

      <button
        onClick={() =>
          router.push(`/savings/edit/${saving.id}`)
        }
      >
        Edit
      </button>

      {" "}

      <button
        onClick={() =>
          router.push("/savings")
        }
      >
        Back
      </button>
    </main>
  );
}
