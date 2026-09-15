"use client";

import { useEffect, useState } from "react";
import { pwfbApi } from "../../lib/pwfb-api";

function moneyDate(value: string) { return new Date(value).toLocaleString(); }
function pretty(value: string) { return value.replaceAll("_", " "); }

export default function AuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextPage = page) {
    setLoading(true); setError("");
    try {
      const result: any = await pwfbApi.audit.list({ page: nextPage, limit: 25, search, role });
      setRows(Array.isArray(result) ? result : result?.data || []);
      setTotal(Number(result?.pagination?.total || 0));
      setPages(Math.max(1, Number(result?.pagination?.pages || 1)));
    } catch (e: any) { setError(e?.message || "Unable to load audit history."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(1); }, [role]);
  useEffect(() => { const t = setTimeout(() => load(1), 350); return () => clearTimeout(t); }, [search]);

  return <main style={{maxWidth:1200,margin:"0 auto",padding:"28px 18px 60px",color:"#17251e"}}>
    <style>{`.audit-card{background:#fff;border:1px solid #e4ebe7;border-radius:18px;box-shadow:0 8px 30px rgba(20,50,38,.06)}.audit-input{border:1px solid #d8e2dd;border-radius:10px;padding:11px 12px;background:#fff;outline:none}.audit-table{width:100%;border-collapse:collapse}.audit-table th,.audit-table td{padding:13px 14px;border-bottom:1px solid #edf1ef;text-align:left;vertical-align:top}.audit-table th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#718078;background:#f8faf9}.audit-pill{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800;background:#eef7f2;color:#17633f}.audit-fail{background:#fff0f0;color:#a33b3b}@media(max-width:760px){.audit-table{min-width:900px}.audit-scroll{overflow-x:auto}}`}</style>
    <section style={{borderRadius:24,padding:28,background:"linear-gradient(135deg,#063d2b,#0d6947)",color:"white"}}>
      <div style={{fontSize:12,fontWeight:800,letterSpacing:".14em",opacity:.75}}>SUPER ADMIN · COMPLIANCE</div>
      <h1 style={{fontSize:34,margin:"8px 0"}}>Audit & Compliance</h1>
      <p style={{maxWidth:760,lineHeight:1.6,opacity:.9,margin:0}}>Read-only history of authenticated financial and administrative changes across the PWFB platform. Sensitive request fields are automatically sanitized before storage.</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:20}}><span style={{padding:"8px 12px",borderRadius:999,background:"rgba(255,255,255,.12)",fontSize:12,fontWeight:700}}>🔐 Tamper-resistant append-only log</span><span style={{padding:"8px 12px",borderRadius:999,background:"rgba(255,255,255,.12)",fontSize:12,fontWeight:700}}>{total} recorded events</span></div>
    </section>
    <section className="audit-card" style={{marginTop:20,padding:18}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
        <input className="audit-input" style={{minWidth:250,flex:1}} placeholder="Search actor, action, resource or record ID" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="audit-input" value={role} onChange={e=>setRole(e.target.value)}><option value="">All roles</option><option>SUPER_ADMIN</option><option>ADMIN</option><option>AUDITOR</option><option>BRANCH_MANAGER</option><option>LOAN_OFFICER</option><option>TELLER</option><option>STAFF</option></select>
        <button className="audit-input" onClick={()=>load(page)} style={{cursor:"pointer",fontWeight:700}}>Refresh</button>
      </div>
      {error&&<div style={{marginTop:14,padding:12,borderRadius:10,background:"#fff1f1",color:"#a13a3a"}}>{error}</div>}
      <div className="audit-scroll" style={{marginTop:16}}>{loading?<div style={{padding:30}}>Loading audit history…</div>:<table className="audit-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Record</th><th>Status</th><th>Details</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan={7} style={{padding:35,textAlign:"center",color:"#718078"}}>No audit events found.</td></tr>:rows.map((row:any)=><tr key={row.id}><td>{moneyDate(row.createdAt)}</td><td><strong>{row.actorEmail||"System"}</strong><br/><small>{pretty(row.actorRole||"UNKNOWN")}</small></td><td><span className={`audit-pill ${String(row.action).includes("FAILED")?"audit-fail":""}`}>{pretty(row.action)}</span></td><td>{row.method} {row.resource}</td><td>{row.recordId||"—"}</td><td>{row.statusCode||"—"}</td><td><details><summary style={{cursor:"pointer"}}>View</summary><pre style={{whiteSpace:"pre-wrap",maxWidth:320,fontSize:11}}>{JSON.stringify(row.details||{},null,2)}</pre></details></td></tr>)}</tbody></table>}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,gap:10}}><span style={{fontSize:12,color:"#718078"}}>Page {page} of {pages}</span><div style={{display:"flex",gap:8}}><button disabled={page<=1} className="audit-input" onClick={()=>{setPage(page-1);load(page-1)}}>Previous</button><button disabled={page>=pages} className="audit-input" onClick={()=>{setPage(page+1);load(page+1)}}>Next</button></div></div>
    </section>
  </main>;
}
