import Link from "next/link";
import styles from "./home.module.css";

const modules = [
  ["👥", "Customers", "Manage customer profiles and KYC.", "/customers"],
  ["💰", "Savings", "Create and manage savings accounts.", "/savings"],
  ["🏦", "Loans", "Loan applications and approvals.", "/loans"],
  ["💳", "Transactions", "View deposits, withdrawals and transfers.", "/transactions"],
];

export default function Home() {
  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>PWFB</span>
          <span className={styles.brandCopy}>
            <strong>PWFB Microfinance</strong>
            <small>Perfect Wisdom For Better Limited</small>
          </span>
        </Link>

        <nav className={styles.nav}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/savings">Savings</Link>
          <Link href="/loans">Loans</Link>
          <Link href="/transactions">Transactions</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
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
          <h2>See your current PWFB information</h2>
          <p>Sign in to view live balances, customer records, loans and transactions. This public page does not display sample financial figures.</p>
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
