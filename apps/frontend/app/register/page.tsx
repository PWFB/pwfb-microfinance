"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", passportPhoto: "" });
  const [message, setMessage] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Please select a valid image file."); return; }
    if (file.size > 2 * 1024 * 1024) { setMessage("Passport photo must be 2MB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setForm((current) => ({ ...current, passportPhoto: value }));
      setPhotoPreview(value);
      setMessage("");
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Registering...");
    try {
      const result = await apiRequest("/auth/register", { method: "POST", body: JSON.stringify(form) });
      if (result.access_token) {
        localStorage.setItem("token", result.access_token);
        setMessage("Registration successful");
        setTimeout(() => router.push("/dashboard"), 1000);
      } else {
        setMessage(result.message || result.error || "Registration failed");
      }
    } catch (error) {
      console.error(error);
      setMessage("Connection error");
    }
  }

  return (
    <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1>PWFB Microfinance Registration</h1>
      <p>Customer information and identification photo</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "420px" }}>
        <input name="firstName" placeholder="First Name" value={form.firstName} onChange={handleChange} required />
        <input name="lastName" placeholder="Last Name" value={form.lastName} onChange={handleChange} required />
        <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />
        <input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} required minLength={8} />

        <label htmlFor="passportPhoto"><strong>Customer Passport Photo</strong></label>
        <input id="passportPhoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} required />
        {photoPreview && <img src={photoPreview} alt="Passport preview" style={{ width: 140, height: 170, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />}

        <button type="submit">Register Customer</button>
        <p>{message}</p>
      </form>
    </main>
  );
}
