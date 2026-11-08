'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Collection = {
  id: string;
  type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER';
  amount: number;
  reference?: string;
  collectionDate: string;
  reconciled: boolean;
  settled?: boolean;
  settledAt?: string;
  settlementTransactionId?: string;
  settlementRecordId?: string;
  customer?: { id?: string; firstName: string; lastName: string };
  staff?: { firstName: string; lastName: string };
  branch?: { name: string };
};

type Target = { id: string; label: string; customerId?: string; amount?: number; status?: string };

const money = (v: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(v) || 0);

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [settling, setSettling] = useState<Collection | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState('');
  const [targetLoading, setTargetLoading] = useState(false);
  const [settlingNow, setSettlingNow] = useState(false);

  async function load() {
    try {
      const [rows, totals] = await Promise.all([apiRequest('/collections'), apiRequest('/collections/summary')]);
      setCollections(Array.isArray(rows) ? rows : []);
      setSummary(totals || {});
    } catch (e: any) {
      setError(e.message || 'Unable to load collections.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return collections.filter((item) => {
      const customer = item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : '';
      const text = `${item.id} ${item.reference || ''} ${customer} ${item.staff?.firstName || ''} ${item.staff?.lastName || ''} ${item.type}`.toLowerCase();
      return (!q || text.includes(q)) && (typeFilter === 'ALL' || item.type === typeFilter);
    });
  }, [collections, query, typeFilter]);

  async function reconcile(id: string, reconciled: boolean) {
    try {
      await apiRequest(`/collections/${id}/${reconciled ? 'unreconcile' : 'reconcile'}`, { method: 'PATCH' });
      await load();
    } catch (e: any) { setError(e.message || 'Unable to update reconciliation.'); }
  }

  async function openSettlement(collection: Collection) {
    setError('');
    setSettling(collection);
    setTargetId('');
    setTargets([]);
    if (collection.type === 'OTHER') return;
    setTargetLoading(true);
    try {
      const endpoint = collection.type === 'LOAN_REPAYMENT' ? '/loans' : '/savings';
      const data = await apiRequest(endpoint);
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      const customerId = collection.customer?.id;
      const mapped = rows
        .filter((row: any) => !customerId || row.customerId === customerId || row.customer?.id === customerId)
        .map((row: any) => ({
          id: row.id,
          customerId: row.customerId || row.customer?.id,
          amount: Number(row.amount || row.balance || 0),
          status: row.status,
          label: collection.type === 'LOAN_REPAYMENT'
            ? `${row.id} · ${money(row.amount)}${row.status ? ` · ${row.status}` : ''}`
            : `${row.id} · ${row.accountType || 'Savings'} · Balance ${money(row.amount)}`,
        }));
      setTargets(mapped);
    } catch (e: any) {
      setError(e.message || 'Unable to load settlement targets.');
    } finally { setTargetLoading(false); }
  }

  async function settleCollection() {
    if (!settling) return;
    if (settling.type !== 'OTHER' && !targetId) { setError('Select the customer loan or savings account that received this collection.'); return; }
    setSettlingNow(true);
    setError('');
    try {
      await apiRequest(`/collections/${settling.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({ targetId: targetId || undefined }),
      });
      setSettling(null);
      await load();
    } catch (e: any) { setError(e.message || 'Unable to settle collection.'); }
    finally { setSettlingNow(false); }
  }

  return (
    <main>
      <div className="pwfb-page-header">
        <div><p className="pwfb-eyebrow">FIELD OPERATIONS · FINANCIAL SETTLEMENT</p><h1 className="pwfb-page-title">Collections</h1><p className="pwfb-page-description">Capture field collections first, then settle them into the customer balance, repayment ledger and branch cashbook.</p></div>
        <Link href="/dashboard" className="pwfb-secondary-button">← Dashboard</Link>
      </div>

      {error && <div className="pwfb-alert">{error}</div>}

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card"><span>Total Collections</span><strong>{loading ? '—' : money(summary.total)}</strong><small>{summary.collectionCount || 0} collection records</small></div>
        <div className="pwfb-stat-card pwfb-stat-orange"><span>Settled</span><strong>{loading ? '—' : money(summary.settled)}</strong><small>Posted into financial records</small></div>
        <div className="pwfb-stat-card"><span>Unsettled</span><strong>{loading ? '—' : money(summary.unsettled)}</strong><small>Still awaiting posting</small></div>
        <div className="pwfb-stat-card"><span>Unreconciled</span><strong>{loading ? '—' : money(summary.unreconciled)}</strong><small>Awaiting reconciliation</small></div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div><h2>Collection Register</h2><p>Every field collection can be traced from receipt to ledger settlement.</p></div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, reference, ID…" style={{border:'1px solid #dfe6e2',borderRadius:10,padding:'9px 12px',minWidth:230}} />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{border:'1px solid #dfe6e2',borderRadius:10,padding:'9px 12px'}}><option value="ALL">All types</option><option value="SAVINGS">Savings</option><option value="LOAN_REPAYMENT">Loan Repayment</option><option value="OTHER">Other</option></select>
          </div>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table"><thead><tr><th>Date</th><th>Customer</th><th>Collector</th><th>Type</th><th>Amount</th><th>Financial Status</th><th>Action</th></tr></thead>
            <tbody>{filtered.map(collection => (
              <tr key={collection.id}>
                <td>{new Date(collection.collectionDate).toLocaleDateString('en-NG')}</td>
                <td>{collection.customer ? `${collection.customer.firstName} ${collection.customer.lastName}` : '—'}<br/><small>{collection.reference || collection.id}</small></td>
                <td>{collection.staff ? `${collection.staff.firstName} ${collection.staff.lastName}` : '—'}</td>
                <td>{collection.type}</td>
                <td><strong>{money(collection.amount)}</strong></td>
                <td><span className="pwfb-status-badge">{collection.settled ? 'SETTLED' : collection.reconciled ? 'RECONCILED · UNSETTLED' : 'PENDING'}</span></td>
                <td><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {!collection.settled && <button type="button" className="pwfb-primary-button" onClick={() => openSettlement(collection)}>Settle</button>}
                  <button type="button" className="pwfb-secondary-button" onClick={() => reconcile(collection.id, collection.reconciled)} disabled={!!collection.settled}>{collection.reconciled ? 'Unreconcile' : 'Reconcile'}</button>
                </div></td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={7}>No collections found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {settling && <div style={{position:'fixed',inset:0,zIndex:50,background:'rgba(0,0,0,.42)',display:'grid',placeItems:'center',padding:20}}>
        <div style={{background:'#fff',borderRadius:18,maxWidth:560,width:'100%',padding:24,boxShadow:'0 24px 80px rgba(0,0,0,.2)'}}>
          <p className="pwfb-eyebrow">FINANCIAL SETTLEMENT</p><h2 style={{margin:'0 0 8px'}}>Settle {settling.type.replace('_',' ')}</h2>
          <p style={{margin:'0 0 16px',color:'#66736c'}}>Post <strong>{money(settling.amount)}</strong> for {settling.customer ? `${settling.customer.firstName} ${settling.customer.lastName}` : 'the customer'} into the financial ledger.</p>
          {settling.type !== 'OTHER' ? <>{targetLoading ? <p>Loading customer accounts…</p> : <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{width:'100%',border:'1px solid #dfe6e2',borderRadius:10,padding:12}}><option value="">Select target account</option>{targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}</select>}<small style={{display:'block',marginTop:9,color:'#7a8580'}}>Only this customer’s {settling.type === 'LOAN_REPAYMENT' ? 'loans' : 'savings accounts'} are eligible.</small></> : <div style={{padding:14,borderRadius:12,background:'#fff7ec',color:'#7b4b12'}}>This OTHER collection will create a customer collection ledger entry and branch cash-in record.</div>}
          <div style={{display:'flex',justifyContent:'flex-end',gap:9,marginTop:22}}><button type="button" className="pwfb-secondary-button" onClick={() => setSettling(null)}>Cancel</button><button type="button" className="pwfb-primary-button" onClick={settleCollection} disabled={settlingNow || targetLoading}>{settlingNow ? 'Posting…' : 'Post to Financials'}</button></div>
        </div>
      </div>}
    </main>
  );
}
