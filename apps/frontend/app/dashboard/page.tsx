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
      link: "/customers",
    },
    {
      title: "Savings",
      value: 0,
      icon: "💰",
      link: "/savings",
    },
    {
      title: "Loans",
      value: 0,
      icon: "🏦",
      link: "/loans",
    },
    {
      title: "Transactions",
      value: 0,
      icon: "💳",
      link: "/transactions",
    },
    {
      title: "Reports",
      value: 0,
      icon: "📊",
      link: "/reports",
    },
    {
      title: "Administration",
      value: 0,
      icon: "⚙️",
      link: "/admin",
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
      .then((res) => res.json())
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
        <h1>
          PWFB Microfinance Dashboard
        </h1>

        <button onClick={logout}>
          Logout
        </button>
      </div>

      {user && (
        <p>
          Welcome, {user.firstName} {user.lastName}
          <br />
          Role: {user.role}
        </p>
      )}

      <p>
        Welcome to PWFB Core Banking System.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",
          gap: 20,
          marginTop: 30,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            onClick={() =>
              router.push(card.link)
            }
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 20,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <h2
              style={{
                fontSize: 40,
              }}
            >
              {card.icon}
            </h2>

            <h3>
              {card.title}
            </h3>

            <h1>
              {card.value}
            </h1>

            <p>
              Open Module
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
