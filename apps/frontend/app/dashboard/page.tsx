"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  const cards = [
    {
      title: "Customers",
      value: 0,
      icon: "👥",
      path: "/customers",
    },
    {
      title: "Savings",
      value: 0,
      icon: "💰",
      path: "/savings",
    },
    {
      title: "Loans",
      value: 0,
      icon: "🏦",
      path: "/loans",
    },
    {
      title: "Transactions",
      value: 0,
      icon: "💳",
      path: "/transactions",
    },
    {
      title: "Reports",
      value: 0,
      icon: "📊",
      path: "/reports",
    },
    {
      title: "Administration",
      value: 0,
      icon: "⚙️",
      path: "/admin",
    },
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
      return;
    }

    fetch(
      "https://pwfb-microfinance-lnsm.onrender.com/auth/profile",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error("Unauthorized");
        }
        return res.json();
      })
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        localStorage.removeItem("token");
        router.push("/login");
      });
  }, [router]);

  function logout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <main
      style={{
        padding: "30px",
        fontFamily: "Arial, sans-serif",
        background: "#f7f7f7",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1>PWFB Microfinance Dashboard</h1>

          {user && (
            <>
              <p>
                <strong>
                  Welcome, {user.firstName} {user.lastName}
                </strong>
              </p>

              <p>Role: {user.role}</p>

              <p>Email: {user.email}</p>
            </>
          )}
        </div>

        <button
          onClick={logout}
          style={{
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <p>
        Welcome to the PWFB Microfinance Core Banking System.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            onClick={() => router.push(card.path)}
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "25px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              textAlign: "center",
              cursor: "pointer",
              transition: "0.2s",
            }}
          >
            <div
              style={{
                fontSize: "48px",
                marginBottom: "10px",
              }}
            >
              {card.icon}
            </div>

            <h2>{card.title}</h2>

            <h1>{card.value}</h1>

            <p>Open Module</p>
          </div>
        ))}
      </div>
    </main>
  );
}
