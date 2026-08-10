import Link from "next/link";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fa",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#0f7b35",
          color: "#fff",
          padding: "18px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>PWFB Microfinance</h1>
          <small>Perfect Wisdom For Better Limited</small>
        </div>

        <nav style={{ display: "flex", gap: 20 }}>
          <Link href="/dashboard" style={{ color: "#fff" }}>Dashboard</Link>
          <Link href="/customers" style={{ color: "#fff" }}>Customers</Link>
          <Link href="/savings" style={{ color: "#fff" }}>Savings</Link>
          <Link href="/loans" style={{ color: "#fff" }}>Loans</Link>
          <Link href="/transactions" style={{ color: "#fff" }}>Transactions</Link>
        </nav>
      </header>

      {/* Hero */}
      <section
        style={{
          padding: 50,
          textAlign: "center",
          background: "linear-gradient(135deg,#118e3e,#ff8800)",
          color: "#fff",
        }}
      >
        <h1 style={{ fontSize: 42 }}>
          Smart Finance. Better Future.
        </h1>

        <p style={{ fontSize: 20 }}>
          Secure Savings • Fast Loans • Reliable Transactions
        </p>

        <div
          style={{
            marginTop: 30,
            display: "flex",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <Link
            href="/login"
            style={{
              background: "#fff",
              color: "#118e3e",
              padding: "14px 30px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Login
          </Link>

          <Link
            href="/register"
            style={{
              background: "#ff8800",
              color: "#fff",
              padding: "14px 30px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Register
          </Link>
        </div>
      </section>

      {/* Modules */}
      <section
        style={{
          padding: 40,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
          gap: 25,
        }}
      >
        <div style={cardStyle}>
          <h2>👥 Customers</h2>
          <p>Manage customer profiles and KYC.</p>
          <Link href="/customers">Open Module →</Link>
        </div>

        <div style={cardStyle}>
          <h2>💰 Savings</h2>
          <p>Create and manage savings accounts.</p>
          <Link href="/savings">Open Module →</Link>
        </div>

        <div style={cardStyle}>
          <h2>🏦 Loans</h2>
          <p>Loan applications and approvals.</p>
          <Link href="/loans">Open Module →</Link>
        </div>

        <div style={cardStyle}>
          <h2>💳 Transactions</h2>
          <p>View deposits, withdrawals and transfers.</p>
          <Link href="/transactions">Open Module →</Link>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section style={{ padding: 40 }}>
        <h2 style={{ textAlign: "center", marginBottom: 30 }}>
          Dashboard Overview
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 20,
          }}
        >
          <div style={cardStyle}>
            <h3>Total Customers</h3>
            <h1 style={{ color: "#118e3e" }}>2,453</h1>
          </div>

          <div style={cardStyle}>
            <h3>Total Savings</h3>
            <h1 style={{ color: "#118e3e" }}>₦245M</h1>
          </div>

          <div style={cardStyle}>
            <h3>Total Loans</h3>
            <h1 style={{ color: "#ff8800" }}>₦158M</h1>
          </div>

          <div style={cardStyle}>
            <h3>Transactions</h3>
            <h1 style={{ color: "#118e3e" }}>8,732</h1>
          </div>
        </div>
      </section>

      <footer
        style={{
          background: "#0f7b35",
          color: "#fff",
          textAlign: "center",
          padding: 25,
          marginTop: 40,
        }}
      >
        © {new Date().getFullYear()} PWFB Microfinance • Perfect Wisdom For Better Limited
      </footer>
    </main>
  );
}
