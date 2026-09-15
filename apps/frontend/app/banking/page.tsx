"use client";

import { useEffect, useMemo, useState } from "react";
import { pwfbApi } from "../../lib/pwfb-api";
import BankSearchSelect from "../../components/BankSearchSelect";

type Customer = { id: string; firstName?: string; lastName?: string; name?: string; phone?: string; email?: string };
type Wallet = { balance: number; currency?: string };
type Tx = { id: string; type?: string; amount: number; description?: string; status?: string; reference?: string; createdAt?: string; created_at?: string };
type Bank = { code: string; name: string; shortName?: string; provider?: string };
type Operation = "deposit" | "withdraw" | "transfer" | "bank-transfer";
const operations: Operation[] = ["deposit", "withdraw", "transfer", "bank-transfer"];

function unwrap<T = any>(value: any): T[] { return Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : []; }
function customerName(customer: Customer) { return customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.id; }

export default function BankingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [bankProvider, setBankProvider] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [verifiedAccountNumber, setVerifiedAccountNumber] = useState("");
  const [verifiedBankCode, setVerifiedBankCode] = useState("");
  const [verificationProvider, setVerificationProvider] = useState("");
  const [verified, setVerified] = useState(false);
  const [operation, setOperation] = useState<Operation>("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("operation") as Operation | null;
    if (selected && operations.includes(selected)) setOperation(selected);
    Promise.all([pwfbApi.customers.search(), pwfbApi.banking.institutions()]).then(([customerData, bankData]) => {
      setCustomers(unwrap<Customer>(customerData));
      setBanks(unwrap<any>(bankData).map((bank: any) => ({ code: String(bank.code ?? bank.bankCode ?? ""), name: String(bank.name ?? bank.bankName ?? bank.institutionName ?? ""), shortName: bank.shortName, provider: bank.provider })).filter((bank: Bank) => bank.code && bank.name));
    }).catch(() => setMessage("Some banking reference data could not be loaded."));
  }, []);

  useEffect(() => {
    if (!customerId) { setWallet(null); setTransactions([]); return; }
    Promise.all([pwfbApi.banking.customerWallet(customerId), pwfbApi.banking.customerTransactions(customerId)]).then(([nextWallet, nextTransactions]) => {
      setWallet(nextWallet);
      setTransactions(unwrap<Tx>(nextTransactions));
    }).catch(() => {});
  }, [customerId]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => `${customerName(customer)} ${customer.id} ${customer.phone || ""} ${customer.email || ""}`.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  function clearVerification() {
    setVerified(false); setAccountName(""); setVerifiedAccountNumber(""); setVerifiedBankCode(""); setVerificationProvider("");
  }

  function changeBank(bankCode: string) {
    const selected = banks.find((bank) => bank.code === bankCode);
    setBankCode(bankCode);
    setBankProvider(String(selected?.provider || "").toUpperCase());
    clearVerification();
  }

  function changeAccount(value: string) {
    setAccountNumber(value.replace(/\D/g, "").slice(0, 10));
    clearVerification();
  }

  async function verifyAccount() {
    if (!bankCode) return setMessage("Select the destination bank first.");
    if (!/^\d{10}$/.test(accountNumber)) return setMessage("Enter the complete 10-digit account number.");
    if (!bankProvider) return setMessage("The selected bank has no verification provider. Refresh the bank list and select a provider-backed bank.");
    setVerifying(true); setMessage(""); clearVerification();
    try {
      const result: any = await pwfbApi.banking.accountName(bankCode, accountNumber, bankProvider);
      const name = String(result?.accountName ?? result?.account_name ?? result?.data?.accountName ?? result?.data?.account_name ?? "").trim();
      const returnedNumber = String(result?.accountNumber ?? result?.account_number ?? result?.data?.accountNumber ?? result?.data?.account_number ?? accountNumber).replace(/\D/g, "");
      const provider = String(result?.provider ?? result?.data?.provider ?? bankProvider).trim().toUpperCase();
      if (!name) throw new Error("The bank provider did not return a verified account name.");
      if (returnedNumber !== accountNumber) throw new Error("The bank provider returned a different account number. Verification was rejected.");
      if (provider !== bankProvider) throw new Error(`Provider mismatch: selected ${bankProvider}, received ${provider}. Verification was rejected.`);
      setAccountName(name); setVerifiedAccountNumber(returnedNumber); setVerifiedBankCode(bankCode); setVerificationProvider(provider); setVerified(true);
      setMessage(`Account verified: ${name}`);
    } catch (error) { clearVerification(); setMessage(error instanceof Error ? error.message : "Account verification failed."); }
    finally { setVerifying(false); }
  }

  function choose(next: Operation) {
    setOperation(next); setMessage(""); if (next !== "transfer") clearVerification();
    const url = new URL(window.location.href); url.searchParams.set("operation", next); window.history.replaceState({}, "", url.toString());
  }

  async function submit() {
    if (!customerId) return setMessage("Select a customer first.");
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return setMessage("Enter a valid amount greater than zero.");
    if (!reference.trim()) return setMessage("Enter a transaction reference.");
    if (operation !== "transfer") {
      if (!bankCode || !/^\d{10}$/.test(accountNumber)) return setMessage("Select a bank and enter a valid 10-digit account number.");
      if (!bankProvider) return setMessage("The selected bank has no verification provider.");
      if (!verified || verifiedAccountNumber !== accountNumber || verifiedBankCode !== bankCode || verificationProvider !== bankProvider) return setMessage("Verify this exact bank account with the selected provider before processing the operation.");
    }
    if (operation === "transfer" && !recipientId) return setMessage("Select a transfer recipient.");
    if (operation === "withdraw" && wallet && numericAmount > wallet.balance) return setMessage("Insufficient wallet balance.");
    setLoading(true); setMessage("");
    try {
      const common = { amount: numericAmount, description, reference: reference.trim(), provider: bankProvider };
      if (operation === "deposit") await pwfbApi.banking.deposit(customerId, { ...common, bankCode, accountNumber, accountName });
      else if (operation === "withdraw") await pwfbApi.banking.withdraw(customerId, { ...common, bankCode, accountNumber, accountName });
      else if (operation === "bank-transfer") await pwfbApi.banking.bankTransfer(customerId, { ...common, bankCode, accountNumber, accountName });
      else await pwfbApi.banking.transfer(customerId, { ...common, recipientCustomerId: recipientId });
      const [nextWallet, nextTransactions] = await Promise.all([pwfbApi.banking.customerWallet(customerId), pwfbApi.banking.customerTransactions(customerId)]);
      setWallet(nextWallet); setTransactions(unwrap<Tx>(nextTransactions));
      setAmount(""); setDescription(""); setReference(""); setAccountNumber(""); clearVerification();
      setMessage("Operation completed successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Operation could not be completed."); }
    finally { setLoading(false); }
  }

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const title = { deposit: "Deposit Funds", withdraw: "Withdraw Funds", transfer: "Customer Transfer", "bank-transfer": "Bank Transfer" }[operation];

  return <main className="pwfb-banking-page">
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">PWFB BANKING • OPERATIONS</p><h1 className="pwfb-page-title">Banking Operations</h1><p className="pwfb-page-description">Manage deposits, withdrawals and transfers with live account verification.</p></div><div className="pwfb-banking-brand-mark"><span>PWFB</span><small>FINANCIAL OPERATIONS</small></div></div>
    <section className="pwfb-banking-hero"><div className="pwfb-banking-step"><span className="pwfb-step-number">01</span><div style={{width:"100%"}}><label>Select Customer</label><input className="pwfb-input" value={customerSearch} onChange={(e)=>setCustomerSearch(e.target.value)} placeholder="Search customer by name, ID, phone or email" style={{marginBottom:8}}/><select className="pwfb-input" value={customerId} onChange={(e)=>setCustomerId(e.target.value)}><option value="">Choose a customer account</option>{filteredCustomers.map((customer)=><option key={customer.id} value={customer.id}>{customerName(customer)} • {customer.id}</option>)}</select></div></div>{selectedCustomer && wallet ? <div className="pwfb-banking-balance"><small>AVAILABLE WALLET BALANCE</small><strong>{wallet.currency || "NGN"} {Number(wallet.balance || 0).toLocaleString()}</strong><span>{customerName(selectedCustomer)} • Active account</span></div> : <div className="pwfb-banking-hero-note"><b>Ready for banking operations</b><span>Select a customer to begin.</span></div>}</section>
    <section className="pwfb-panel pwfb-operation-panel"><div className="pwfb-panel-header"><div><p className="pwfb-eyebrow">TRANSACTION WORKFLOW</p><h2>Choose Banking Operation</h2><p>Select the service you want to perform.</p></div></div><div className="pwfb-banking-operation-grid">{operations.map((item)=><button key={item} type="button" className={`pwfb-banking-operation ${operation===item?"pwfb-banking-operation-active":""} ${item==="deposit"?"pwfb-op-deposit":""}`} onClick={()=>choose(item)}><span>{item==="deposit"?"＋":item==="withdraw"?"−":item==="transfer"?"↔":"⌁"}</span><strong>{item==="bank-transfer"?"Bank Transfer":item[0].toUpperCase()+item.slice(1)}</strong><small>{item==="deposit"?"Add funds to customer wallet":item==="withdraw"?"Withdraw customer funds":item==="transfer"?"Move funds between customers":"Send funds to external bank"}</small></button>)}</div></section>
    <section className="pwfb-panel pwfb-deposit-card"><div className="pwfb-panel-header pwfb-operation-header"><div><p className="pwfb-eyebrow">02 / {operation.toUpperCase()}</p><h2>{title}</h2><p>Account names are never hard-coded. Click Verify Account to query the selected provider for this exact 10-digit account.</p></div><span className="pwfb-operation-badge">{operation.toUpperCase()}</span></div>
      <div className="pwfb-banking-form-grid">
        {operation !== "transfer" && <>
          <div className="pwfb-form-field-wide"><label className="pwfb-label">Bank Search</label><BankSearchSelect banks={banks} value={bankCode} onChange={changeBank} /></div>
          <div><label className="pwfb-label">Account Number</label><input className="pwfb-input" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e)=>changeAccount(e.target.value)} placeholder="10-digit account number"/><button type="button" className="pwfb-primary-button" style={{marginTop:10,width:"100%"}} disabled={verifying || !bankCode || !bankProvider || !/^\d{10}$/.test(accountNumber)} onClick={verifyAccount}>{verifying?"Verifying…":"Verify Account"}</button></div>
          <div><label className="pwfb-label">Verified Account Name</label><div className={`pwfb-verify-field ${verified?"verified":""}`}>{verified?accountName:verifying?"Verifying with bank…":"Not verified"}{verified&&<b>✓</b>}</div>{bankProvider&&<small style={{display:"block",marginTop:6}}>Provider: {bankProvider}</small>}{verified&&<small style={{display:"block",marginTop:4}}>Verified for {verifiedAccountNumber} • {verificationProvider}</small>}</div>
        </>}
        {operation === "transfer" && <div><label className="pwfb-label">Transfer Recipient</label><select className="pwfb-input" value={recipientId} onChange={(e)=>setRecipientId(e.target.value)}><option value="">Select PWFB customer</option>{customers.filter(c=>c.id!==customerId).map(c=><option key={c.id} value={c.id}>{customerName(c)} • {c.id}</option>)}</select></div>}
        <div><label className="pwfb-label">Amount</label><div className="pwfb-amount-input"><span>₦</span><input className="pwfb-input" type="number" min="0" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00"/></div></div>
        <div><label className="pwfb-label">Transaction Reference</label><input className="pwfb-input" value={reference} onChange={(e)=>setReference(e.target.value)} placeholder="e.g. PWFB-DEP-001"/></div>
        <div className="pwfb-form-field-wide"><label className="pwfb-label">Narration</label><input className="pwfb-input" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Optional transaction description"/></div>
      </div>
      {message&&<div className="pwfb-security-note" style={{marginTop:16}}>{message}</div>}
      <div className="pwfb-deposit-actions"><div className="pwfb-security-note">🔐 <span>Live verification required • The verified name must belong to the exact bank/account number currently entered.</span></div><button type="button" className="pwfb-primary-button" disabled={loading} onClick={submit}>{loading?"Processing…":"Process Operation"}</button></div>
    </section>
    <section className="pwfb-panel" style={{marginTop:20}}><div className="pwfb-panel-header"><div><p className="pwfb-eyebrow">ACCOUNT ACTIVITY</p><h2>Recent Transactions</h2></div></div>{transactions.length===0?<p>No transactions found for this customer.</p>:<div style={{overflowX:"auto"}}><table className="pwfb-table"><thead><tr><th>Type</th><th>Reference</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{transactions.slice(0,20).map((tx)=><tr key={tx.id}><td>{tx.type||"—"}</td><td>{tx.reference||tx.id}</td><td>₦{Number(tx.amount||0).toLocaleString()}</td><td>{tx.status||"—"}</td><td>{tx.createdAt||tx.created_at?new Date(tx.createdAt||tx.created_at!).toLocaleString():"—"}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
