'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ViewLoanPage() {
  const { id } = useParams();
  const [loan, setLoan] = useState<any>(null);
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } })
      .then((res) => res.json()).then(setLoan).catch(console.error);
  }, [id]);
  if (!loan) return <div className="p-6">Loading...</div>;
  return <main>
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">LOAN DETAILS</p><h1 className="pwfb-page-title">Loan Details</h1><p className="pwfb-page-description">Review the loan and its temporary guarantor records.</p></div><Link href={`/loans/guarantor/add?loanId=${loan.id}`} className="pwfb-primary-button">+ Add Guarantor</Link></div>
    <section className="pwfb-panel" style={{ maxWidth: 900 }}><div className="space-y-3"><p><strong>Customer ID:</strong> {loan.customerId}</p><p><strong>Amount:</strong> ₦{Number(loan.amount || 0).toLocaleString()}</p><p><strong>Interest Rate:</strong> {loan.interestRate ?? '-'}%</p><p><strong>Status:</strong> {loan.status ?? 'Pending'}</p><p><strong>Created:</strong> {loan.createdAt}</p></div></section>
    <section className="pwfb-panel" style={{ maxWidth: 900, marginTop: 20 }}><div className="pwfb-panel-header"><div><h2>Guarantors</h2><p>Temporary records only. No external identity verification has been performed.</p></div></div>
      {!loan.guarantors?.length ? <div className="pwfb-empty-state"><p>No guarantor has been added to this loan.</p><Link href={`/loans/guarantor/add?loanId=${loan.id}`} className="pwfb-secondary-button">Add Guarantor</Link></div> : <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Name</th><th>Phone</th><th>Relationship</th><th>ID</th><th>Status</th></tr></thead><tbody>{loan.guarantors.map((g: any) => <tr key={g.id}><td>{[g.firstName, g.middleName, g.lastName].filter(Boolean).join(' ')}</td><td>{g.phone}</td><td>{g.relationship || '—'}</td><td>{g.idType}: {g.idNumber}</td><td><span className="pwfb-status-badge">Temporary / Not verified</span></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
