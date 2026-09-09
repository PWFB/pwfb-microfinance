"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api";
import styles from "./page.module.css";

type CustomerForm = { firstName: string; middleName: string; lastName: string; email: string; phone: string; address: string; dateOfBirth: string };
const initialForm: CustomerForm = { firstName: "", middleName: "", lastName: "", email: "", phone: "", address: "", dateOfBirth: "" };

export default function AddCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState<CustomerForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const fullName = useMemo(() => [form.firstName, form.middleName, form.lastName].filter(Boolean).join(" "), [form.firstName, form.middleName, form.lastName]);
  const initials = useMemo(() => [form.firstName, form.lastName].filter(Boolean).map((v) => v[0]?.toUpperCase()).join("") || "P", [form.firstName, form.lastName]);
  const completed = [form.firstName, form.lastName, form.phone].filter(Boolean).length;
  const change = (name: keyof CustomerForm, value: string) => { setForm((current) => ({ ...current, [name]: value })); setMessage(""); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    try { await apiRequest("/customers", { method: "POST", body: JSON.stringify(form) }); setMessage("Customer profile created successfully."); window.setTimeout(() => router.push("/customers"), 900); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create customer."); }
    finally { setLoading(false); }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.breadcrumb}><Link href="/customers">Customers</Link><span>/</span><b>Add Customer</b></div>
          <div className={styles.titleRow}><div className={styles.titleIcon}>+</div><div><h1>Add New Customer</h1><p>Register a customer and create their central PWFB financial profile.</p></div></div>
        </div>
        <Link href="/customers" className={styles.backButton}>← Back to Customers</Link>
      </div>

      <div className={styles.progressCard}>
        <div className={styles.progressIntro}><span className={styles.progressBadge}>NEW PROFILE</span><strong>Customer registration</strong><small>Complete the required details to activate the profile.</small></div>
        <div className={styles.steps}><div className={`${styles.step} ${styles.stepActive}`}><span>01</span><b>Personal</b></div><i /><div className={`${styles.step} ${completed >= 3 ? styles.stepDone : ""}`}><span>02</span><b>Contact</b></div><i /><div className={`${styles.step} ${form.dateOfBirth ? styles.stepDone : ""}`}><span>03</span><b>Review</b></div></div>
      </div>

      <div className={styles.layout}>
        <form className={styles.formCard} onSubmit={submit}>
          <section className={styles.section}>
            <div className={styles.sectionHead}><div className={styles.number}>01</div><div><h2>Personal Information</h2><p>Use the customer’s legal name as it should appear on PWFB records.</p></div></div>
            <div className={styles.gridThree}>
              <label>First Name <em>*</em><input value={form.firstName} onChange={(e) => change("firstName", e.target.value)} placeholder="Enter first name" autoComplete="given-name" required /></label>
              <label>Middle Name <small>Optional</small><input value={form.middleName} onChange={(e) => change("middleName", e.target.value)} placeholder="Enter middle name" autoComplete="additional-name" /></label>
              <label>Last Name <em>*</em><input value={form.lastName} onChange={(e) => change("lastName", e.target.value)} placeholder="Enter last name" autoComplete="family-name" required /></label>
            </div>
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHead}><div className={styles.number}>02</div><div><h2>Contact Information</h2><p>These details are used for account communication and customer identification.</p></div></div>
            <div className={styles.gridTwo}>
              <label>Phone Number <em>*</em><div className={styles.inputWithPrefix}><span>NG</span><input value={form.phone} onChange={(e) => change("phone", e.target.value)} placeholder="0800 000 0000" inputMode="tel" autoComplete="tel" required /></div></label>
              <label>Email Address <small>Optional</small><input type="email" value={form.email} onChange={(e) => change("email", e.target.value)} placeholder="customer@example.com" autoComplete="email" /></label>
              <label className={styles.full}>Residential Address <small>Optional</small><textarea value={form.address} onChange={(e) => change("address", e.target.value)} placeholder="Enter full residential address" rows={3} /></label>
            </div>
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHead}><div className={styles.number}>03</div><div><h2>Customer Details</h2><p>Complete the profile information before creating the customer record.</p></div></div>
            <div className={styles.gridTwo}>
              <label>Date of Birth <small>Optional</small><input type="date" value={form.dateOfBirth} onChange={(e) => change("dateOfBirth", e.target.value)} /></label>
              <div className={styles.infoBox}><span>✓</span><div><b>Ready for financial services</b><small>The customer can later be linked to savings, loans, deposits and transactions.</small></div></div>
            </div>
          </section>
          {message && <div className={message.includes("successfully") ? styles.success : styles.error}>{message}</div>}
          <div className={styles.footer}><span>Fields marked <b>*</b> are required.</span><div><Link href="/customers" className={styles.cancel}>Cancel</Link><button type="submit" disabled={loading}>{loading ? "Creating Customer…" : "Create Customer"}</button></div></div>
        </form>

        <aside className={styles.previewCard}>
          <div className={styles.previewHeader}><span>PROFILE PREVIEW</span><b>PWFB</b></div>
          <div className={styles.avatar}>{initials}</div><h2>{fullName || "New Customer"}</h2><p>{form.phone || "Phone number will appear here"}</p>
          <div className={styles.status}><span /> Profile ready to create</div><div className={styles.previewDivider} />
          <div className={styles.serviceTitle}>Customer will be available for</div>
          <ul><li><span>↓</span> Deposits & withdrawals</li><li><span>₦</span> Savings accounts</li><li><span>▣</span> Loan applications</li><li><span>↔</span> Transfers & transactions</li></ul>
          <div className={styles.tip}><b>Before you save</b><p>Confirm the customer’s name and phone number are correct.</p></div>
        </aside>
      </div>
    </main>
  );
}
