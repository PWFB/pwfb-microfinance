"use client";
import { apiRequest } from "../../../lib/api";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function AddCustomerPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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
    setMessage("");

    try {
      await apiRequest("/customers", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setMessage("Customer created successfully.");

      setTimeout(() => {
        router.push("/customers");
      }, 1000);

    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create customer.");
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
      <h1>Add Customer</h1>

      <form onSubmit={handleSubmit}>

        <input
          name="firstName"
          placeholder="First Name"
          value={form.firstName}
          onChange={handleChange}
          required
        />

        <br /><br />

        <input
          name="lastName"
          placeholder="Last Name"
          value={form.lastName}
          onChange={handleChange}
          required
        />

        <br /><br />

        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />

        <br /><br />

        <input
          name="phone"
          placeholder="Phone"
          value={form.phone}
          onChange={handleChange}
        />

        <br /><br />

        <input
          name="address"
          placeholder="Address"
          value={form.address}
          onChange={handleChange}
        />

        <br /><br />

        <input
          name="dateOfBirth"
          type="date"
          value={form.dateOfBirth}
          onChange={handleChange}
        />

        <br /><br />

        <button
          type="submit"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Customer"}
        </button>

      </form>

      <br />

      <p>{message}</p>

    </main>
  );
}
