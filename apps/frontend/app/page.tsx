import Link from "next/link";
import styles from "./home.module.css";

const modules = [
  ["👥", "Customers", "Manage customer profiles and KYC.", "/login"],
  ["💰", "Savings", "Create and manage savings accounts.", "/login"],
  ["🏦", "Loans", "Loan applications and approvals.", "/login"],
  ["💳", "Transactions", "View deposits, withdrawals and transfers.", "/login"],
];

export default function Home() {
  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="PWFB Microfinance home">
          <img
            src="/pwfb-logo.svg"
            alt="PWFB Microfinance"
            className={styles.brandLogo}
          />
        </Link>

        <nav className={styles.nav}>
          <Link href="/login">Dashboard</Link>
          <Link href="/login">Customers</Link>
          <Link href="/login">Savings</Link>
          <Link href="/login">Loans</Link>
          <Link href="/login">Transactions</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <img
            src="/pwfb-logo.svg"
            alt="PWFB Microfinance"
            className={styles.heroLogo}
          />
          <p className={styles.eyebrow}>PWFB MICROFINANCE</p>
          <h1>Smart Finance. Better Future.</h1>
          <p className={styles.heroText}>
            Secure Savings • Fast Loans • Reliable Transactions
          </p>

          <div className={styles.heroActions}>
            <Link href="/login" className={styles.loginButton}>
              Login
            </Link>
            <Link href="/register" className={styles.registerButton}>
              Register
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>CORE OPERATIONS</p>
          <h2>Everything you need to manage PWFB</h2>
        </div>

        <div className={styles.moduleGrid}>
          {modules.map(([icon, title, description, href]) => (
            <Link key={href} href={href} className={styles.moduleCard}>
              <span className={styles.moduleIcon}>{icon}</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className={styles.moduleLink}>Open Module →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>LIVE ACCOUNT DATA</p>
          <h2>Your current PWFB dashboard</h2>
          <p>Sign in to view live balances, customer records, loans and transactions. This public page does not show sample financial totals.</p>
        </div>
        <div className={styles.heroActions}>
          <Link href="/login" className={styles.loginButton}>Open Dashboard</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        © {new Date().getFullYear()} PWFB Microfinance • Perfect Wisdom For Better Limited
      </footer>
    </main>
  );
}
