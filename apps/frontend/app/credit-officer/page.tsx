'use client';

import Link from 'next/link';

const actions = [
  { title: 'Register Customer', description: 'Register a new field customer and collect registration, client card and other onboarding fees.', href: '/customers/add', icon: '👤' },
  { title: 'Add Loan', description: 'Create a loan application for a customer within your assigned branch.', href: '/loans/add', icon: '💰' },
  { title: 'Savings Collection', description: 'Record customer savings/deposit activity collected in the field.', href: '/savings/add', icon: '🏦' },
  { title: 'Loan Collection', description: 'Record a customer loan repayment and update the repayment register.', href: '/repayments/add', icon: '🧾' },
];

export default function CreditOfficerPage() {
  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">CREDIT OFFICER • FIELD OPERATIONS</p>
          <h1 className="pwfb-page-title">Field Work Centre</h1>
          <p className="pwfb-page-description">Your daily customer, loan, savings and collection workflow.</p>
        </div>
        <Link href="/dashboard" className="pwfb-secondary-button">Dashboard</Link>
      </div>

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card"><span>Customer Registration</span><strong>01</strong><small>Register + collect onboarding fees</small></div>
        <div className="pwfb-stat-card pwfb-stat-orange"><span>Loan Operations</span><strong>02</strong><small>Add loans and collect repayments</small></div>
        <div className="pwfb-stat-card"><span>Savings</span><strong>03</strong><small>Collect customer savings</small></div>
        <div className="pwfb-stat-card"><span>Field Collections</span><strong>04</strong><small>Review daily collection activity</small></div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div><h2>Go-to Field Actions</h2><p>Use these actions for the normal Credit Officer customer journey.</p></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {actions.map(action => (
            <Link key={action.title} href={action.href} className="pwfb-panel" style={{ textDecoration: 'none', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 30 }}>{action.icon}</div>
              <h3 style={{ marginTop: 10, fontWeight: 800 }}>{action.title}</h3>
              <p style={{ marginTop: 6, color: '#64748b' }}>{action.description}</p>
              <span className="pwfb-primary-button" style={{ display: 'inline-block', marginTop: 16 }}>Open</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div><h2>Collection Register</h2><p>Review savings, loan repayment and onboarding-fee collections.</p></div>
          <Link href="/collections" className="pwfb-secondary-button">Open Collections</Link>
        </div>
      </section>
    </main>
  );
}
