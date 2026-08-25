'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Branch = { id: string; name: string; regionId?: string | null; divisionId?: string | null; areaId?: string | null };
type Area = { id: string; name: string; regionId: string; divisionId?: string | null };
type Division = { id: string; name: string; regionId: string; areas?: Area[]; branches?: Branch[] };
type Region = { id: string; name: string; divisions?: Division[]; areas?: Area[]; branches?: Branch[] };

const roles = [
  'SUPER_ADMIN',
  'ADMIN',
  'REGIONAL_MANAGER',
  'DIVISIONAL_MANAGER',
  'MONITORING_TEAM',
  'AUDITOR',
  'AREA_MANAGER',
  'BRANCH_MANAGER',
  'CREDIT_OFFICER',
  'TELLER',
  'LOAN_OFFICER',
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
    regionId: '',
    divisionId: '',
    areaId: '',
    employmentStatus: 'ACTIVE',
    bvn: '',
  });
  const [regions, setRegions] = useState<Region[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingBvn, setVerifyingBvn] = useState(false);
  const [bvnResult, setBvnResult] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/organization/hierarchy')
      .then((data) => {
        if (!active) return;
        setRegions(Array.isArray(data) ? data : []);
      })
      .catch((err: any) => {
        if (active) setError(err?.message || 'Unable to load organization structure');
      })
      .finally(() => {
        if (active) setLoadingOrg(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === form.regionId),
    [regions, form.regionId],
  );

  const divisions = selectedRegion?.divisions ?? [];
  const areas = useMemo(() => {
    const source = selectedRegion?.areas ?? [];
    return form.divisionId
      ? source.filter((area) => area.divisionId === form.divisionId)
      : source;
  }, [selectedRegion, form.divisionId]);

  const branches = useMemo(() => {
    const source = selectedRegion?.branches ?? [];
    return source.filter((branch) => {
      if (form.divisionId && branch.divisionId !== form.divisionId) return false;
      if (form.areaId && branch.areaId !== form.areaId) return false;
      return true;
    });
  }, [selectedRegion, form.divisionId, form.areaId]);

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectRegion(value: string) {
    setForm((current) => ({
      ...current,
      regionId: value,
      divisionId: '',
      areaId: '',
      branch: '',
    }));
  }

  function selectDivision(value: string) {
    setForm((current) => ({
      ...current,
      divisionId: value,
      areaId: '',
      branch: '',
    }));
  }

  function selectArea(value: string) {
    setForm((current) => ({ ...current, areaId: value, branch: '' }));
  }

  async function verifyBvn() {
    if (!/^\d{11}$/.test(form.bvn)) {
      setError('Enter an 11-digit BVN first.');
      return;
    }
    setVerifyingBvn(true);
    setError('');
    setBvnResult(null);
    try {
      const verified = await apiRequest('/staff/bvn/verify', {
        method: 'POST',
        body: JSON.stringify({ bvn: form.bvn }),
      });
      setBvnResult(verified);
      setForm((current) => ({
        ...current,
        firstName: verified.firstName || current.firstName,
        middleName: verified.middleName || current.middleName,
        lastName: verified.lastName || current.lastName,
      }));
    } catch (err: any) {
      setError(err?.message || 'BVN verification failed');
    } finally {
      setVerifyingBvn(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setResult(null);

    if (!form.regionId || !form.branch) {
      setError('Select the Region and Branch for this staff member.');
      setSaving(false);
      return;
    }

    try {
      const created = await apiRequest('/staff', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          ...(form.email ? { email: form.email } : {}),
          ...(form.middleName ? { middleName: form.middleName } : {}),
          ...(form.bvn ? { bvn: form.bvn } : {}),
        }),
      });
      setResult(created);
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
          <h1 className="pwfb-page-title">Staff Registration</h1>
          <p className="pwfb-page-description">
            Create a staff account and assign the exact role and organizational scope.
          </p>
        </div>
        <Link href="/staff-dashboard" className="pwfb-secondary-button">Back</Link>
      </div>

      <section className="pwfb-panel" style={{ maxWidth: 920 }}>
        <div className="pwfb-panel-header">
          <div>
            <h2>Role &amp; Organization Assignment</h2>
            <p>Choose Role → Region → Division → Area → Branch. Each selection controls the next available level.</p>
          </div>
          <span className="pwfb-record-count">{regions.length} region{regions.length === 1 ? '' : 's'}</span>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
          <div className="pwfb-form-grid">
            <label>
              <span>Role</span>
              <select value={form.role} onChange={(e) => update('role', e.target.value)}>
                {roles.map((role) => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
              </select>
            </label>

            <label>
              <span>Region</span>
              <select value={form.regionId} onChange={(e) => selectRegion(e.target.value)} required disabled={loadingOrg}>
                <option value="">{loadingOrg ? 'Loading regions...' : 'Select Region'}</option>
                {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>
            </label>

            <label>
              <span>Division</span>
              <select value={form.divisionId} onChange={(e) => selectDivision(e.target.value)} disabled={!form.regionId || divisions.length === 0}>
                <option value="">{divisions.length ? 'Select Division' : 'No divisions available'}</option>
                {divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}
              </select>
            </label>

            <label>
              <span>Area</span>
              <select value={form.areaId} onChange={(e) => selectArea(e.target.value)} disabled={!form.regionId || areas.length === 0}>
                <option value="">{areas.length ? 'Select Area' : 'No areas available'}</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>

            <label>
              <span>Branch</span>
              <select value={form.branch} onChange={(e) => update('branch', e.target.value)} required disabled={!form.regionId || branches.length === 0}>
                <option value="">{branches.length ? 'Select Branch' : 'No branches available'}</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>

            <label>
              <span>Department ID</span>
              <input value={form.department} onChange={(e) => update('department', e.target.value)} placeholder="Department ID" required />
            </label>

            <label>
              <span>Position</span>
              <input value={form.position} onChange={(e) => update('position', e.target.value)} placeholder="e.g. Credit Officer" required />
            </label>

            <label>
              <span>Employment status</span>
              <select value={form.employmentStatus} onChange={(e) => update('employmentStatus', e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>

          {form.regionId && (
            <div className="pwfb-stat-card">
              <span>Current assignment scope</span>
              <strong>
                {selectedRegion?.name}
                {form.divisionId ? ` → ${divisions.find((item) => item.id === form.divisionId)?.name ?? ''}` : ''}
                {form.areaId ? ` → ${areas.find((item) => item.id === form.areaId)?.name ?? ''}` : ''}
                {form.branch ? ` → ${branches.find((item) => item.id === form.branch)?.name ?? ''}` : ''}
              </strong>
              <small>This scope becomes the staff member's initial active assignment.</small>
            </div>
          )}

          <div className="pwfb-panel" style={{ margin: 0, background: 'rgba(247, 148, 29, 0.04)' }}>
            <div className="pwfb-panel-header">
              <div>
                <h2>Personal &amp; BVN Details</h2>
                <p>BVN verification can populate the staff member's legal name before registration.</p>
              </div>
            </div>

            <div className="pwfb-form-grid">
              <label>
                <span>BVN</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={form.bvn} onChange={(e) => update('bvn', e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" maxLength={11} placeholder="11-digit BVN" />
                  <button type="button" className="pwfb-secondary-button" onClick={verifyBvn} disabled={verifyingBvn}>{verifyingBvn ? 'Checking...' : 'Verify BVN'}</button>
                </div>
              </label>

              {bvnResult?.verified && (
                <div className="pwfb-stat-card">
                  <span>BVN verified name</span>
                  <strong>{bvnResult.fullName}</strong>
                </div>
              )}

              {[
                ['firstName', 'First name', true],
                ['middleName', 'Middle name', false],
                ['lastName', 'Last name', true],
                ['email', 'Email (optional)', false],
                ['phone', 'Phone', true],
              ].map(([name, label, required]) => (
                <label key={name as string}>
                  <span>{label as string}</span>
                  <input value={(form as any)[name as string]} onChange={(e) => update(name as string, e.target.value)} required={Boolean(required)} type={name === 'email' ? 'email' : 'text'} />
                </label>
              ))}
            </div>
          </div>

          {error && <div className="pwfb-empty-state"><strong>{error}</strong></div>}

          <button type="submit" className="pwfb-primary-button" disabled={saving || loadingOrg}>
            {saving ? 'Creating staff...' : 'Register Staff'}
          </button>
        </form>
      </section>

      {result?.login && (
        <section className="pwfb-panel" style={{ maxWidth: 920, marginTop: 20 }}>
          <div className="pwfb-panel-header">
            <div>
              <h2>Staff Created Successfully</h2>
              <p>Save the generated login details securely.</p>
            </div>
          </div>
          <div className="pwfb-stat-grid">
            <div className="pwfb-stat-card"><span>Login email</span><strong>{result.login.email}</strong></div>
            <div className="pwfb-stat-card pwfb-stat-orange"><span>Temporary password</span><strong>{result.login.temporaryPassword}</strong></div>
            <div className="pwfb-stat-card"><span>Staff ID</span><strong>{result.staff?.staffId}</strong></div>
          </div>
        </section>
      )}
    </main>
  );
}
