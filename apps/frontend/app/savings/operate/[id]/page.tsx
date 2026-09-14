"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api";

type Savings = { id: string; customerId: string; amount: number; accountType?: string; status?: string };
const money = (n:number) => `₦${Number(n||0).toLocaleString("en-NG", {minimumFractionDigits:2, maximumFractionDigits:2})}`;

export default function SavingsOperatePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");
  const [account, setAccount] = useState<Savings | null>(null);
  const [operation, setOperation] = useState<"deposit"|"withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { const d = await apiRequest(`/savings/${id}`); setAccount((d?.data ?? d) as Savings); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load savings account."); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (id) load(); }, [id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter an amount greater than zero.");
      const path = operation === "deposit" ? `/savings/${id}/deposit` : `/savings/${id}/withdraw`;
      const d = await apiRequest(path, { method: "POST", body: JSON.stringify({ amount: value, description: description.trim() || undefined }) });
      const updated = d?.data ?? d;
      if (updated?.amount !== undefined) setAccount(updated);
      setSuccess(`${operation === "deposit" ? "Deposit" : "Withdrawal"} completed successfully.`);
      setAmount(""); setDescription("");
    } catch (e) { setError(e instanceof Error ? e.message : "Operation failed."); }
    finally { setSaving(false); }
  };

  if (loading) return <main style={{maxWidth:900,margin:"auto",padding:"30px"}}>Loading savings account…</main>;
  if (!account) return <main style={{maxWidth:900,margin:"auto",padding:"30px"}}><div style={{background:"#fff1ee",padding:16,borderRadius:12,color:"#9b3525"}}>{error || "Savings account not found."}</div></main>;

  return <main style={{maxWidth:900,margin:"auto",padding:"8px 0 50px"}}>
    <style>{`.op-hero{background:linear-gradient(135deg,#075b2a,#13813d);color:#fff;border-radius:24px;padding:26px;margin-bottom:16px}.op-hero h1{margin:6px 0}.op-hero p{margin:0;color:#d9eee0}.op-card{background:#fff;border:1px solid #e1e9e4;border-radius:20px;overflow:hidden}.op-body{padding:22px;display:grid;gap:18px}.op-tabs{display:grid;grid-template-columns:1fr 1fr;gap:10px}.op-tab{height:48px;border-radius:11px;border:1px solid #d5e1d9;background:#fff;font-weight:850;cursor:pointer}.op-tab.active{background:#0b7136;color:#fff;border-color:#0b7136}.op-balance{background:#f5faf7;border:1px solid #dcebe1;border-radius:16px;padding:18px}.op-balance small{display:block;color:#708078;font-size:10px;font-weight:850;text-transform:uppercase}.op-balance strong{display:block;color:#123b23;font-size:30px;margin-top:5px}.op-field{display:grid;gap:7px}.op-field span{font-size:10px;font-weight:850;color:#526158;text-transform:uppercase}.op-field input,.op-field textarea{border:1px solid #d3dfd7;border-radius:11px;padding:12px;background:#fff;font:inherit}.op-field input{height:49px;box-sizing:border-box}.op-actions{display:flex;gap:10px;justify-content:flex-end;border-top:1px solid #e7eee9;padding-top:18px}.op-btn{height:45px;border-radius:10px;padding:0 17px;border:0;font-weight:850;cursor:pointer}.op-primary{background:#0b7136;color:#fff}.op-secondary{background:#fff;color:#0b7136;border:1px solid #cfe0d5}.op-error{background:#fff1ee;color:#a43b25;padding:12px;border-radius:10px;font-size:12px}.op-success{background:#eaf8ef;color:#176b3b;padding:12px;border-radius:10px;font-size:12px}@media(max-width:600px){.op-body{padding:17px}.op-actions{flex-direction:column}.op-btn{width:100%}}`}</style>
    <section className="op-hero"><div style={{color:"#ffb14b",fontSize:10,fontWeight:900,letterSpacing:".12em"}}>SAVINGS OPERATIONS</div><h1>Deposit & Withdrawal</h1><p>{account.customerId} · {account.accountType || "Regular Savings"}</p></section>
    <section className="op-card"><form className="op-body" onSubmit={submit}>
      <div className="op-balance"><small>Current Savings Balance</small><strong>{money(account.amount)}</strong></div>
      <div className="op-tabs"><button type="button" className={`op-tab ${operation === "deposit" ? "active" : ""}`} onClick={()=>{setOperation("deposit");setError("");setSuccess("")}}>Deposit</button><button type="button" className={`op-tab ${operation === "withdraw" ? "active" : ""}`} onClick={()=>{setOperation("withdraw");setError("");setSuccess("")}}>Withdraw</button></div>
      {error && <div className="op-error">{error}</div>}{success && <div className="op-success">{success}</div>}
      <label className="op-field"><span>{operation === "deposit" ? "Deposit Amount" : "Withdrawal Amount"}</span><input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" required/></label>
      <label className="op-field"><span>Description / Reference</span><textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Optional operation description"/></label>
      <div className="op-actions"><button type="button" className="op-btn op-secondary" onClick={()=>router.push(`/savings/view/${id}`)} disabled={saving}>Back to Account</button><button className="op-btn op-primary" disabled={saving}>{saving ? "Processing…" : operation === "deposit" ? "Confirm Deposit" : "Confirm Withdrawal"}</button></div>
    </form></section>
  </main>;
}
