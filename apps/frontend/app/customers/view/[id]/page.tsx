"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../../../lib/api";
import { pwfbApi } from "../../../../lib/pwfb-api";
import BankSearchSelect from "../../../../components/BankSearchSelect";

interface Customer {
  id: string; firstName: string; middleName?: string | null; lastName: string; email?: string; phone?: string; address?: string; dateOfBirth?: string; createdAt?: string; updatedAt?: string;
  branch?: { id: string; name: string } | null; assignedStaff?: { id: string; firstName: string; lastName: string } | null; clientGroup?: { id: string; name: string } | null;
  user?: { id: string; email: string; role: string; createdAt?: string } | null;
  bankAccounts?: Array<{ id: string; accountNumber: string; accountName?: string | null; status: string; isPrimary: boolean; institution?: { name: string; code?: string | null } | null }>;
  virtualAccounts?: Array<{ id: string; accountNumber?: string | null; accountName?: string | null; provider?: string | null; providerCustomerId?: string | null; providerReference?: string | null; status: string; institution?: { name: string } | null }>;
  wallet?: { balance: number; currency: string; status: string } | null;
  identityVerification?: { bvn?: string | null; bvnStatus?: string; bvnOverrideByEmail?: string; bvnOverrideReason?: string; nin?: string | null; ninStatus?: string; ninOverrideByEmail?: string; ninOverrideReason?: string } | null;
}

