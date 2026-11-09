"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../lib/api";

type ProfileRecord = {
  id?: string; staffId?: string; firstName?: string; middleName?: string; lastName?: string;
  email?: string; phone?: string; role?: string; position?: string; employmentStatus?: string;
  createdAt?: string; updatedAt?: string; branch?: { id?: string; name?: string };
  department?: { name?: string }; region?: { name?: string }; division?: { name?: string };
  area?: { name?: string }; assignedStaff?: { staffId?: string; firstName?: string; lastName?: string };
  clientGroup?: { name?: string }; groupId?: string; branchId?: string; address?: string;
  dateOfBirth?: string; wallet?: { balance?: number; status?: string };
  identityVerification?: {
    bvn?: string | null; bvnStatus?: string; bvnProvider?: string;
    nin?: string | null; ninStatus?: string; ninProvider?: string;
  } | null;
};

const value = (v: unknown) => v === null || v === undefined || v === "" ? "Not provided" : String(v);
const dateValue = (v?: string) => v ? new Date(v).toLocaleString("en-NG") : "Not available";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [identityType, setIdentityType] = useState<"BVN" | "NIN">("BVN");
  const [identityValue, setIdentityValue] = useState("");
  const [identityConsent, setIdentityConsent] = useState(false);
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityMessage, setIdentityMessage] = useState("");

  const role = String(user?.role || "").toUpperCase();
  const isCustomer = role === "CUSTOMER";
  const displayName = useMemo(() => [profile?.firstName || user?.firstName, profile?.middleName, profile?.lastName || user?.lastName].filter(Boolean).join(" ") || "LAB User", [profile, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/"); return; }
    let active = true;
    (async () => {
      setProfileLoading(true);
      setProfileError("");
      try {
        const result = await apiRequest(isCustomer ? "/customers/me" : "/staff/me");
        const record = result?.data ?? result?.profile ?? result?.customer ?? result;
        if (active) setProfile(record);
      } catch (error) {
        if (active) setProfileError(error instanceof Error ? error.message : "Profile details are not available.");
      } finally {
        if (active) setProfileLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loading, user, isCustomer, router]);

  async function verifyMyIdentity() {
    const normalized = identityValue.replace(/\D/g, "");
    if (!/^\d{11}$/.test(normalized)) {
      setIdentityMessage(`${identityType} must contain exactly 11 digits.`);
      return;
    }
    if (!identityConsent) {
      setIdentityMessage("Please confirm your consent before submitting your identity number.");
      return;
    }
    setIdentityBusy(true);
    setIdentityMessage("");
    try {
      const result = await apiRequest(`/customers/me/identity/verify/${identityType}`, {
        method: "POST",
        body: JSON.stringify({ value: normalized, consentConfirmed: true }),
      });
      setIdentityValue("");
      setIdentityConsent(false);
      setIdentityMessage(result?.status === "VERIFIED"
        ? `${identityType} verification succeeded. Your profile stores a masked number only.`
        : `${identityType} was checked but did not pass the customer record match. Status: ${result?.status || "NOT_VERIFIED"}. Please contact LAB Microfinance to review your legal profile details.`);
      const refreshed = await apiRequest("/customers/me");
      const record = refreshed?.data ?? refreshed?.profile ?? refreshed?.customer ?? refreshed;
      setProfile(record);
    } catch (error) {
      setIdentityMessage(error instanceof Error ? error.message : `Unable to verify ${identityType}.`);
    } finally {
      setIdentityBusy(false);
    }
  }

  const rows: [string, string][] = isCustomer ? [
    ["Customer ID", value(profile?.id)],
    ["Full name", displayName],
    ["Email", value(profile?.email || user?.email)],
    ["Phone", value(profile?.phone || user?.phone)],
    ["Role", "Customer"],
    ["Branch", value(profile?.branch?.name)],
    ["Assigned staff", profile?.assignedStaff ? [profile.assignedStaff.staffId, profile.assignedStaff.firstName, profile.assignedStaff.lastName].filter(Boolean).join(" · ") : "Not assigned"],
    ["Group", value(profile?.clientGroup?.name)],
    ["Address", value(profile?.address)],
    ["Registered", dateValue(profile?.createdAt)],
    ["Last updated", dateValue(profile?.updatedAt)],
  ] : [
    ["Staff ID", value(profile?.staffId)],
    ["Full name", displayName],
    ["Email", value(profile?.email || user?.email)],
    ["Phone", value(profile?.phone || user?.phone)],
    ["Role", value(role.replaceAll("_", " "))],
    ["Position", value(profile?.position)],
    ["Department", value(profile?.department?.name)],
    ["Branch", value(profile?.branch?.name)],
    ["Area", value(profile?.area?.name)],
    ["Division", value(profile?.division?.name)],
    ["Region", value(profile?.region?.name)],
    ["Employment status", value(profile?.employmentStatus)],
    ["Registered", dateValue(profile?.createdAt)],
    ["Last updated", dateValue(profile?.updatedAt)],
  ];

  if (loading || !user) return <main className="min-h-screen bg-slate-50 p-6"><p className="text-lg font-semibold text-emerald-800">Checking your account...</p></main>;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <Link href={isCustomer ? "/customer-dashboard" : "/dashboard"} className="text-base font-bold text-emerald-800">← Back to {isCustomer ? "Customer Dashboard" : "Dashboard"}</Link>
        <header className="mt-5 rounded-3xl bg-emerald-900 p-7 sm:p-9 text-white shadow-sm">
          <div className="flex items-center gap-4 sm:gap-6">
            <img src="/pwfb-app-icon.svg" alt="LAB MICROFINANCE logo" className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white p-2" />
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-amber-200">LAB MICROFINANCE</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">My Profile</h1>
              <p className="mt-2 text-base sm:text-lg text-emerald-100">{displayName}</p>
            </div>
          </div>
        </header>
        {profileError && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Some linked profile details could not be loaded: {profileError}. Basic account details are still shown where available.</div>}
        {isCustomer && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Identity verification</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Verify your BVN or NIN against the configured identity provider. Your clear consent is required. LAB Microfinance stores only a masked number and the verification outcome, not provider photos.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-3">
                <p className="text-sm font-semibold text-slate-700">BVN</p>
                <p className="mt-1 text-sm text-slate-900">{value(profile?.identityVerification?.bvn)}</p>
                <p className="mt-1 text-xs text-slate-600">Status: {profile?.identityVerification?.bvnStatus || "NOT_VERIFIED"}</p>
                {profile?.identityVerification?.bvnProvider && <p className="text-xs text-slate-500">Provider: {profile.identityVerification.bvnProvider}</p>}
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <p className="text-sm font-semibold text-slate-700">NIN</p>
                <p className="mt-1 text-sm text-slate-900">{value(profile?.identityVerification?.nin)}</p>
                <p className="mt-1 text-xs text-slate-600">Status: {profile?.identityVerification?.ninStatus || "NOT_VERIFIED"}</p>
                {profile?.identityVerification?.ninProvider && <p className="text-xs text-slate-500">Provider: {profile.identityVerification.ninProvider}</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setIdentityType("BVN"); setIdentityValue(""); }} disabled={identityBusy || identityType === "BVN"} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Verify BVN</button>
              <button type="button" onClick={() => { setIdentityType("NIN"); setIdentityValue(""); }} disabled={identityBusy || identityType === "NIN"} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Verify NIN</button>
            </div>
            <label className="mt-3 grid max-w-md gap-2 text-sm font-medium text-slate-700">
              {identityType}
              <input type="password" autoComplete="off" inputMode="numeric" maxLength={11} value={identityValue} onChange={(event) => setIdentityValue(event.target.value.replace(/\D/g, "").slice(0, 11))} placeholder={`Enter your 11-digit ${identityType}`} className="rounded-lg border border-slate-300 px-3 py-3 text-base" />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-700">
              <input type="checkbox" checked={identityConsent} onChange={(event) => setIdentityConsent(event.target.checked)} className="mt-1" />
              <span>I consent to LAB Microfinance submitting this {identityType} to its configured identity-verification provider for checking against my legal name and date of birth.</span>
            </label>
            <button type="button" onClick={verifyMyIdentity} disabled={identityBusy || !identityConsent} className="mt-3 rounded-lg bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {identityBusy ? "Verifying..." : `Verify ${identityType}`}
            </button>
            {identityMessage && <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{identityMessage}</p>}
          </section>
        )}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {rows.map(([label, item]) => (
            <div key={label} className="grid gap-2 border-b border-slate-100 p-5 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-5 sm:p-6">
              <span className="text-base font-medium text-slate-600">{label}</span>
              <span className="break-all text-base sm:text-lg font-semibold text-slate-900">{item}</span>
            </div>
          ))}
        </section>
        {profileLoading && <p className="mt-4 text-sm text-slate-500">Loading complete profile details…</p>}
        <p className="mt-5 text-base leading-7 text-slate-600">This is a view-only profile. Profile and financial records cannot be changed from this page. Contact an authorized LAB MICROFINANCE administrator for an approved correction.</p>
      </div>
    </main>
  );
}
