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
  const [identityVerification, setIdentityVerification] = useState<{ bvnStatus?: string; ninStatus?: string; bvn?: string | null; nin?: string | null } | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
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
        setIdentityVerification(data.identityVerification || null);
        setForm({
          firstName: data.firstName || "",
          middleName: data.middleName || "",
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
      <p>Correct the customer's registered profile and assignment information. This page edits customer records only; it does not edit staff records.</p>

      <section style={{ margin: '18px 0', padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
        <h2>Customer KYC tier & limits</h2>
        {(() => { const verified = (status?: string) => ['VERIFIED', 'OVERRIDDEN', 'SUCCESS', 'APPROVED'].includes(String(status || '').toUpperCase()); const bvn = verified(identityVerification?.bvnStatus); const nin = verified(identityVerification?.ninStatus); const tier = bvn && nin ? 'Tier 2 — BVN + NIN verified' : bvn || nin ? 'Tier 1 — one identity verified' : 'Basic profile — identity verification required'; return <><p><strong>Current tier:</strong> {tier}</p><p>BVN: {identityVerification?.bvnStatus || 'NOT_VERIFIED'} {identityVerification?.bvn ? '(' + identityVerification.bvn + ')' : ''}</p><p>NIN: {identityVerification?.ninStatus || 'NOT_VERIFIED'} {identityVerification?.nin ? '(' + identityVerification.nin + ')' : ''}</p><p>Tier 1 reference: single deposit ₦50,000; daily transfer ₦50,000; balance cap ₦300,000.</p><p>Tier 2 reference: single deposit ₦100,000; daily transfer ₦200,000; balance cap ₦500,000.</p><p>Tier 3 requires manual document review and approval before higher limits.</p><small>Identity numbers are masked. These are reference limits only; active caps must be enforced by backend policy. Loan approval is separate and requires credit assessment.</small></>; })()}
      </section>

      {message && <div style={{ margin: "16px 0", padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>{message}</div>}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <label>First Name<input name="firstName" value={form.firstName} onChange={handleChange} required /></label>
        <label>Middle Name<input name="middleName" value={form.middleName} onChange={handleChange} /></label>
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
