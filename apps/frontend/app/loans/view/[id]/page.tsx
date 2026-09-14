'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
const money=(n:number)=>`₦${Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export default function ViewLoanPage(){
 const {id}=useParams();
 const [loan,setLoan]=useState<any>(null);
 const [repayments,setRepayments]=useState<any[]>([]);
 useEffect(()=>{
   const headers={Authorization:`Bearer ${localStorage.getItem('token')??''}`};
   Promise.all([
     fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans/${id}`,{headers}).then(r=>r.json()),
     fetch(`${process.env.NEXT_PUBLIC_API_URL}/repayments`,{headers}).then(r=>r.json()).catch(()=>[])
   ]).then(([raw,all])=>{
     const l=raw?.data&& !raw?.id?raw.data:raw;
     setLoan(l);
     const rows=Array.isArray(all)?all:Array.isArray(all?.data)?all.data:[];
     setRepayments(rows.filter((r:any)=>String(r.loanId)===String(id)));
   }).catch(console.error)
 },[id]);
 if(!loan)return <div className="p-6">Loading...</div>;
 const principal=Number(loan.amount||0);
 const interest=Number(loan.interestAmount??(principal*Number(loan.interestRate||0)/100));
 const total=Number(loan.totalRepayment??(principal+interest));
 const principalPaid=repayments.reduce((s,r)=>s+Number(r.principalPaid||0),0);
 const interestPaid=repayments.reduce((s,r)=>s+Number(r.interestPaid||0),0);
 const paid=repayments.reduce((s,r)=>s+Number(r.amount||0),0);
 const principalOutstanding=Math.max(0,principal-principalPaid);
 const interestOutstanding=Math.max(0,interest-interestPaid);
 const outstanding=Math.max(0,total-paid);
 const print=()=>window.print();
 return <main><style>{`@media print{body{background:#fff!important}.pwfb-loan-actions,.pwfb-sidebar,.pwfb-topbar{display:none!important}.pwfb-content{padding:0!important}.pwfb-panel{break-inside:avoid;box-shadow:none!important}}.loan-accounting-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.loan-accounting-item{border:1px solid #e3ebe6;border-radius:14px;padding:14px;background:#fff}.loan-accounting-item span{display:block;font-size:10px;text-transform:uppercase;font-weight:800;color:#718078}.loan-accounting-item strong{display:block;margin-top:5px;font-size:18px;color:#143b24}@media(max-width:760px){.loan-accounting-grid{grid-template-columns:1fr 1fr}}`}</style>
 <div className="pwfb-page-header pwfb-loan-actions"><div><p className="pwfb-eyebrow">LOAN DETAILS</p><h1 className="pwfb-page-title">Loan Details</h1><p className="pwfb-page-description">Complete loan history, calculations and principal/interest accounting.</p></div><div style={{display:'flex',gap:9,flexWrap:'wrap'}}><button type="button" onClick={print} className="pwfb-primary-button">🖨 Print Loan Receipt</button><Link href={`/loans/guarantor/add?loanId=${loan.id}`} className="pwfb-primary-button">+ Add Guarantor</Link></div></div>
 <section className="pwfb-stat-grid"><div className="pwfb-stat-card"><span>Principal</span><strong>{money(principal)}</strong></div><div className="pwfb-stat-card"><span>Interest ({Number(loan.interestRate||0).toFixed(2)}%)</span><strong>{money(interest)}</strong></div><div className="pwfb-stat-card pwfb-stat-orange"><span>Total repayment</span><strong>{money(total)}</strong></div><div className="pwfb-stat-card"><span>Total paid</span><strong>{money(paid)}</strong></div><div className="pwfb-stat-card"><span>Total outstanding</span><strong>{money(outstanding)}</strong></div></section>
 <section className="pwfb-panel" style={{maxWidth:1000}}><div className="pwfb-panel-header"><div><h2>Loan Accounting</h2><p>Every repayment is split explicitly between interest and principal.</p></div></div><div className="loan-accounting-grid"><div className="loan-accounting-item"><span>Principal paid</span><strong>{money(principalPaid)}</strong></div><div className="loan-accounting-item"><span>Interest paid</span><strong>{money(interestPaid)}</strong></div><div className="loan-accounting-item"><span>Principal outstanding</span><strong>{money(principalOutstanding)}</strong></div><div className="loan-accounting-item"><span>Interest outstanding</span><strong>{money(interestOutstanding)}</strong></div><div className="loan-accounting-item"><span>Total paid</span><strong>{money(paid)}</strong></div><div className="loan-accounting-item"><span>Total outstanding</span><strong>{money(outstanding)}</strong></div></div></section>
 <section className="pwfb-panel" style={{maxWidth:1000,marginTop:20}}><div className="pwfb-panel-header"><div><h2>Loan Registration</h2><p>All calculated values are retained for this loan and do not change when Admin changes future rates.</p></div></div><div className="space-y-3"><p><strong>Loan / Reference:</strong> {loan.id||id}</p><p><strong>Customer ID:</strong> {loan.customerId}</p><p><strong>Loan type:</strong> {loan.loanType||'Loan'}</p><p><strong>Principal:</strong> {money(principal)}</p><p><strong>Interest rate:</strong> {Number(loan.interestRate||0).toFixed(2)}%</p><p><strong>Interest amount:</strong> {money(interest)}</p><p><strong>Total repayment:</strong> {money(total)}</p><p><strong>Duration:</strong> {loan.duration||'—'} installments · {loan.repaymentFrequency||'—'}</p><p><strong>Installment:</strong> {money(loan.installmentAmount)}</p><p><strong>Purpose:</strong> {loan.purpose||'—'}</p><p><strong>Status:</strong> {loan.status||'Pending'}</p><p><strong>Created:</strong> {loan.createdAt?new Date(loan.createdAt).toLocaleString('en-NG'):'—'}</p></div></section>
 <section className="pwfb-panel" style={{maxWidth:1000,marginTop:20}}><div className="pwfb-panel-header"><div><h2>Repayment History</h2><p>Principal paid: {money(principalPaid)} · Interest paid: {money(interestPaid)} · Outstanding: {money(outstanding)}</p></div></div>{!repayments.length?<div className="pwfb-empty-state"><p>No repayments recorded.</p></div>:<div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Date</th><th>Total</th><th>Interest</th><th>Principal</th><th>Method</th><th>Notes</th></tr></thead><tbody>{repayments.map((r:any)=><tr key={r.id}><td>{new Date(r.paymentDate||r.createdAt).toLocaleString('en-NG')}</td><td><strong>{money(r.amount)}</strong></td><td>{money(r.interestPaid)}</td><td>{money(r.principalPaid)}</td><td>{r.method||'—'}</td><td>{r.notes||'—'}</td></tr>)}</tbody></table></div>}</section>
 <section className="pwfb-panel" style={{maxWidth:1000,marginTop:20}}><div className="pwfb-panel-header"><div><h2>Guarantors</h2><p>Temporary records only. No external identity verification has been performed.</p></div></div>{!loan.guarantors?.length?<div className="pwfb-empty-state"><p>No guarantor has been added to this loan.</p><Link href={`/loans/guarantor/add?loanId=${loan.id}`} className="pwfb-secondary-button">Add Guarantor</Link></div>:<div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Name</th><th>Phone</th><th>Relationship</th><th>ID</th><th>Status</th></tr></thead><tbody>{loan.guarantors.map((g:any)=><tr key={g.id}><td>{[g.firstName,g.middleName,g.lastName].filter(Boolean).join(' ')}</td><td>{g.phone}</td><td>{g.relationship||'—'}</td><td>{g.idType}: {g.idNumber}</td><td><span className="pwfb-status-badge">Temporary / Not verified</span></td></tr>)}</tbody></table></div>}</section></main>;
}
