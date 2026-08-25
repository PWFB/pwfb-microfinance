"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api";

export default function EditCustomerPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    branchId: "",
    assignedStaffId: "",
    groupId: "",
  });

  useEffect(() => {
    if (!id) return;
    apiRequest(`/customers/${id}`)
      .then((data) => {
        setForm({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          dateOfBirth: data.dateOfBirth ? data.dateOfBirth.substring(0, 10) : "",
          branchId: data.branch?.id || "",
          assignedStaffId: data.assignedStaff?.id || "",
          groupId: data.clientGroup?.id || "",
        });
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load customer"))
      .finally(() => setLoading(false));
  }, [id]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await apiRequest(`/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          branchId: form.branchId || undefined,
          assignedStaffId: form.assignedStaffId || undefined,
          groupId: form.groupId || undefined,
        }),
      });
      router.push(`/customers/view/${id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update customer");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main style={{ padding: 30 }}>Loading...</main>;

  return (
    <main style={{ padding: 30, fontFamily: "Arial", maxWidth: 800 }}>
      <p className="pwfb-eyebrow">SUPER ADMIN • CUSTOMER MANAGEMENT</p>
      <h1>Edit Customer</h1>
      <p>Correct the customer's registered profile and assignment information.</p>

      {message && <div style={{ margin: "16px 0", padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>{message}</div>}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <label>First Name<input name="firstName" value={form.firstName} onChange={handleChange} required /></label>
        <label>Last Name<input name="lastName" value={form.lastName} onChange={handleChange} required /></label>
        <label>Email<input name="email" type="email" value={form.email} onChange={handleChange} /></label>
        <label>Phone<input name="phone" value={form.phone} onChange={handleChange} /></label>
        <label>Address<input name="address" value={form.address} onChange={handleChange} /></label>
        <label>Date of Birth<input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} /></label>

        <hr />
        <h2>System assignment</h2>
        <p>These IDs are optional. Leave a field unchanged if you are not correcting that assignment.</p>
        <label>Branch ID<input name="branchId" value={form.branchId} onChange={handleChange} placeholder="Branch ID" /></label>
        <label>Assigned Staff ID<input name="assignedStaffId" value={form.assignedStaffId} onChange={handleChange} placeholder="Staff ID" /></label>
        <label>Client Group ID<input name="groupId" value={form.groupId} onChange={handleChange} placeholder="Group ID" /></label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Customer Profile"}</button>
          <button type="button" onClick={() => router.push(`/customers/view/${id}`)}>Cancel</button>
        </div>
      </form>
    </main>
  );
}
