"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", passportPhoto: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
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
    setMessage("");
    setLoading(true);
    try {
      const result = await apiRequest("/auth/register", { method: "POST", body: JSON.stringify(form) });
      if (!result?.access_token) throw new Error(result?.message || result?.error || "Registration failed");
      localStorage.setItem("token", result.access_token);
      sessionStorage.setItem("token", result.access_token);
      const role = result.user?.role;
      setMessage(role === "SUPER_ADMIN" ? "Super Admin account created successfully." : "Account created successfully.");
      window.setTimeout(() => {
        if (role === "SUPER_ADMIN") router.push("/dashboard");
        else if (role === "CUSTOMER") router.push("/customer-dashboard");
        else router.push("/staff-dashboard");
      }, 500);
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : "Unable to create the account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100dvh", background: "#f2f7f4", padding: "40px 20px", fontFamily: "Inter,system-ui,sans-serif", color: "#18221d" }}>
      <section style={{ maxWidth: 520, margin: "0 auto", background: "#fff", borderRadius: 24, padding: "32px", boxShadow: "0 20px 60px rgba(5,55,28,.12)" }}>
        <div style={{ borderBottom: "4px solid #f47712", paddingBottom: 14, marginBottom: 24 }}>
          <h1 style={{ margin: 0, color: "#075e2c", fontSize: 28 }}>Create PWFB Account</h1>
          <p style={{ margin: "7px 0 0", color: "#718078", fontSize: 13 }}>Create your secure PWFB login account. The configured Super Admin email is automatically protected from being created as a customer.</p>
        </div>
        {message && <div style={{ padding: "10px 12px", marginBottom: 16, borderRadius: 9, background: "#fff3e7", color: "#974700", borderLeft: "3px solid #f47712", fontSize: 12 }}>{message}</div>}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 13 }}>
          <label><strong>First name</strong><input name="firstName" placeholder="First name" value={form.firstName} onChange={handleChange} required style={inputStyle} /></label>
          <label><strong>Last name</strong><input name="lastName" placeholder="Last name" value={form.lastName} onChange={handleChange} required style={inputStyle} /></label>
          <label><strong>Email</strong><input type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required style={inputStyle} /></label>
          <label><strong>Phone</strong><input name="phone" placeholder="Phone number" value={form.phone} onChange={handleChange} required style={inputStyle} /></label>
          <label><strong>Password</strong><input type="password" name="password" placeholder="At least 8 characters" value={form.password} onChange={handleChange} required minLength={8} style={inputStyle} /></label>
          <label><strong>Passport photo <span style={{ color: "#718078", fontWeight: 500 }}>(optional)</span></strong><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{ width: "100%", marginTop: 7 }} /></label>
          {photoPreview && <img src={photoPreview} alt="Passport preview" style={{ width: 120, height: 145, objectFit: "cover", borderRadius: 10, border: "1px solid #dbe5df" }} />}
          <button type="submit" disabled={loading} style={{ height: 48, border: 0, borderRadius: 10, background: "#087534", color: "#fff", fontWeight: 900, borderBottom: "4px solid #f47712" }}>{loading ? "Creating account…" : "Create account"}</button>
          <button type="button" onClick={() => router.push("/login")} style={{ height: 44, border: "1px solid #dce5df", borderRadius: 10, background: "#fff", color: "#087534", fontWeight: 800 }}>Back to sign in</button>
        </form>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: 46,
  marginTop: 6,
  border: "1px solid #dbe5df",
  borderRadius: 10,
  padding: "0 12px",
  outline: "none",
  fontSize: 13,
  background: "#fbfdfc",
};
