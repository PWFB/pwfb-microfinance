"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = "https://pwfb-microfinance-lnsm.onrender.com";

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
    <main style={{ padding: 30, fontFamily: "Arial" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1>👥 Customers</h1>

        <Link href="/customers/add">
          <button>Add Customer</button>
        </Link>
      </div>

      {loading ? (
        <p>Loading customers...</p>
      ) : customers.length === 0 ? (
        <p>No customers found.</p>
      ) : (
        <table
          border={1}
          cellPadding={10}
          cellSpacing={0}
          width="100%"
        >
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  {customer.firstName} {customer.lastName}
                </td>

                <td>{customer.email || "-"}</td>

                <td>{customer.phone || "-"}</td>

                <td>
                  <Link href={`/customers/view/${customer.id}`}>
                    View
                  </Link>

                  {" | "}

                  <Link href={`/customers/edit/${customer.id}`}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
