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
        <Link href="/" className={styles.brand} aria-label="LAB MICROFINANCE home">
          <img src="/pwfb-logo.svg" alt="LAB MICROFINANCE" className={styles.brandLogo} />
          <span className={styles.brandText}>LAB MICROFINANCE</span>
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/login">Dashboard</Link>
          <Link href="/login">Customers</Link>
          <Link href="/login">Savings</Link>
          <Link href="/login">Loans</Link>
          <Link href="/login">Transactions</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBrand}>
            <img src="/pwfb-logo.svg" alt="" className={styles.heroLogo} />
            <p className={styles.eyebrow}>YOUR FINANCIAL PARTNER</p>
            <h1>LAB MICROFINANCE</h1>
            <p className={styles.tagline}>Empowering Dreams • Building Futures</p>
          </div>
          <h2>Smart Finance. Better Future.</h2>
          <p className={styles.heroText}>
            Secure savings, responsible loans and reliable financial services — in one place.
          </p>
          <div className={styles.heroActions}>
            <Link href="/login" className={styles.loginButton}>Login to Your Account</Link>
            <Link href="/register" className={styles.registerButton}>Get Started</Link>
          </div>
          <p className={styles.loginHint}>Existing customers and staff can sign in with their current account.</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>BUILT FOR EVERYDAY FINANCE</p>
          <h2>Everything you need, in one secure place</h2>
          <p>Manage your financial operations with clear workflows and account-based information.</p>
        </div>
        <div className={styles.moduleGrid}>
          {modules.map(([icon, title, description, href]) => (
            <Link key={title} href={href} className={styles.moduleCard}>
              <span className={styles.moduleIcon}>{icon}</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className={styles.moduleLink}>Sign in to open →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.trustSection}>
        <div>
          <p className={styles.sectionEyebrow}>YOUR ACCOUNT STAYS YOURS</p>
          <h2>Sign in securely. See your real account data.</h2>
          <p>Balances and transaction details are available after sign-in. This public page does not display sample financial totals.</p>
        </div>
        <Link href="/login" className={styles.loginButton}>Open Secure Login →</Link>
      </section>

      <footer className={styles.footer}>
        <img src="/pwfb-app-icon.svg" alt="" />
        <div><strong>LAB MICROFINANCE</strong><span>Empowering Dreams • Building Futures</span></div>
        <small>© {new Date().getFullYear()} LAB MICROFINANCE. All rights reserved.</small>
      </footer>
    </main>
  );
}
