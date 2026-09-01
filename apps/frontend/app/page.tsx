import Link from "next/link";
import styles from "./home.module.css";

const androidDownloadUrl =
  "https://github.com/PWFB/pwfb-microfinance/releases/download/v1.0.0/app-release.apk";

const modules = [
  ["👥", "Customers", "Manage customer profiles and KYC.", "/customers"],
  ["💰", "Savings", "Create and manage savings accounts.", "/savings"],
  ["🏦", "Loans", "Loan applications and approvals.", "/loans"],
  ["💳", "Transactions", "View deposits, withdrawals and transfers.", "/transactions"],
];

const stats = [
  ["Total Customers", "2,453", "green"],
  ["Total Savings", "₦245M", "green"],
  ["Total Loans", "₦158M", "orange"],
  ["Transactions", "8,732", "green"],
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
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/savings">Savings</Link>
          <Link href="/loans">Loans</Link>
          <Link href="/transactions">Transactions</Link>
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
            <a
              href={androidDownloadUrl}
              className={styles.downloadButton}
              download="PWFB-Microfinance-v1.0.0.apk"
            >
              Download App
            </a>
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
          <p className={styles.sectionEyebrow}>AT A GLANCE</p>
          <h2>Dashboard Overview</h2>
        </div>

        <div className={styles.statsGrid}>
          {stats.map(([label, value, tone]) => (
            <div key={label} className={styles.statCard}>
              <h3>{label}</h3>
              <strong className={tone === "orange" ? styles.orangeValue : styles.greenValue}>
                {value}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        © {new Date().getFullYear()} PWFB Microfinance • Perfect Wisdom For Better Limited
      </footer>
    </main>
  );
}
