"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = "https://pwfb-microfinance-lnsm.onrender.com";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ViewCustomerPage() {
  const { id } = useParams();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    fetch(`${API_URL}/customers/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setCustomer(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <main style={{ padding: 30 }}>
        Loading customer...
      </main>
    );
  }

  if (!customer) {
    return (
      <main style={{ padding: 30 }}>
        <h2>Customer not found.</h2>

        <button onClick={() => router.push("/customers")}>
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
        maxWidth: 700,
      }}
    >
      <h1>Customer Profile</h1>

      <hr />

      <p><strong>ID:</strong> {customer.id}</p>
      <p><strong>First Name:</strong> {customer.firstName}</p>
      <p><strong>Last Name:</strong> {customer.lastName}</p>
      <p><strong>Email:</strong> {customer.email || "-"}</p>
      <p><strong>Phone:</strong> {customer.phone || "-"}</p>
      <p><strong>Address:</strong> {customer.address || "-"}</p>
      <p><strong>Date of Birth:</strong> {customer.dateOfBirth || "-"}</p>

      <br />

      <button
        onClick={() => router.push(`/customers/edit/${customer.id}`)}
      >
        Edit
      </button>

      {" "}

      <button
        onClick={() => router.push("/customers")}
      >
        Back to Customers
      </button>
    </main>
  );
}
