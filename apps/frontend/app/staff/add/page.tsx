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
    <main className="staff-registration-page">
      <div className="pwfb-page-header staff-page-header">
        <div>
          <p className="pwfb-eyebrow">STAFF MANAGEMENT</p>
          <h1 className="pwfb-page-title">Staff Registration</h1>
          <p className="pwfb-page-description">
            Create a staff account and assign the exact role and organizational scope.
          </p>
        </div>
        <Link href="/staff-dashboard" className="pwfb-secondary-button staff-back-button">Back</Link>
      </div>

      <section className="pwfb-panel staff-registration-card">
        <div className="pwfb-panel-header staff-section-header">
          <div>
            <h2>Role &amp; Organization Assignment</h2>
            <p>Choose Role → Region → Division → Area → Branch.</p>
          </div>
          <span className="pwfb-record-count">{regions.length} region{regions.length === 1 ? '' : 's'}</span>
        </div>

        <form onSubmit={submit} className="staff-form">
          <div className="staff-field-grid">
            <label className="staff-field">
              <span>Role</span>
              <select value={form.role} onChange={(e) => update('role', e.target.value)}>
                {roles.map((role) => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
              </select>
            </label>

            <label className="staff-field">
              <span>Region</span>
              <select value={form.regionId} onChange={(e) => selectRegion(e.target.value)} required disabled={loadingOrg}>
                <option value="">{loadingOrg ? 'Loading regions...' : 'Select Region'}</option>
                {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>
            </label>

            <label className="staff-field">
              <span>Division</span>
              <select value={form.divisionId} onChange={(e) => selectDivision(e.target.value)} disabled={!form.regionId || divisions.length === 0}>
                <option value="">{divisions.length ? 'Select Division' : 'No divisions available'}</option>
                {divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}
              </select>
            </label>

            <label className="staff-field">
              <span>Area</span>
              <select value={form.areaId} onChange={(e) => selectArea(e.target.value)} disabled={!form.regionId || areas.length === 0}>
                <option value="">{areas.length ? 'Select Area' : 'No areas available'}</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>

            <label className="staff-field">
              <span>Branch</span>
              <select value={form.branch} onChange={(e) => update('branch', e.target.value)} required disabled={!form.regionId || branches.length === 0}>
                <option value="">{branches.length ? 'Select Branch' : 'No branches available'}</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>

            <label className="staff-field">
              <span>Department ID</span>
              <input value={form.department} onChange={(e) => update('department', e.target.value)} placeholder="Department ID" required />
            </label>

            <label className="staff-field">
              <span>Position</span>
              <input value={form.position} onChange={(e) => update('position', e.target.value)} placeholder="e.g. Credit Officer" required />
            </label>

            <label className="staff-field">
              <span>Employment status</span>
              <select value={form.employmentStatus} onChange={(e) => update('employmentStatus', e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>

          {form.regionId && (
            <div className="staff-assignment-summary">
              <span>Current assignment scope</span>
              <strong>
                {selectedRegion?.name}
                {form.divisionId ? ` → ${divisions.find((item) => item.id === form.divisionId)?.name ?? ''}` : ''}
                {form.areaId ? ` → ${areas.find((item) => item.id === form.areaId)?.name ?? ''}` : ''}
                {form.branch ? ` → ${branches.find((item) => item.id === form.branch)?.name ?? ''}` : ''}
              </strong>
              <small>This becomes the staff member's initial active assignment.</small>
            </div>
          )}

          <section className="staff-details-card">
            <div className="staff-section-header">
              <div>
                <h2>Personal &amp; BVN Details</h2>
                <p>BVN verification can populate the staff member's legal name before registration.</p>
              </div>
            </div>

            <div className="staff-field-grid staff-personal-grid">
              <label className="staff-field staff-bvn-field">
                <span>BVN</span>
                <div className="staff-bvn-row">
                  <input
                    value={form.bvn}
                    onChange={(e) => update('bvn', e.target.value.replace(/\D/g, '').slice(0, 11))}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="11-digit BVN"
                  />
                  <button type="button" className="pwfb-secondary-button staff-verify-button" onClick={verifyBvn} disabled={verifyingBvn}>
                    {verifyingBvn ? 'Checking...' : 'Verify BVN'}
                  </button>
                </div>
              </label>

              {bvnResult?.verified && (
                <div className="staff-verified-box">
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
                <label key={name as string} className="staff-field">
                  <span>{label as string}</span>
                  <input
                    value={(form as any)[name as string]}
                    onChange={(e) => update(name as string, e.target.value)}
                    required={Boolean(required)}
                    type={name === 'email' ? 'email' : 'text'}
                  />
                </label>
              ))}
            </div>
          </section>

          {error && <div className="staff-error"><strong>{error}</strong></div>}

          <button type="submit" className="pwfb-primary-button staff-submit-button" disabled={saving || loadingOrg}>
            {saving ? 'Creating staff...' : 'Register Staff'}
          </button>
        </form>
      </section>

      {result?.login && (
        <section className="pwfb-panel staff-created-card">
          <div className="pwfb-panel-header staff-section-header">
            <div>
              <h2>Staff Created Successfully</h2>
              <p>Save the generated login details securely.</p>
            </div>
          </div>
          <div className="staff-created-grid">
            <div><span>Login email</span><strong>{result.login.email}</strong></div>
            <div><span>Temporary password</span><strong>{result.login.temporaryPassword}</strong></div>
            <div><span>Staff ID</span><strong>{result.staff?.staffId}</strong></div>
          </div>
        </section>
      )}

      <style jsx>{`
        .staff-registration-page { width: 100%; min-width: 0; }
        .staff-page-header { align-items: flex-end; }
        .staff-registration-card { width: 100%; max-width: 920px; overflow: hidden; }
        .staff-section-header { min-width: 0; }
        .staff-section-header > div { min-width: 0; }
        .staff-section-header h2 { margin: 0; }
        .staff-section-header p { margin: 6px 0 0; line-height: 1.45; }
        .staff-form { display: grid; gap: 20px; width: 100%; min-width: 0; }
        .staff-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; width: 100%; min-width: 0; }
        .staff-field { display: grid; grid-template-columns: minmax(110px, 38%) minmax(0, 1fr); align-items: center; gap: 10px; min-width: 0; }
        .staff-field > span { color: #35433b; font-size: 13px; font-weight: 750; line-height: 1.25; }
        .staff-field input, .staff-field select { width: 100%; min-width: 0; height: 44px; padding: 9px 12px; border: 1px solid #cfdad3; border-radius: 10px; background: #fff; color: #17211b; outline: none; }
        .staff-field input:focus, .staff-field select:focus { border-color: #0f7b35; box-shadow: 0 0 0 3px rgba(15,123,53,.11); }
        .staff-assignment-summary { display: grid; gap: 5px; padding: 15px 16px; border: 1px solid #dceee2; border-radius: 14px; background: #f7fcf9; min-width: 0; }
        .staff-assignment-summary span, .staff-assignment-summary small { color: #66736b; font-size: 12px; }
        .staff-assignment-summary strong { color: #0a5c28; font-size: 14px; overflow-wrap: anywhere; }
        .staff-details-card { display: grid; gap: 18px; margin: 0; padding: 20px; border: 1px solid #f0dfc9; border-radius: 16px; background: rgba(247,148,29,.045); min-width: 0; }
        .staff-personal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .staff-bvn-field { grid-column: 1 / -1; }
        .staff-bvn-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; min-width: 0; }
        .staff-verify-button { min-height: 44px; white-space: nowrap; border: 0; }
        .staff-verified-box { grid-column: 1 / -1; display: grid; gap: 4px; padding: 13px 14px; border: 1px solid #cce7d5; border-radius: 12px; background: #f4fbf6; min-width: 0; }
        .staff-verified-box span { color: #66736b; font-size: 12px; font-weight: 700; }
        .staff-verified-box strong { color: #0a5c28; overflow-wrap: anywhere; }
        .staff-error { padding: 13px 15px; border: 1px solid #f0c9c9; border-radius: 10px; background: #fff6f6; color: #a51d1d; }
        .staff-submit-button { width: 100%; min-height: 48px; }
        .staff-created-card { width: 100%; max-width: 920px; margin-top: 20px; }
        .staff-created-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .staff-created-grid > div { display: grid; gap: 6px; min-width: 0; padding: 15px; border: 1px solid #dceee2; border-radius: 12px; background: #fff; }
        .staff-created-grid span { color: #66736b; font-size: 12px; font-weight: 700; }
        .staff-created-grid strong { color: #17211b; overflow-wrap: anywhere; }

        @media (max-width: 760px) {
          .staff-registration-page { padding-bottom: 8px; }
          .staff-page-header { align-items: flex-start; flex-direction: column; gap: 12px; }
          .staff-back-button { width: 100%; }
          .staff-registration-card { max-width: none; border-radius: 14px; }
          .staff-section-header { align-items: flex-start; flex-direction: column; gap: 10px; }
          .staff-field-grid, .staff-personal-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
          .staff-field { grid-template-columns: 1fr; gap: 6px; align-items: stretch; }
          .staff-field > span { font-size: 12px; }
          .staff-field input, .staff-field select { height: 46px; }
          .staff-bvn-field { grid-column: auto; }
          .staff-bvn-row { grid-template-columns: minmax(0, 1fr); }
          .staff-verify-button { width: 100%; }
          .staff-verified-box { grid-column: auto; }
          .staff-created-grid { grid-template-columns: minmax(0, 1fr); }
          .staff-details-card { padding: 16px; }
        }

        @media (min-width: 761px) and (max-width: 980px) {
          .staff-field { grid-template-columns: minmax(95px, 34%) minmax(0, 1fr); }
        }
      `}</style>
    </main>
  );
}
