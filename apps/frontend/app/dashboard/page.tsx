"use client";

export default function Dashboard() {
  const cards = [
    { title: "Customers", value: 0, icon: "👥" },
    { title: "Savings", value: 0, icon: "💰" },
    { title: "Loans", value: 0, icon: "🏦" },
    { title: "Transactions", value: 0, icon: "💳" },
  ];

  return (
    <main style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>PWFB Microfinance Dashboard</h1>

      <p>Welcome to PWFB Core Banking System.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 20,
          marginTop: 30,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 20,
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: 40 }}>{card.icon}</h2>
            <h3>{card.title}</h3>
            <h1>{card.value}</h1>
          </div>
        ))}
      </div>
    </main>
  );
}
