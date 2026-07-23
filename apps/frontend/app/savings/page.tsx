"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = "https://pwfb-microfinance-lnsm.onrender.com";

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
    fetch(`${API_URL}/savings`)
      .then((res) => res.json())
      .then((data) => {
        setSavings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <main
      style={{
        padding: 30,
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>💰 Savings</h1>

        <Link href="/savings/add">
          <button>
            Add Savings
          </button>
        </Link>
      </div>

      {loading ? (
        <p>Loading savings...</p>
      ) : savings.length === 0 ? (
        <p>No savings records found.</p>
      ) : (
        <table
          border={1}
          cellPadding={10}
          cellSpacing={0}
          width="100%"
        >
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Amount</th>
              <th>Account Type</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {savings.map((item) => (
              <tr key={item.id}>
                <td>{item.customerId}</td>

                <td>
                  {item.amount}
                </td>

                <td>
                  {item.accountType || "-"}
                </td>

                <td>
                  <Link href={`/savings/view/${item.id}`}>
                    View
                  </Link>

                  {" | "}

                  <Link href={`/savings/edit/${item.id}`}>
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
