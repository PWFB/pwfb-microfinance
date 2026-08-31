"use client";

import { useEffect, useMemo, useState } from "react";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
};

type Wallet = {
  balance: number;
  currency?: string;
};

type Tx = {
  id: string;
  type?: string;
  amount: number;
  description?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
};

type Bank = {
  code: string;
  name: string;
  shortName?: string;
};

type Operation = "deposit" | "withdraw" | "transfer" | "bank-transfer";

const operations: Operation[] = ["deposit", "withdraw", "transfer", "bank-transfer"];

export default function BankingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [operation, setOperation] = useState<Operation>("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const selectedOperation = new URLSearchParams(window.location.search).get("operation");

    if (operations.includes(selectedOperation as Operation)) {
      setOperation(selectedOperation as Operation);
    }

    pwfbApi.customers
      .search()
      .then((data) => {
        setCustomers(Array.isArray(data) ? data : data?.data ?? []);
      })
      .catch(() => {});

    pwfbApi.banking
      .institutions()
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.data ?? [];
        const normalizedBanks = items
          .map((bank: any) => ({
            code: String(bank.code ?? bank.bankCode ?? ""),
            name: String(bank.name ?? bank.bankName ?? bank.institutionName ?? ""),
            shortName: bank.shortName,
          }))
          .filter((bank: Bank) => bank.code && bank.name);

        setBanks(normalizedBanks);
      })
      .catch(() => setBanks([]));
  }, []);

  useEffect(() => {
    if (!customerId) {
      setWallet(null);
      setTransactions([]);
      return;
    }

    Promise.all([
      pwfbApi.banking.customerWallet(customerId),
      pwfbApi.banking.customerTransactions(customerId),
    ])
      .then(([customerWallet, customerTransactions]) => {
        setWallet(customerWallet);
        setTransactions(
          Array.isArray(customerTransactions)
            ? customerTransactions
            : customerTransactions?.data ?? [],
        );
      })
      .catch(() => {});
  }, [customerId]);

  useEffect(() => {
    if (!bankCode || !/^[0-9]{10}$/.test(accountNumber)) {
      return;
    }

    let stopped = false;
    setVerifying(true);
    setAccountName("");

    pwfbApi.banking
      .accountName(bankCode, accountNumber)
      .then((result: any) => {
        if (!stopped) {
          setAccountName(String(result?.accountName ?? result?.data?.accountName ?? ""));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!stopped) {
          setVerifying(false);
        }
      });

    return () => {
      stopped = true;
    };
  }, [bankCode, accountNumber]);

  const filteredBanks = useMemo(() => {
    const query = bankSearch.toLowerCase().trim();

    if (!query) {
      return banks;
    }

    return banks.filter((bank) =>
      `${bank.name} ${bank.shortName || ""} ${bank.code}`
        .toLowerCase()
        .includes(query),
    );
  }, [banks, bankSearch]);

  const customerName = (customer: Customer) =>
    customer.name ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.id;

  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  const title = {
    deposit: "Deposit Funds",
    withdraw: "Withdraw Funds",
    transfer: "Customer Transfer",
    "bank-transfer": "Bank Transfer",
  }[operation];

  function choose(nextOperation: Operation) {
    setOperation(nextOperation);
    setMessage("");

    const url = new URL(window.location.href);
    url.searchParams.set("operation", nextOperation);
    window.history.replaceState({}, "", url.toString());
  }

  async function submit() {
    if (!customerId) {
      setMessage("Select a customer first.");
      return;
    }

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setMessage("Enter a valid amount greater than zero.");
      return;
    }

    if (!reference.trim()) {
      setMessage("Enter a transaction reference.");
      return;
    }

    if (
      operation !== "transfer" &&
      (!bankCode || !/^[0-9]{10}$/.test(accountNumber))
    ) {
      setMessage("Select a bank and enter a valid 10-digit account number.");
      return;
    }

    if (
      (operation === "withdraw" || operation === "bank-transfer") &&
      !accountName
    ) {
      setMessage("Verify the bank account name before continuing.");
      return;
    }

    if (operation === "withdraw" && wallet && numericAmount > wallet.balance) {
      setMessage("Insufficient wallet balance.");
      return;
    }

    if (operation === "transfer" && !recipientId) {
      setMessage("Select a transfer recipient.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const common = {
        amount: numericAmount,
        description,
        reference: reference.trim(),
      };

      if (operation === "deposit") {
        await pwfbApi.banking.deposit(customerId, {
          ...common,
          bankCode,
          accountNumber,
          accountName,
        });
      } else if (operation === "withdraw") {
        await pwfbApi.banking.withdraw(customerId, {
          ...common,
          bankCode,
          accountNumber,
          accountName,
        });
      } else if (operation === "bank-transfer") {
        await pwfbApi.banking.bankTransfer(customerId, {
          ...common,
          bankCode,
          accountNumber,
          accountName,
        });
      } else {
        await pwfbApi.banking.transfer(customerId, {
          ...common,
          recipientCustomerId: recipientId,
        });
      }

      const [updatedWallet, updatedTransactions] = await Promise.all([
        pwfbApi.banking.customerWallet(customerId),
        pwfbApi.banking.customerTransactions(customerId),
      ]);

      setWallet(updatedWallet);
      setTransactions(
        Array.isArray(updatedTransactions)
          ? updatedTransactions
          : updatedTransactions?.data ?? [],
      );
      setAmount("");
      setDescription("");
      setReference("");
      setAccountNumber("");
      setAccountName("");
      setMessage("Operation completed successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Operation could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pwfb-banking-page">
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">PWFB BANKING • OPERATIONS</p>
          <h1 className="pwfb-page-title">Banking Operations</h1>
          <p className="pwfb-page-description">
            Manage deposits, withdrawals and transfers from one secure banking workspace.
          </p>
        </div>
        <div className="pwfb-banking-brand-mark">
          <span>PWFB</span>
          <small>FINANCIAL OPERATIONS</small>
        </div>
      </div>

      <section className="pwfb-banking-hero">
        <div className="pwfb-banking-step">
          <span className="pwfb-step-number">01</span>
          <div>
            <label>Select Customer</label>
            <select
              className="pwfb-input"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Choose a customer account</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customerName(customer)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCustomer && wallet ? (
          <div className="pwfb-banking-balance">
            <small>AVAILABLE WALLET BALANCE</small>
            <strong>
              {wallet.currency || "NGN"} {Number(wallet.balance || 0).toLocaleString()}
            </strong>
            <span>{customerName(selectedCustomer)} • Active account</span>
          </div>
        ) : (
          <div className="pwfb-banking-hero-note">
            <b>Ready for banking operations</b>
            <span>Select a customer to begin.</span>
          </div>
        )}
      </section>

      <section className="pwfb-panel pwfb-operation-panel">
        <div className="pwfb-panel-header">
          <div>
            <p className="pwfb-eyebrow">TRANSACTION WORKFLOW</p>
            <h2>Choose Banking Operation</h2>
            <p>Select the service you want to perform for this customer.</p>
          </div>
        </div>

        <div className="pwfb-banking-operation-grid">
          {operations.map((item) => (
            <button
              key={item}
              type="button"
              className={`pwfb-banking-operation ${
                operation === item ? "pwfb-banking-operation-active" : ""
              } ${item === "deposit" ? "pwfb-op-deposit" : ""}`}
              onClick={() => choose(item)}
            >
              <span>
                {item === "deposit"
                  ? "＋"
                  : item === "withdraw"
                    ? "−"
                    : item === "transfer"
                      ? "↔"
                      : "⌁"}
              </span>
              <strong>
                {item === "bank-transfer"
                  ? "Bank Transfer"
                  : item[0].toUpperCase() + item.slice(1)}
              </strong>
              <small>
                {item === "deposit"
                  ? "Add funds to customer wallet"
                  : item === "withdraw"
                    ? "Withdraw customer funds"
                    : item === "transfer"
                      ? "Move funds between customers"
                      : "Send funds to external bank"}
              </small>
            </button>
          ))}
        </div>
      </section>

      <section className="pwfb-panel pwfb-deposit-card">
        <div className="pwfb-panel-header pwfb-operation-header">
          <div>
            <p className="pwfb-eyebrow">02 / {operation.toUpperCase()}</p>
            <h2>{title}</h2>
            <p>
              Enter the transaction information below and verify all banking details before processing.
            </p>
          </div>
          <span className="pwfb-operation-badge">{operation.toUpperCase()}</span>
        </div>

        <div className="pwfb-banking-form-grid">
          {operation !== "transfer" && (
            <>
              <div className="pwfb-form-field-wide">
                <label className="pwfb-label">Bank</label>
                <input
                  className="pwfb-input"
                  value={bankSearch}
                  onChange={(event) => setBankSearch(event.target.value)}
                  placeholder="Search bank by name or code"
                />
                <select
                  className="pwfb-input"
                  value={bankCode}
                  onChange={(event) => {
                    setBankCode(event.target.value);
                    setAccountName("");
                  }}
                  style={{ marginTop: 8 }}
                >
                  <option value="">Select bank</option>
                  {filteredBanks.map((bank) => (
                    <option key={bank.code} value={bank.code}>
                      {bank.name}
                      {bank.shortName ? ` (${bank.shortName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="pwfb-label">Account Number</label>
                <input
                  className="pwfb-input"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(event) =>
                    setAccountNumber(
                      event.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  placeholder="10-digit account number"
                />
              </div>

              <div>
                <label className="pwfb-label">Verified Account Name</label>
                <div className={`pwfb-verify-field ${accountName ? "verified" : ""}`}>
                  {verifying
                    ? "Verifying account…"
                    : accountName || "Enter bank and account number"}
                  {accountName && <b>✓</b>}
                </div>
              </div>
            </>
          )}

          {operation === "transfer" && (
            <div>
              <label className="pwfb-label">Transfer Recipient</label>
              <select
                className="pwfb-input"
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
              >
                <option value="">Select PWFB customer</option>
                {customers
                  .filter((customer) => customer.id !== customerId)
                  .map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customerName(customer)}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="pwfb-label">Amount</label>
            <div className="pwfb-amount-input">
              <span>₦</span>
              <input
                className="pwfb-input"
                type="number"
                min="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="pwfb-label">Transaction Reference</label>
            <input
              className="pwfb-input"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. PWFB-DEP-001"
            />
          </div>

          <div className="pwfb-form-field-wide">
            <label className="pwfb-label">Narration</label>
            <input
              className="pwfb-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional transaction description"
            />
          </div>
        </div>

        <div className="pwfb-deposit-actions">
          <div className="pwfb-security-note">
            🔐 <span>Authorized transaction • Verify customer and account details before processing.</span>
          </div>
          <button
            type="button"
            className="pwfb-primary-button pwfb-banking-submit"
            disabled={loading || !customerId}
            onClick={submit}
          >
            {loading ? "Processing…" : title}
          </button>
        </div>

        {message && (
          <div
            className={`pwfb-alert ${
              message.includes("successfully")
                ? "pwfb-alert-success"
                : "pwfb-alert-error"
            }`}
          >
            {message}
          </div>
        )}
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <p className="pwfb-eyebrow">CUSTOMER ACTIVITY</p>
            <h2>Recent Transactions</h2>
            <p>Recent banking activity for the selected customer.</p>
          </div>
          <span className="pwfb-record-count">{transactions.length} transactions</span>
        </div>

        {!customerId ? (
          <div className="pwfb-banking-empty">
            Select a customer above to view transaction history.
          </div>
        ) : transactions.length === 0 ? (
          <div className="pwfb-banking-empty">
            No transactions found for this customer.
          </div>
        ) : (
          <div className="pwfb-table-wrap">
            <table className="pwfb-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.type || "TRANSACTION"}</td>
                    <td>₦{Number(transaction.amount || 0).toLocaleString()}</td>
                    <td>{transaction.description || "—"}</td>
                    <td>
                      <span className="pwfb-status-badge">
                        {transaction.status || "COMPLETED"}
                      </span>
                    </td>
                    <td>
                      {transaction.createdAt || transaction.created_at
                        ? new Date(
                            transaction.createdAt || transaction.created_at!,
                          ).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
