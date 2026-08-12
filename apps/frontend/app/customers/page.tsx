"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/customers`)
      .then((res) => res.json())
      .then((data) => {
        setCustomers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">CUSTOMER MANAGEMENT</p>
          <h1 className="pwfb-page-title">Customers</h1>
          <p className="pwfb-page-description">
            Manage customer profiles, contact information and KYC records.
          </p>
        </div>

        <Link href="/customers/add" className="pwfb-primary-button">
          + Add Customer
        </Link>
      </div>

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Total Customers</span>
          <strong>{loading ? "—" : customers.length}</strong>
          <small>Registered clients</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Customer Status</span>
          <strong>Active</strong>
          <small>Customer management</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Customer Directory</h2>
            <p>All customers currently available in the system.</p>
          </div>

          <span className="pwfb-record-count">
            {loading ? "Loading..." : `${customers.length} records`}
          </span>
        </div>

        {loading ? (
          <div className="pwfb-empty-state">
            <div className="pwfb-loading-dot" />
            <p>Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="pwfb-empty-state">
            <div className="pwfb-empty-icon">👥</div>
            <h3>No customers found</h3>
            <p>Start by adding your first customer.</p>
            <Link href="/customers/add" className="pwfb-secondary-button">
              Add Customer
            </Link>
          </div>
        ) : (
          <div className="pwfb-table-wrap">
            <table className="pwfb-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="pwfb-customer-cell">
                        <div className="pwfb-avatar">
                          {customer.firstName?.[0]}
                          {customer.lastName?.[0]}
                        </div>

                        <div>
                          <strong>
                            {customer.firstName} {customer.lastName}
                          </strong>
                          <small>Customer ID: {customer.id}</small>
                        </div>
                      </div>
                    </td>

                    <td>{customer.email || "—"}</td>
                    <td>{customer.phone || "—"}</td>

                    <td>
                      <span className="pwfb-status-badge">
                        Active
                      </span>
                    </td>

                    <td>
                      <div className="pwfb-actions">
                        <Link
                          href={`/customers/view/${customer.id}`}
                          className="pwfb-action-view"
                        >
                          View
                        </Link>

                        <Link
                          href={`/customers/edit/${customer.id}`}
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
