'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import styles from './dashboard.module.css';

type Summary = { customers: { count: number }; savings: { count: number; amount: number }; loans: { count: number; amount: number }; transactions: { count: number; amount: number }; repayments: { count: number; amount: number }; portfolio: { amount: number } };
const initialSummary: Summary = { customers: { count: 0 }, savings: { count: 0, amount: 0 }, loans: { count: 0, amount: 0 }, transactions: { count: 0, amount: 0 }, repayments: { count: 0, amount: 0 }, portfolio: { amount: 0 } };
function money(value: number) { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value) || 0); }

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; apiRequest('/reports/summary').then((data) => { if (active) setSummary(data); }).catch(console.error).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const portfolioTotal = summary.portfolio.amount || summary.savings.amount + summary.loans.amount;
  const savingsShare = portfolioTotal > 0 ? Math.round((summary.savings.amount / portfolioTotal) * 100) : 50;
  const loanShare = Math.max(0, 100 - savingsShare);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
  const chartPattern = [0.62, 0.72, 0.67, 0.81, 0.74, 0.88, 0.79, 0.94, 0.86, 0.98, 0.9];

  return (
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.heading}><p className={styles.eyebrow}>PWFB MICROFINANCE MANAGEMENT SYSTEM</p><h1>Dashboard</h1><p>Manage deposits. Issue loans. Track repayments. Grow responsibly.</p></div>
        <div className={styles.headerActions}><button type="button" className={styles.headerButton} aria-label="Daily summary">▣</button><button type="button" className={styles.headerButton} aria-label="Refresh dashboard">↻</button><div className={styles.adminChip}><div className={styles.avatar}>SA</div><div><strong>Super Admin</strong><small>Administrator</small></div></div></div>
      </header>

      <section className={styles.stats}>
        <Link href="/savings" className={styles.stat}><div className={`${styles.statIcon} ${styles.green}`}>▣</div><div className={styles.statText}><small>Total Deposits</small><strong>{loading ? '—' : money(summary.savings.amount)}</strong><span>{summary.savings.count} savings records</span></div></Link>
        <Link href="/loans" className={styles.stat}><div className={`${styles.statIcon} ${styles.orange}`}>▤</div><div className={styles.statText}><small>Total Loans Outstanding</small><strong>{loading ? '—' : money(summary.loans.amount)}</strong><span>{summary.loans.count} loan records</span></div></Link>
        <Link href="/customers" className={styles.stat}><div className={`${styles.statIcon} ${styles.green}`}>♙</div><div className={styles.statText}><small>Active Borrowers</small><strong>{loading ? '—' : summary.customers.count.toLocaleString('en-NG')}</strong><span>Customer accounts</span></div></Link>
        <Link href="/repayments" className={styles.stat}><div className={`${styles.statIcon} ${styles.orange}`}>↗</div><div className={styles.statText}><small>Total Repayments</small><strong>{loading ? '—' : money(summary.repayments.amount)}</strong><span>{summary.repayments.count} repayment records</span></div></Link>
      </section>

      <section className={styles.grid}>
        <div className={styles.stack}>
          <div className={styles.panel}><div className={styles.panelHead}><div><small>DEPOSIT VS LOAN OVERVIEW</small><h2>Portfolio Performance</h2></div><Link href="/reports">View Reports →</Link></div><div className={styles.portfolio}><div className={styles.portfolioNumbers}><div className={styles.portfolioMain}><span>Total Portfolio</span><strong>{loading ? '—' : money(portfolioTotal)}</strong></div><div className={styles.miniMetric}><span>Deposits</span><strong>{loading ? '—' : money(summary.savings.amount)}</strong></div><div className={styles.miniMetric}><span>Loans</span><strong>{loading ? '—' : money(summary.loans.amount)}</strong></div></div><div className={styles.barChart} aria-label="Portfolio performance chart">{months.map((month, index) => { const depositHeight = Math.max(12, Math.min(100, chartPattern[index] * 100)); const loanHeight = Math.max(10, Math.min(100, depositHeight * (loanShare / Math.max(savingsShare, 1)))); return <div key={month} className={styles.barGroup}><div className={`${styles.bar} ${styles.barDeposit}`} style={{ height: `${depositHeight}%` }} /><div className={`${styles.bar} ${styles.barLoan}`} style={{ height: `${loanHeight}%` }} /><span className={styles.barLabel}>{month}</span></div>; })}</div></div><div className={styles.legend}><span><i className={styles.barDeposit} />Deposits</span><span><i className={styles.barLoan} />Loans</span></div></div>
          <div className={styles.panel}><div className={styles.panelHead}><div><small>RECENT TRANSACTIONS</small><h2>Recent Activity</h2></div><Link href="/transactions">View All →</Link></div><div className={styles.activity}><div className={styles.activityRow}><b className={`${styles.activityIcon} ${styles.green}`}>₦</b><div><strong>Financial transactions</strong><span>Recorded transaction activity</span></div><small className={styles.activityAmount}>{loading ? '—' : money(summary.transactions.amount)}</small></div><div className={styles.activityRow}><b className={`${styles.activityIcon} ${styles.orange}`}>↗</b><div><strong>Loan repayments</strong><span>Customer repayment activity</span></div><small className={styles.activityAmount}>{loading ? '—' : money(summary.repayments.amount)}</small></div><div className={styles.activityRow}><b className={`${styles.activityIcon} ${styles.green}`}>+</b><div><strong>Customer deposits</strong><span>Savings activity recorded</span></div><small className={styles.activityAmount}>{loading ? '—' : money(summary.savings.amount)}</small></div></div></div>
        </div>

        <aside className={styles.stack}>
          <div className={`${styles.panel} ${styles.donutPanel}`}><div className={styles.panelHead}><div><small>LOAN PORTFOLIO SUMMARY</small><h2>Portfolio Split</h2></div></div><div className={styles.donutWrap}><div className={styles.donut} style={{ background: `conic-gradient(#18863e 0 ${savingsShare}%, #f28c18 ${savingsShare}% 100%)` }}><div className={styles.donutCenter}><strong>{loading ? '—' : money(portfolioTotal)}</strong><span>Total portfolio</span></div></div><div className={styles.statusList}><div className={styles.status}><i style={{ background: '#18863e' }} /><span>Deposits</span><strong>{savingsShare}%</strong></div><div className={styles.status}><i style={{ background: '#f28c18' }} /><span>Loans</span><strong>{loanShare}%</strong></div><div className={styles.status}><i style={{ background: '#f4b000' }} /><span>Transactions</span><strong>{summary.transactions.count}</strong></div></div></div></div>
          <div className={styles.panel}><div className={styles.panelHead}><div><small>OPERATIONS</small><h2>Quick Actions</h2></div></div><div className={styles.shortcuts}>
            <Link href="/banking?operation=deposit" className={`${styles.shortcut} ${styles.shortcutBanking}`}><b>₦</b><span>Deposit</span></Link>
            <Link href="/banking?operation=withdraw" className={`${styles.shortcut} ${styles.shortcutBanking}`}><b>−</b><span>Withdrawal</span></Link>
            <Link href="/banking?operation=transfer" className={`${styles.shortcut} ${styles.shortcutBanking}`}><b>↔</b><span>Transfer</span></Link>
            <Link href="/loans/add" className={styles.shortcut}><b>↗</b><span>New Loan</span></Link>
            <Link href="/repayments/add" className={styles.shortcut}><b>↻</b><span>Receive Payment</span></Link>
            <Link href="/customers/add" className={styles.shortcut}><b>+</b><span>Add Customer</span></Link>
          </div></div>
        </aside>
      </section>

      <section className={styles.whatWeDo}><div className={styles.sectionTitle}>WHAT WE DO</div><div className={styles.featureGrid}><div className={styles.feature}><b className={styles.featureIcon}>◉</b><div><strong>Hold Deposits</strong><span>Accept and manage customer savings and fixed deposits securely.</span></div></div><div className={styles.feature}><b className={styles.featureIcon}>₦</b><div><strong>Issue Loans</strong><span>Create loan products, assess customers and disburse loans.</span></div></div><div className={styles.feature}><b className={styles.featureIcon}>▣</b><div><strong>Track Repayments</strong><span>Monitor repayments in real-time and reduce defaults.</span></div></div><div className={styles.feature}><b className={styles.featureIcon}>↗</b><div><strong>Reports & Insights</strong><span>Make data-driven decisions with powerful reports.</span></div></div></div><div className={styles.tagline}><strong>Simple. Secure. Transparent.</strong><span>Built for sustainable microfinance operations.</span></div></section>
    </main>
  );
}
