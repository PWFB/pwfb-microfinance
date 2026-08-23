'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { apiRequest } from '../../../../lib/api';

const roles = [
  'ADMIN',
  'BRANCH_MANAGER',
  'LOAN_OFFICER',
  'TELLER',
  'AUDITOR',
  'STAFF',
];

export default function AddStaffPage() {
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    role: 'STAFF',
    branch: '',
    employmentStatus: 'ACTIVE',
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setResult(null);

    try {
      const body = {
        ...form,
        ...(form.email ? { email: form.email } : {}),
        ...(form.middleName ? { middleName: form.middleName } : {}),
      };
      const created = await apiRequest('/staff', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResult(created);
      setForm({
        firstName: '', middleName: '', lastName: '', email: '', phone: '',
        department: '', position: '', role: 'STAFF', branch: '', employmentStatus: 'ACTIVE',
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to create staff');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">STAFF MANAGEMENT</p>
          <h1 className="pwfb-page-title">Create Staff</h1>
          <p className="pwfb-page-description">Create a staff profile and login account for PWFB operations.</p>
        </div>
        <Link href="/staff-dashboard" className="pwfb-secondary-button">Back</Link>
      </div>

      <section className="pwfb-panel" style={{ maxWidth: 820 }}>
        <div className="pwfb-panel-header">
          <div>
            <h2>Staff Account</h2>
            <p>Leave email and staff ID empty when you want PWFB to generate the login details.</p>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          <div className="pwfb-form-grid">
            {[
              ['firstName', 'First name', true],
              ['middleName', 'Middle name', false],
              ['lastName', 'Last name', true],
              ['email', 'Email (optional)', false],
              ['phone', 'Phone', true],
              ['department', 'Department ID', true],
              ['position', 'Position', true],
              ['branch', 'Branch ID', true],
            ].map(([name, label, required]) => (
              <label key={name as string}>
                <span>{label as string}</span>
                <input
                  value={(form as any)[name as string]}
                  onChange={(e) => update(name as string, e.target.value)}
                  required={Boolean(required)}
                  type={name === 'email' ? 'email' : 'text'}
                  placeholder={name === 'department' || name === 'branch' ? 'Enter existing ID' : ''}
                />
              </label>
            ))}

            <label>
              <span>Role</span>
              <select value={form.role} onChange={(e) => update('role', e.target.value)}>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>

            <label>
              <span>Employment status</span>
              <select value={form.employmentStatus} onChange={(e) => update('employmentStatus', e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>

          {error && <div className="pwfb-empty-state"><strong>{error}</strong></div>}

          <button type="submit" className="pwfb-primary-button" disabled={saving}>
            {saving ? 'Creating staff...' : 'Create Staff'}
          </button>
        </form>
      </section>

      {result?.login && (
        <section className="pwfb-panel" style={{ maxWidth: 820, marginTop: 20 }}>
          <div className="pwfb-panel-header">
            <div>
              <h2>Staff Created Successfully</h2>
              <p>Save these generated login details securely.</p>
            </div>
          </div>
          <div className="pwfb-stat-grid">
            <div className="pwfb-stat-card"><span>Login email</span><strong>{result.login.email}</strong></div>
            <div className="pwfb-stat-card pwfb-stat-orange"><span>Temporary password</span><strong>{result.login.temporaryPassword}</strong></div>
            <div className="pwfb-stat-card"><span>Staff ID</span><strong>{result.staff?.staffId || 'Generated'}</strong></div>
          </div>
        </section>
      )}
    </main>
  );
}
