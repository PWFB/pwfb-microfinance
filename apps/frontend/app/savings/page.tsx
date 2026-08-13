"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";

interface Savings {
  id: string;
  customerId: string;
  amount: number;
  accountType?: string;
}

export default function SavingsPage() {
  const [savings, setSavings] = useState<Savings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSavings() {
      try {
        const data = await apiRequest("/savings");
        setSavings(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load savings:", error);
        setSavings([]);
      } finally {
        setLoading(false);
      }
    }

    loadSavings();
  }, []);

  const totalSavings = savings.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">SAVINGS OPERATIONS</p>
          <h1 className="pwfb-page-title">Savings</h1>
          <p className="pwfb-page-description">
            Manage customer savings accounts, balances and deposit activity.
          </p>
        </div>

        <Link href="/savings/add" className="pwfb-primary-button">
          + Add Savings
        </Link>
      </div>

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Total Accounts</span>
          <strong>{loading ? "—" : savings.length}</strong>
          <small>Registered savings records</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Total Savings</span>
          <strong>
            {loading
              ? "—"
              : `₦${totalSavings.toLocaleString("en-NG")}`}
          </strong>
          <small>Recorded savings value</small>
        </div>

        <div className="pwfb-stat-card">
          <span>Account Status</span>
          <strong>Active</strong>
          <small>Savings operations</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Savings Accounts</h2>
            <p>
              Customer savings records currently available in the system.
            </p>
          </div>

          <span className="pwfb-record-count">
            {loading ? "Loading..." : `${savings.length} records`}
          </span>
        </div>

        {loading ? (
          <div className="pwfb-empty-state">
            <div className="pwfb-loading-dot" />
            <p>Loading savings...</p>
          </div>
        ) : savings.length === 0 ? (
          <div className="pwfb-empty-state">
            <div className="pwfb-empty-icon">₦</div>
            <h3>No savings records found</h3>
            <p>Start by adding the first customer savings record.</p>
            <Link
              href="/savings/add"
              className="pwfb-secondary-button"
            >
              Add Savings
            </Link>
          </div>
        ) : (
          <div className="pwfb-table-wrap">
            <table className="pwfb-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Account Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {savings.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="pwfb-customer-cell">
                        <div className="pwfb-avatar">₦</div>
                        <div>
                          <strong>Customer</strong>
                          <small>{item.customerId}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <strong>
                        ₦{Number(item.amount || 0).toLocaleString("en-NG")}
                      </strong>
                    </td>

                    <td>{item.accountType || "—"}</td>

                    <td>
                      <span className="pwfb-status-badge">
                        Active
                      </span>
                    </td>

                    <td>
                      <div className="pwfb-actions">
                        <Link
                          href={`/savings/view/${item.id}`}
                          className="pwfb-action-view"
                        >
                          View
                        </Link>

                        <Link
                          href={`/savings/edit/${item.id}`}
                          className="pwfb-action-edit"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
