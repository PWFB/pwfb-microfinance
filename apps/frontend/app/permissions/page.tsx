"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";

const permissionLabels: Record<string, string> = {
  WALLET_DEPOSIT: "Wallet deposits",
  WALLET_WITHDRAWAL: "Wallet withdrawals",
};

export default function PermissionsPage() {
  const [rows, setRows] = useState<Array<{ role: string; permissions: Record<string, boolean> }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const data = await apiRequest("/permissions/wallet");
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Unable to load permissions.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function toggle(role: string, permission: string, enabled: boolean) {
    const key = `${role}:${permission}`;
    setSaving(key); setError("");
    setRows(current => current.map(row => row.role === role ? { ...row, permissions: { ...row.permissions, [permission]: enabled } } : row));
    try {
      await apiRequest("/permissions/wallet", { method: "PATCH", body: JSON.stringify({ role, permission, enabled }) });
    } catch (e: any) {
      setError(e?.message || "Permission update failed.");
      await load();
    } finally { setSaving(null); }
  }

  const permissionKeys = useMemo(() => Object.keys(permissionLabels), []);

  return (
    <main className="pwfb-permissions-page">
      <style>{`
        .pwfb-permissions-page{max-width:1180px;margin:0 auto;padding:28px 24px 60px;color:#17251e}.perm-hero{border-radius:24px;padding:30px;background:linear-gradient(135deg,#063d2b,#0d6947);color:#fff;box-shadow:0 18px 45px rgba(6,61,43,.16)}.perm-hero .eyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;opacity:.75}.perm-hero h1{margin:8px 0;font-size:34px}.perm-hero p{max-width:700px;margin:0;line-height:1.6;opacity:.88}.perm-badge{display:inline-flex;margin-top:20px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.12);font-size:12px;font-weight:700}.perm-panel{margin-top:22px;background:#fff;border:1px solid #e4ebe7;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(20,50,38,.06)}.perm-head{padding:20px 22px;border-bottom:1px solid #e9efec;display:flex;justify-content:space-between;gap:15px;align-items:center}.perm-head h2{margin:0;font-size:19px}.perm-head p{margin:5px 0 0;color:#718078;font-size:13px}.perm-table{width:100%;border-collapse:collapse}.perm-table th,.perm-table td{padding:15px 18px;text-align:left;border-bottom:1px solid #edf1ef}.perm-table th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#718078;background:#f8faf9}.role{font-weight:800}.role-sub{display:block;color:#8a9790;font-size:11px;margin-top:3px}.switch{width:46px;height:26px;border:0;border-radius:99px;padding:3px;cursor:pointer;background:#cbd5d0;transition:.2s}.switch.on{background:#f28c28}.knob{display:block;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px #0002}.switch.on .knob{transform:translateX(20px)}.saving{font-size:10px;color:#f28c28;margin-left:7px}.perm-note{margin-top:18px;padding:16px 18px;border-radius:14px;background:#fff8ef;border:1px solid #f6dfc3;color:#6d5438;font-size:13px;line-height:1.55}.perm-error{margin-top:15px;padding:12px 14px;border-radius:12px;background:#fff1f1;color:#a13a3a;font-size:13px}@media(max-width:700px){.pwfb-permissions-page{padding:18px 12px}.perm-hero h1{font-size:28px}.perm-table{min-width:620px}.perm-panel{overflow-x:auto}.perm-head{position:sticky;left:0}}
      `}</style>
      <section className="perm-hero">
        <div className="eyebrow">SUPER ADMIN · ACCESS CONTROL</div>
        <h1>Permissions</h1>
        <p>Control sensitive wallet operations by staff role. Changes are saved to the platform permission store and protected by administrator access.</p>
        <span className="perm-badge">🔐 Role-based financial controls</span>
      </section>
      <section className="perm-panel">
        <div className="perm-head"><div><h2>Role Permission Matrix</h2><p>Enable or disable wallet actions for each role.</p></div><strong>{rows.length} roles</strong></div>
        {loading ? <div style={{padding:28}}>Loading permission matrix…</div> : <table className="perm-table"><thead><tr><th>Role</th>{permissionKeys.map(key => <th key={key}>{permissionLabels[key]}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.role}><td><span className="role">{row.role.replaceAll("_", " ")}</span><span className="role-sub">System role</span></td>{permissionKeys.map(permission => { const enabled=Boolean(row.permissions?.[permission]); const key=`${row.role}:${permission}`; return <td key={permission}><button className={`switch ${enabled ? "on" : ""}`} aria-label={`${enabled ? "Disable" : "Enable"} ${permissionLabels[permission]} for ${row.role}`} onClick={() => toggle(row.role, permission, !enabled)} disabled={saving===key}><span className="knob" /></button>{saving===key && <span className="saving">Saving</span>}</td> })}</tr>)}</tbody></table>}
      </section>
      <div className="perm-note"><strong>Financial safety:</strong> permission changes affect access to wallet operations. Keep withdrawal access limited to authorized roles and review changes before production use.</div>
      {error && <div className="perm-error">{error}</div>}
    </main>
  );
}
