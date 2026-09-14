"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { pwfbApi } from "../../../lib/pwfb-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const TYPES = ["Loan", "Daily Loan", "Weekly Loan", "Individual Loan", "Monthly Loan"];

type Rate = { loanType: string; interestRate: number };
type Customer = { id: string; firstName?: string; lastName?: string; name?: string; phone?: string; email?: string };
type Bank = { code: string; name: string; shortName?: string };

const fullName = (c: Customer) => c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.id;

export default function AddLoanPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loanType, setLoanType] = useState("Loan");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [frequency, setFrequency] = useState("Weekly");
  const [purpose, setPurpose] = useState("");
  const [passport, setPassport] = useState("");
  const [destination, setDestination] = useState<"WALLET" | "BANK">("WALLET");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [verifiedNumber, setVerifiedNumber] = useState("");
  const [verifiedBank, setVerifiedBank] = useState("");
  const [provider, setProvider] = useState("");
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [rates, setRates] = useState<Rate[]>([]);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    pwfbApi.customers.search()
      .then((d: any) => setCustomers(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []))
      .catch(() => {});

    fetch(`${API_URL}/loans/rates`, { headers })
      .then((r) => r.json())
      .then((d) => setRates(Array.isArray(d) ? d : []))
      .catch(() => {});

    pwfbApi.banking.institutions()
      .then((d: any) => {
        const list = Array.isArray(d) ? d : d?.data || [];
        setBanks(
          list
            .map((b: any) => ({
              code: String(b.code ?? b.bankCode ?? ""),
              name: String(b.name ?? b.bankName ?? ""),
              shortName: b.shortName ? String(b.shortName) : undefined,
            }))
            .filter((b: Bank) => b.code && b.name),
        );
      })
      .catch(() => {});
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => `${fullName(c)} ${c.id} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => `${b.name} ${b.shortName || ""} ${b.code}`.toLowerCase().includes(q));
  }, [banks, bankSearch]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const rate = Number(rates.find((r) => r.loanType === loanType)?.interestRate ?? 0);
  const principal = Number(amount || 0);
  const interest = principal * rate / 100;
  const total = principal + interest;
  const installment = total / Math.max(1, Number(duration || 1));

  function resetVerification() {
    setVerified(false);
    setAccountName("");
    setVerifiedNumber("");
    setVerifiedBank("");
    setProvider("");
  }

  async function verify() {
    setMessage("");
    resetVerification();
    const number = accountNumber.replace(/\D/g, "");
    if (!bankCode) return setMessage("Select a bank before verification.");
    if (!/^\d{10}$/.test(number)) return setMessage("Enter the complete 10-digit account number.");

    setVerifying(true);
    try {
      const customerQuery = customerId ? `&customerId=${encodeURIComponent(customerId)}` : "";
      const response = await fetch(
        `${API_URL}/loans/verify-bank-account?bankCode=${encodeURIComponent(bankCode)}&accountNumber=${encodeURIComponent(number)}${customerQuery}`,
        { headers, cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Account verification failed");

      const returned = String(data.accountNumber || "").replace(/\D/g, "");
      if (returned !== number) throw new Error("The provider did not return the exact account number entered. Verification rejected.");

      const name = String(data.accountName || "").trim();
      if (!name || data.eligible === false) throw new Error(data.message || "Account could not be verified for this customer.");

      setAccountName(name);
      setVerifiedNumber(returned);
      setVerifiedBank(bankCode);
      setProvider(String(data.provider || ""));
      setVerified(true);
      setMessage(`Verified: ${name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  function file(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPassport(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!customerId) return setMessage("Select a PWFB customer before creating the loan.");
    if (destination === "BANK" && (!verified || verifiedNumber !== accountNumber || verifiedBank !== bankCode)) {
      return setMessage("Verify the exact bank and account number before creating a bank-disbursed loan.");
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/loans`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          amount: principal,
          loanType,
          duration: Number(duration),
          repaymentFrequency: frequency,
          purpose,
          passportPhoto: passport,
          disbursementDestination: destination,
          disbursementBankCode: destination === "BANK" ? bankCode : undefined,
          disbursementBankName: destination === "BANK" ? bankName : undefined,
          disbursementAccountNumber: destination === "BANK" ? accountNumber : undefined,
          disbursementAccountName: destination === "BANK" ? accountName : undefined,
          verifiedNameMatchCount: destination === "BANK" ? 1 : 0,
          disbursementAccountVerified: destination === "BANK" ? verified : false,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to create loan");
      setMessage("Loan created successfully. Continue with guarantor registration.");
      setTimeout(() => router.push(`/loans/guarantor/add?loanId=${encodeURIComponent(data.id)}`), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create loan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="pwfb-loan-module">
      <style jsx>{`
        .pwfb-loan-module{max-width:1240px;margin:auto;padding:4px 0 48px}
        .hero{background:linear-gradient(135deg,#075b2a,#13813d);border-radius:24px;padding:28px;color:#fff;display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:18px}
        .hero h1{margin:4px 0;font-size:30px}.hero p{margin:0;color:#d5f0df;font-size:12px}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:900;color:#ffd39d}
        .grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(290px,.8fr);gap:18px}.card{background:#fff;border:1px solid #e3ebe6;border-radius:20px;box-shadow:0 10px 30px rgba(5,63,36,.06);padding:22px}
        .section{border-bottom:1px solid #edf2ef;padding-bottom:20px;margin-bottom:20px}.section:last-child{border-bottom:0;margin-bottom:0}.section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.section-head h2{margin:0;color:#173a2e;font-size:17px}.section-head p{margin:4px 0 0;color:#7a8780;font-size:11px}
        .fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.wide{grid-column:1/-1}.label{display:block;font-size:10px;font-weight:900;color:#596960;margin-bottom:6px}
        .input,.select,.textarea{width:100%;box-sizing:border-box;border:1px solid #dbe5df;border-radius:11px;padding:12px;background:#fbfdfc;font-size:13px;color:#21372d;outline:none}.textarea{min-height:90px;resize:vertical}.input:focus,.select:focus,.textarea:focus{border-color:#0b7b48;box-shadow:0 0 0 3px rgba(11,123,72,.08)}
        .results{border:1px solid #e0e8e3;border-radius:11px;margin-top:6px;overflow:hidden;background:#fff}.result{width:100%;border:0;border-bottom:1px solid #edf1ef;background:#fff;text-align:left;padding:10px 12px;cursor:pointer}.result:last-child{border-bottom:0}.result strong{display:block;color:#075b2a;font-size:12px}.result small{color:#7a8780}
        .destination{border:1px solid #dfe8e2;border-radius:14px;padding:15px;background:#fbfdfc}.toggle{display:flex;gap:8px;margin-bottom:14px}.toggle button{flex:1;padding:11px;border-radius:10px;border:1px solid #dce5e0;background:#fff;font-weight:800;cursor:pointer}.toggle .active{background:#087348;color:#fff;border-color:#087348}
        .verify{margin-top:10px;padding:14px;border-radius:12px;background:#f4fbf7;border:1px solid #d5ebde}.verify.failed{background:#fff7f7;border-color:#ffd4d4}.verify strong{color:#075b2a}.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}.stat{border:1px solid #e1e9e4;border-radius:13px;padding:14px}.stat span{display:block;color:#7c8982;font-size:10px}.stat b{display:block;color:#173a2e;font-size:17px;margin-top:5px}
        .side{background:linear-gradient(160deg,#073b2a,#0b5b40);color:#fff}.side h2,.side h3{color:#fff}.side p,.side li{color:#d1e6da;font-size:11px;line-height:1.6}.side strong{color:#f7931e}.actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.primary{border:0;border-radius:11px;background:#f7931e;color:#fff;padding:12px 18px;font-weight:900;cursor:pointer}.primary:disabled{opacity:.55;cursor:not-allowed}.secondary{border:1px solid #dce5e0;border-radius:11px;padding:12px 18px;color:#52625a;text-decoration:none;font-weight:800}.message{padding:11px 13px;border-radius:10px;background:#f2f8f4;border:1px solid #d7e9dd;color:#075b2a;font-size:12px;margin-top:14px}
        @media(max-width:900px){.grid{grid-template-columns:1fr}.side{order:-1}}@media(max-width:650px){.fields{grid-template-columns:1fr}.hero{padding:21px}.card{padding:17px}.actions>*{flex:1;text-align:center}}
      `}</style>

      <div className="hero">
        <div>
          <p className="eyebrow">PWFB LOANS · CREDIT OPERATIONS</p>
          <h1>Add Loan</h1>
          <p>Create a structured loan application, verify the borrower and confirm the disbursement destination.</p>
        </div>
        <Link href="/loans" className="secondary">← Loan Overview</Link>
      </div>

      <div className="grid">
        <form className="card" onSubmit={submit}>
          <section className="section">
            <div className="section-head"><div><h2>01 · Borrower</h2><p>Search and select the registered customer.</p></div></div>
            <label className="label">CUSTOMER SEARCH *</label>
            <input className="input" value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId(""); resetVerification(); }} placeholder="Search name, customer ID, phone or email" autoComplete="off" />
            {customerSearch && !customerId && (
              <div className="results">
                {filteredCustomers.slice(0, 8).map((customer) => (
                  <button type="button" className="result" key={customer.id} onClick={() => { setCustomerId(customer.id); setCustomerSearch(fullName(customer)); resetVerification(); }}>
                    <strong>{fullName(customer)}</strong>
                    <small>{customer.id}{customer.phone ? ` · ${customer.phone}` : ""}</small>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && <div className="verify"><strong>✓ {fullName(selectedCustomer)}</strong><div style={{fontSize:11,color:"#68766f",marginTop:4}}>Customer ID: {selectedCustomer.id}</div></div>}
          </section>

          <section className="section">
            <div className="section-head"><div><h2>02 · Loan Terms</h2><p>Enter the approved principal and repayment schedule.</p></div></div>
            <div className="fields">
              <div><label className="label">LOAN TYPE</label><select className="select" value={loanType} onChange={(e) => setLoanType(e.target.value)}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
              <div><label className="label">LOAN AMOUNT (₦)</label><input className="input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required /></div>
              <div><label className="label">INSTALLMENTS</label><input className="input" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Number of installments" required /></div>
              <div><label className="label">REPAYMENT FREQUENCY</label><select className="select" value={frequency} onChange={(e) => setFrequency(e.target.value)}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></div>
              <div className="wide"><label className="label">LOAN PURPOSE</label><textarea className="textarea" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Why is the customer taking this loan?" required /></div>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><div><h2>03 · Disbursement</h2><p>Choose where the approved loan will be sent.</p></div></div>
            <div className="destination">
              <div className="toggle">
                <button type="button" className={destination === "WALLET" ? "active" : ""} onClick={() => { setDestination("WALLET"); resetVerification(); }}>PWFB Wallet</button>
                <button type="button" className={destination === "BANK" ? "active" : ""} onClick={() => setDestination("BANK")}>Bank Account</button>
              </div>

              {destination === "BANK" && (
                <div className="fields">
                  <div className="wide">
                    <label className="label">BANK SEARCH *</label>
                    <input className="input" value={bankSearch} onChange={(e) => setBankSearch(e.target.value)} placeholder="Search bank name, short name or code" />
                    <select className="select" style={{marginTop:7}} value={bankCode} onChange={(e) => { const bank = banks.find((item) => item.code === e.target.value); setBankCode(e.target.value); setBankName(bank?.name || ""); setAccountNumber(""); resetVerification(); }} required>
                      <option value="">Select bank</option>
                      {filteredBanks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}{bank.shortName ? ` (${bank.shortName})` : ""} · {bank.code}</option>)}
                    </select>
                  </div>
                  <div><label className="label">10-DIGIT ACCOUNT NUMBER *</label><input className="input" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10)); resetVerification(); }} placeholder="0000000000" /></div>
                  <div style={{display:"flex",alignItems:"end"}}><button type="button" className="primary" style={{width:"100%"}} disabled={verifying || !bankCode || !/^\d{10}$/.test(accountNumber)} onClick={verify}>{verifying ? "Verifying…" : "Verify Account"}</button></div>
                </div>
              )}

              {accountName && (
                <div className={`verify ${verified ? "" : "failed"}`} style={{marginTop:14}}>
                  <strong>{verified ? "✓ VERIFIED" : "✕ NOT VERIFIED"} · {accountName}</strong>
                  <div style={{fontSize:11,color:"#68766f",marginTop:5}}>Bank: {bankName} · Account: ********{verifiedNumber.slice(-4)}</div>
                  {provider && <div style={{fontSize:10,color:"#68766f",marginTop:3}}>Provider: {provider}</div>}
                </div>
              )}
            </div>
          </section>

          <section className="section">
            <div className="section-head"><div><h2>04 · Customer Photo</h2><p>Attach a passport image where required.</p></div></div>
            <input type="file" accept="image/*" capture="user" onChange={(e) => file(e.target.files?.[0])} />
            {passport && <div className="verify">✓ Passport image captured</div>}
          </section>

          {message && <div className="message">{message}</div>}
          <div className="actions"><Link href="/loans" className="secondary">Cancel</Link><button className="primary" type="submit" disabled={saving}>{saving ? "Creating…" : "Create Loan & Continue"}</button></div>
        </form>

        <aside className="card side">
          <h2>Loan Summary</h2>
          <p>Review the application before creating the loan.</p>
          <div className="stats">
            <div className="stat"><span>PRINCIPAL</span><b>₦{principal.toLocaleString("en-NG")}</b></div>
            <div className="stat"><span>INTEREST</span><b>{rate}%</b></div>
            <div className="stat"><span>INTEREST VALUE</span><b>₦{interest.toLocaleString("en-NG")}</b></div>
            <div className="stat"><span>TOTAL REPAYMENT</span><b>₦{total.toLocaleString("en-NG")}</b></div>
            <div className="stat" style={{gridColumn:"1/-1"}}><span>EST. INSTALLMENT</span><b>₦{installment.toLocaleString("en-NG")}</b></div>
          </div>
          <h3 style={{marginTop:22}}>Verification rules</h3>
          <ul><li>Customer must be selected before the loan is created.</li><li>Bank disbursement requires an explicit account verification.</li><li>The provider account number must exactly match the entered number.</li><li>Changing the bank or account clears the previous verification.</li></ul>
        </aside>
      </div>
    </main>
  );
}
