"use client";

import { useState } from "react";
import { apiRequest } from "../../lib/api";

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  const [message, setMessage] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMessage("Registering...");

    try {
      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });

      console.log(result);

      setMessage(
        result.message ||
        result.error ||
        "Registration completed"
      );

    } catch (error) {
      console.error(error);
      setMessage("Connection error");
    }
  }

  return (
    <main style={{ padding: "40px" }}>
      <h1>PWFB Microfinance Registration</h1>

      <form onSubmit={handleSubmit}>

        <input
          name="firstName"
          placeholder="First Name"
          value={form.firstName}
          onChange={handleChange}
        />

        <br /><br />

        <input
          name="lastName"
          placeholder="Last Name"
          value={form.lastName}
          onChange={handleChange}
        />

        <br /><br />

        <input
          name="email"
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
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
        />

        <br /><br />

        <button type="submit">
          Register
        </button>

       </form>

      <h3>{message}</h3>
    </main>
  );
}