export default function ViewCustomerPage() {
  const { id } = useParams(); const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null); const [loading, setLoading] = useState(true); const [resetting, setResetting] = useState(false); const [temporaryPassword, setTemporaryPassword] = useState(""); const [message, setMessage] = useState("");
  const [photoPreview, setPhotoPreview] = useState(""); const photoInputRef = useRef<HTMLInputElement>(null); const cameraInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false); const [saving, setSaving] = useState(false); const [form, setForm] = useState({ firstName: "", middleName: "", lastName: "", email: "", phone: "", address: "", dateOfBirth: "" });
  const [identityType, setIdentityType] = useState<"BVN" | "NIN">("BVN"); const [identityValue, setIdentityValue] = useState(""); const [identityReason, setIdentityReason] = useState(""); const [overriding, setOverriding] = useState(false);
  const [verifyBvn, setVerifyBvn] = useState(""); const [verifyBankCode, setVerifyBankCode] = useState(""); const [verifyAccountNumber, setVerifyAccountNumber] = useState(""); const [verifyConsent, setVerifyConsent] = useState(false); const [verifyBanks, setVerifyBanks] = useState<Array<{ code: string; name: string; shortName?: string; provider?: string }>>([]); const [verifyingIdentity, setVerifyingIdentity] = useState(false);
  useEffect(() => { let alive = true; pwfbApi.banking.institutions().then((result: any) => { const list = Array.isArray(result) ? result : result?.data ?? []; if (alive) setVerifyBanks(list.filter((bank: any) => bank?.code && bank?.name).map((bank: any) => ({ code: String(bank.code), name: String(bank.name), shortName: bank.shortName, provider: bank.provider }))); }).catch(() => { if (alive) setVerifyBanks([]); }); return () => { alive = false; }; }, []);

  async function loadCustomer() { if (!id) return; setLoading(true); try { const data = await apiRequest(`/customers/${id}`); setCustomer(data); setForm({ firstName: data.firstName || "", middleName: data.middleName || "", lastName: data.lastName || "", email: data.email || "", phone: data.phone || "", address: data.address || "", dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : "" }); } catch { setCustomer(null); } finally { setLoading(false); } }
  useEffect(() => { loadCustomer(); }, [id]);
  useEffect(() => {
    if (!id || !customer?.virtualAccounts?.some((account) => account.status === "PENDING")) return;
    const timer = window.setInterval(async () => {
      try {
        const latest = await apiRequest(`/customers/${id}`);
        setCustomer(latest);
      } catch {
        // Keep the last known profile visible; the user can still reload manually.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [id, customer?.virtualAccounts?.map((account) => account.status + ":" + (account.accountNumber || "")).join("|")]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) { setMessage("Please choose an image file."); return; } if (file.size > 5 * 1024 * 1024) { setMessage("Image must be 5 MB or smaller."); return; } const reader = new FileReader(); reader.onload = () => setPhotoPreview(String(reader.result || "")); reader.readAsDataURL(file); setMessage("Image preview only. This customer profile API does not currently provide persistent photo storage, so the image has not been saved."); }
  function change(e: React.ChangeEvent<HTMLInputElement>) { setForm({ ...form, [e.target.name]: e.target.value }); }
  async function saveProfile(e: React.FormEvent) { e.preventDefault(); setSaving(true); setMessage(""); try { await apiRequest(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(form) }); setMessage("Customer profile updated successfully."); setEditing(false); await loadCustomer(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update customer"); } finally { setSaving(false); } }
  async function resetPassword() { if (!window.confirm("Reset this customer's login password? The current password cannot be recovered.")) return; setResetting(true); setMessage(""); try { const result = await apiRequest(`/customers/${id}/reset-password`, { method: "POST" }); setTemporaryPassword(result.temporaryPassword || ""); setMessage("Password reset successfully. Give the temporary password to the customer securely."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to reset password"); } finally { setResetting(false); } }
  async function verifyCustomerIdentity() {
    if (!/^\d{11}$/.test(verifyBvn.replace(/\D/g, "")) || !verifyBankCode || !/^\d{10}$/.test(verifyAccountNumber.replace(/\D/g, ""))) { setMessage("Enter an 11-digit BVN, select a bank, and enter a 10-digit account number."); return; }
    if (!verifyConsent) { setMessage("Confirm that the customer has expressly consented to Paystack identity validation and virtual-account assignment."); return; }
    setVerifyingIdentity(true); setMessage("");
    try {
      await apiRequest(`/customers/${encodeURIComponent(String(id))}/identity/verify`, { method: "POST", body: JSON.stringify({ bvn: verifyBvn.replace(/\D/g, ""), bankCode: verifyBankCode, accountNumber: verifyAccountNumber.replace(/\D/g, ""), consentConfirmed: true }) });
      setVerifyBvn(""); setVerifyAccountNumber(""); setMessage("Paystack identity verification has started. The virtual account will be assigned automatically after Paystack confirms the identity.");
      await loadCustomer();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start Paystack identity verification."); }
    finally { setVerifyingIdentity(false); }
  }
  async function overrideIdentity() { if (!identityValue.trim() || !identityReason.trim()) { setMessage("Enter the 11-digit identity number and a clear override reason."); return; } if (!window.confirm(`Record this as a Super Admin ${identityType} override? This action will be permanently audited.`)) return; setOverriding(true); setMessage(""); try { const result = await apiRequest(`/customers/${id}/identity-override`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: identityType, value: identityValue, reason: identityReason }) }); setMessage(`${identityType} override recorded. Status: ${result.status}.`); setIdentityValue(""); setIdentityReason(""); await loadCustomer(); } catch (error) { setMessage(error instanceof Error ? error.message : `Unable to override ${identityType}`); } finally { setOverriding(false); } }

  if (loading) return <main style={{ padding: 30 }}>Loading customer...</main>;
  if (!customer) return <main style={{ padding: 30 }}><h2>Customer not found.</h2><button onClick={() => router.push("/customers")}>Back</button></main>;
  const identity = customer.identityVerification;
  const fullName = [customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(" ");

  return <main className="customer-profile-page" style={{ padding: 30, fontFamily: "Arial", maxWidth: 1180, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div className="profile-title"><p className="pwfb-eyebrow">SUPER ADMIN • CUSTOMER PROFILE</p><h1>Customer Profile</h1><p>{fullName} <span className="profile-id">• {customer.id}</span></p></div>
      <div className="profile-actions"><Link href={`/transactions?customerId=${encodeURIComponent(String(id))}`} style={{ display: "inline-flex", alignItems: "center", padding: "9px 12px", border: "1px solid #b7dfc5", borderRadius: 8, color: "#126b35", fontWeight: 700, textDecoration: "none" }}>View Client History</Link><button onClick={() => setEditing((value) => !value)}>{editing ? "Cancel Edit" : "Edit Profile"}</button><button onClick={resetPassword} disabled={resetting}>{resetting ? "Resetting..." : "Reset Password"}</button><button onClick={() => router.push("/customers")}>Back</button></div>
    </div>

    <section className="customer-photo-card">
      <div className="customer-photo-avatar">
        {photoPreview ? <img src={photoPreview} alt="Selected customer photo preview" /> : <div className="customer-photo-initials">{[customer.firstName?.[0], customer.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "CU"}</div>}
      </div>
      <div className="customer-photo-details">
        <span className="customer-photo-kicker">CUSTOMER IDENTITY</span>
        <h2>{fullName}</h2>
        <p>{customer.email || "No email recorded"}{customer.phone ? " · " + customer.phone : ""}</p>
        <div className="customer-photo-buttons">
          <button type="button" onClick={() => photoInputRef.current?.click()}>Upload photo</button>
          <button type="button" className="camera-button" onClick={() => cameraInputRef.current?.click()}>Use camera</button>
          {photoPreview && <button type="button" className="camera-button" onClick={() => { setPhotoPreview(""); if (photoInputRef.current) photoInputRef.current.value = ""; if (cameraInputRef.current) cameraInputRef.current.value = ""; }}>Remove preview</button>}
        </div>
        <small>Choose JPG, PNG or WebP · Maximum 5 MB. Camera access depends on your device/browser. Preview is not saved to the customer record.</small>
      </div>
      <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handlePhotoSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" hidden onChange={handlePhotoSelect} />
    </section>
    {message && <div style={{ margin: "16px 0", padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>{message}</div>}
    {temporaryPassword && <div style={{ margin: "16px 0", padding: 16, border: "1px solid #ccc", borderRadius: 8 }}><strong>Temporary password:</strong> {temporaryPassword}<br /><small>This is shown once. PWFB does not display the customer's previous plaintext password.</small></div>}

    {editing && <section style={{ marginTop: 20, padding: 20, border: "1px solid #ddd", borderRadius: 12 }}><h2>Edit customer profile</h2><p>Correct the customer's complete legal name and profile details.</p><form onSubmit={saveProfile} style={{ display: "grid", gap: 12 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}><input name="firstName" placeholder="First Name" value={form.firstName} onChange={change} required /><input name="middleName" placeholder="Middle Name" value={form.middleName} onChange={change} /><input name="lastName" placeholder="Last Name" value={form.lastName} onChange={change} required /></div><input name="email" type="email" placeholder="Email" value={form.email} onChange={change} /><input name="phone" placeholder="Phone" value={form.phone} onChange={change} /><input name="address" placeholder="Address" value={form.address} onChange={change} /><label>Date of Birth<input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={change} /></label><button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile Changes"}</button></form></section>}

    <section style={{ marginTop: 24, padding: 20, border: "1px solid #ddd", borderRadius: 12 }}><h2>Customer KYC Tier & Limits</h2>{(() => { const verified = (status?: string) => ["VERIFIED", "OVERRIDDEN", "SUCCESS", "APPROVED"].includes(String(status || "").toUpperCase()); const bvn = verified(identity?.bvnStatus); const nin = verified(identity?.ninStatus); const tier = bvn && nin ? 2 : bvn || nin ? 1 : 0; const label = tier === 2 ? "Tier 2 — BVN + NIN verified" : tier === 1 ? "Tier 1 — one identity verified" : "Basic profile — identity verification required"; return <><p><strong>Current status:</strong> {label}</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}><div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}><strong>Tier 1 benchmark</strong><p>Single deposit: ₦50,000</p><p>Daily transfers: ₦50,000</p><p>Balance cap: ₦300,000</p><small>Subject to approved PWFB policy.</small></div><div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}><strong>Tier 2 benchmark</strong><p>Single deposit: ₦100,000</p><p>Daily transfers: ₦200,000</p><p>Balance cap: ₦500,000</p><small>Requires both BVN and NIN verified.</small></div><div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}><strong>Tier 3 — manual review</strong><p>Higher limits only after document review and approval.</p><small>Valid government ID and recent proof of address required.</small></div></div><p><strong>Loan eligibility:</strong> assessed separately through credit and affordability checks; KYC tier alone does not approve a loan.</p><p style={{ color: "#666", fontSize: 12 }}>These are reference benchmarks, not confirmation of active transaction caps. Actual limits must be configured and enforced by PWFB's backend policy.</p></>; })()}</section>

    <section style={{ marginTop: 24 }}><h2>Personal information</h2><p><strong>First name:</strong> {customer.firstName}</p><p><strong>Middle name:</strong> {customer.middleName || "—"}</p><p><strong>Last name:</strong> {customer.lastName}</p><p><strong>Full name:</strong> {fullName}</p><p><strong>Email:</strong> {customer.email || "—"}</p><p><strong>Phone:</strong> {customer.phone || "—"}</p><p><strong>Address:</strong> {customer.address || "—"}</p><p><strong>Date of birth:</strong> {customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString() : "—"}</p></section>

    <section style={{ marginTop: 24, padding: 20, border: "1px solid #ddd", borderRadius: 12 }}><h2>Identity Verification</h2><p style={{ color: "#555" }}>Provider verification and Super Admin overrides are recorded separately. Identity numbers are masked in the profile.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}><div style={{ padding: 16, border: "1px solid #eee", borderRadius: 10 }}><strong>BVN</strong><p>{identity?.bvn || "Not provided"}</p><p>Status: <strong>{identity?.bvnStatus || "NOT_VERIFIED"}</strong></p>{identity?.bvnOverrideByEmail && <small>Override by {identity.bvnOverrideByEmail}<br />Reason: {identity.bvnOverrideReason}</small>}</div><div style={{ padding: 16, border: "1px solid #eee", borderRadius: 10 }}><strong>NIN</strong><p>{identity?.nin || "Not provided"}</p><p>Status: <strong>{identity?.ninStatus || "NOT_VERIFIED"}</strong></p>{identity?.ninOverrideByEmail && <small>Override by {identity.ninOverrideByEmail}<br />Reason: {identity.ninOverrideReason}</small>}</div></div><div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #eee" }}><h3>Paystack identity verification</h3><p>Use the customer's BVN and verified bank account to start provider identity validation. BVN is stored only in the restricted identity record and is not shown in the virtual-account display.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 10 }}><label style={{ display: "grid", gap: 6 }}>BVN<input type="password" autoComplete="off" inputMode="numeric" maxLength={11} value={verifyBvn} onChange={(e) => setVerifyBvn(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="11-digit BVN" style={{ padding: 10 }} /></label><div><label style={{ display: "block", marginBottom: 6 }}>Bank</label><BankSearchSelect banks={verifyBanks} value={verifyBankCode} onChange={setVerifyBankCode} disabled={verifyingIdentity} /></div><label style={{ display: "grid", gap: 6 }}>Account number<input inputMode="numeric" autoComplete="off" maxLength={10} value={verifyAccountNumber} onChange={(e) => setVerifyAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit account number" style={{ padding: 10 }} /></label></div><label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, lineHeight: 1.5 }}><input type="checkbox" checked={verifyConsent} onChange={(e) => setVerifyConsent(e.target.checked)} style={{ marginTop: 4 }} /><span>I confirm the customer has expressly consented to PWFB sharing their BVN and bank-account details with Paystack for identity validation and dedicated virtual-account creation.</span></label><button type="button" onClick={verifyCustomerIdentity} disabled={verifyingIdentity || !verifyConsent} style={{ marginTop: 10 }}>{verifyingIdentity ? "Submitting to Paystack..." : "Verify identity and assign DVA"}</button></div>
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #eee" }}><h3>Super Admin Override</h3><p>Use only for approved corrections. Every override is permanently audited.</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}><button type="button" onClick={() => setIdentityType("BVN")} disabled={identityType === "BVN"}>Override BVN</button><button type="button" onClick={() => setIdentityType("NIN")} disabled={identityType === "NIN"}>Override NIN</button></div><input value={identityValue} onChange={(e) => setIdentityValue(e.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="numeric" maxLength={11} placeholder={`${identityType} (11 digits)`} style={{ width: "100%", padding: 10, marginBottom: 8 }} /><textarea value={identityReason} onChange={(e) => setIdentityReason(e.target.value)} placeholder={`Reason for ${identityType} override`} rows={3} style={{ width: "100%", padding: 10, marginBottom: 8 }} /><button onClick={overrideIdentity} disabled={overriding}>{overriding ? "Saving override..." : `Save ${identityType} Override`}</button></div></section>

    <section style={{ marginTop: 24 }}><h2>Account & assignment</h2><p><strong>Login email:</strong> {customer.user?.email || customer.email || "—"}</p><p><strong>Role:</strong> {customer.user?.role || "CUSTOMER"}</p><p><strong>Branch:</strong> {customer.branch?.name || "—"}</p><p><strong>Assigned staff:</strong> {customer.assignedStaff ? `${customer.assignedStaff.firstName} ${customer.assignedStaff.lastName}` : "—"}</p><p><strong>Group:</strong> {customer.clientGroup?.name || "—"}</p><p><strong>Registered:</strong> {customer.createdAt ? new Date(customer.createdAt).toLocaleString() : "—"}</p><p><strong>Last updated:</strong> {customer.updatedAt ? new Date(customer.updatedAt).toLocaleString() : "—"}</p></section>
    <section style={{ marginTop: 24 }}><h2>Wallet</h2><p><strong>Balance:</strong> {customer.wallet ? `${customer.wallet.currency} ${customer.wallet.balance.toLocaleString()}` : "No wallet"}</p><p><strong>Status:</strong> {customer.wallet?.status || "—"}</p></section>
    <section style={{ marginTop: 24 }}><h2>Registered bank accounts</h2>{customer.bankAccounts?.length ? customer.bankAccounts.map((account) => <div key={account.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 8 }}><strong>{account.institution?.name || "Bank"}</strong> — {account.accountNumber}<br />Name: {account.accountName || "—"} • Status: {account.status}{account.isPrimary ? " • Primary" : ""}</div>) : <p>No bank account registered.</p>}</section>
    <section style={{ marginTop: 24 }}><h2>Virtual accounts</h2>{customer.virtualAccounts?.length ? customer.virtualAccounts.map((account) => <div key={account.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 8 }}><strong>{account.institution?.name || account.provider || "Provider"}</strong><br />Account number: {account.accountNumber || "Not generated"}<br />Account name: {account.accountName || "—"}<br />Provider: {account.provider || "—"} • Status: {account.status}</div>) : <p>No virtual account record.</p>}</section>
    <style jsx>{`.customer-profile-page{color:#172033}.profile-title h1{margin:4px 0 8px;font-size:clamp(26px,3vw,34px);letter-spacing:-.7px}.profile-title>p:last-child{color:#475467;margin:0;overflow-wrap:anywhere}.profile-id{color:#667085;font-size:12px}.profile-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.profile-actions :global(a),.profile-actions :global(button){display:inline-flex;justify-content:center;align-items:center;min-height:40px;padding:9px 13px;border-radius:9px;border:1px solid #d0d5dd;background:#fff;color:#344054;font-size:13px;font-weight:750;text-decoration:none;cursor:pointer}.profile-actions :global(a:first-child){background:#fff7ed;border-color:#fed7aa;color:#9a3412}.profile-actions :global(button:first-of-type){background:#f97316;color:#fff;border-color:#f97316}.customer-profile-page section{border-color:#e4e7ec!important;border-radius:15px!important;box-shadow:0 4px 14px #10182808}.customer-profile-page h2{font-size:19px}.customer-profile-page section p{line-height:1.55}.customer-profile-page input,.customer-profile-page textarea{max-width:100%;border:1px solid #d0d5dd;border-radius:8px;padding:10px}.customer-profile-page button{cursor:pointer;border-radius:8px}.customer-profile-page button:hover{filter:brightness(.97)}@media(max-width:640px){.customer-profile-page{padding:16px!important}.profile-actions{width:100%}.profile-actions :global(a),.profile-actions :global(button){flex:1}}`}</style>
    <style jsx>{`
      .customer-photo-card{display:flex;align-items:center;gap:24px;margin:26px 0 20px;padding:26px;border:1px solid #fed7aa;border-radius:20px;background:linear-gradient(115deg,#fff7ed,#fff 68%);box-shadow:0 10px 28px rgba(16,24,40,.07)}
      .customer-photo-avatar{width:132px;height:132px;flex:0 0 132px;display:grid;place-items:center;overflow:hidden;border-radius:50%;border:5px solid white;background:#ffedd5;box-shadow:0 0 0 1px #fdba74,0 8px 20px #9a34121a}
      .customer-photo-avatar img{width:100%;height:100%;object-fit:cover}
      .customer-photo-initials{display:grid;place-items:center;width:100%;height:100%;font-size:40px;font-weight:850;color:#c2410c}
      .customer-photo-details{min-width:0;flex:1}
      .customer-photo-kicker{font-size:11px;letter-spacing:1.4px;font-weight:850;color:#c2410c}
      .customer-photo-details h2{font-size:25px;margin:7px 0;color:#172033}
      .customer-photo-details p{color:#667085;margin:0 0 14px;overflow-wrap:anywhere}
      .customer-photo-buttons{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:10px}
      .customer-photo-buttons button{min-height:40px;border:1px solid #f97316;border-radius:9px;background:#f97316;color:white;padding:10px 15px;font-weight:800;cursor:pointer}
      .customer-photo-buttons button.camera-button{background:white;border-color:#d0d5dd;color:#344054}
      .customer-photo-details small{display:block;color:#667085;line-height:1.5}
      @media(max-width:640px){.customer-photo-card{flex-direction:column;align-items:flex-start;padding:20px}.customer-photo-avatar{width:104px;height:104px;flex-basis:104px}.customer-photo-details h2{font-size:22px}.customer-photo-buttons button{flex:1}}
    `}</style>
  </main>;
}
