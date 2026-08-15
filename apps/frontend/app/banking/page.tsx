"use client";

import { useEffect, useState } from "react";
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

type BankingTransaction = {
  id: string;
  type?: string;
  amount: number;
  description?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
};

export default function BankingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<BankingTransaction[]>([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setCustomers(list);
      })
      .catch(() => {
        setCustomers([]);
      });
  }, []);

  useEffect(() => {
    if (!customerId) {
      setWallet(null);
      return;
    }

    pwfbApi.banking.customerWallet(customerId)
      .then(setWallet)
      .catch(() => setWallet(null));

    pwfbApi.banking.customerTransactions(customerId)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setTransactions(list);
      })
      .catch(() => setTransactions([]));
  }, [customerId]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const customerName = (customer: Customer) =>
    customer.name ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.id;

  async function performOperation(
    operation: "deposit" | "withdraw" | "transfer"
  ) {
    if (!customerId || !amount) {
      setMessage("Select a customer and enter an amount.");
      return;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("Enter a valid amount greater than zero.");
      return;
    }

    if (!reference.trim()) {
      setMessage("Enter a transaction reference.");
      return;
    }

    if (
      operation === "withdraw" &&
      wallet &&
      numericAmount > Number(wallet.balance || 0)
    ) {
      setMessage("Insufficient wallet balance for this withdrawal.");
      return;
    }

    if (operation === "transfer" && !recipientId) {
      setMessage("Select a transfer recipient.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const body =
        operation === "transfer"
          ? {
              recipientCustomerId: recipientId,
              amount: numericAmount,
              description,
              reference: reference.trim(),
            }
          : {
              amount: numericAmount,
              description,
              reference: reference.trim(),
            };

      if (operation === "deposit") {
        await pwfbApi.banking.deposit(customerId, body);
      } else if (operation === "withdraw") {
        await pwfbApi.banking.withdraw(customerId, body);
      } else {
        await pwfbApi.banking.transfer(customerId, body);
      }

      const [updatedWallet, updatedTransactions] = await Promise.all([
        pwfbApi.banking.customerWallet(customerId),
        pwfbApi.banking.customerTransactions(customerId),
      ]);

      setWallet(updatedWallet);

      const transactionList = Array.isArray(updatedTransactions)
        ? updatedTransactions
        : updatedTransactions?.data ?? [];

      setTransactions(transactionList);

      setAmount("");
      setDescription("");
      setReference("");
      setRecipientId("");
      setMessage(
        operation.charAt(0).toUpperCase() +
          operation.slice(1) +
          " completed successfully."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Operation could not be completed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">FINANCE OPERATIONS</p>
          <h1 className="pwfb-page-title">Banking Operations</h1>
          <p className="pwfb-page-description">
            Manage customer deposits, withdrawals and transfers.
          </p>
        </div>
      </div>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Customer Wallet</h2>
            <p>Select a customer to manage their wallet.</p>
          </div>
        </div>

        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="pwfb-input"
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customerName(customer)}
            </option>
          ))}
        </select>

        {selectedCustomer && wallet && (
          <div className="pwfb-dashboard-hero" style={{ marginTop: 18 }}>
            <div>
              <p>AVAILABLE BALANCE</p>
              <h2>
                {wallet.currency || "NGN"}{" "}
                {Number(wallet.balance || 0).toLocaleString()}
              </h2>
              <span>{customerName(selectedCustomer)}</span>
            </div>
          </div>
        )}
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Recent Transactions</h2>
            <p>Latest banking activity for the selected customer.</p>
          </div>

          <span className="pwfb-record-count">
            {transactions.length} transactions
          </span>
        </div>

        {!customerId ? (
          <p className="pwfb-page-description">
            Select a customer to view transaction history.
          </p>
        ) : transactions.length === 0 ? (
          <p className="pwfb-page-description">
            No banking transactions found for this customer.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    <td>
                      ₦{Number(transaction.amount || 0).toLocaleString()}
                    </td>
                    <td>{transaction.description || "—"}</td>
                    <td>{transaction.status || "COMPLETED"}</td>
                    <td>
                      {transaction.createdAt || transaction.created_at
                        ? new Date(
                            transaction.createdAt ||
                              transaction.created_at
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

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Transaction Operations</h2>
            <p>Perform customer wallet transactions.</p>
          </div>
        </div>

        <div className="pwfb-form-grid">
          <div>
            <label>Amount</label>
            <input
              className="pwfb-input"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
          </div>

          <div>
            <label>Description</label>
            <input
              className="pwfb-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Transaction description"
            />
          </div>

          <div>
            <label>Transaction Reference</label>
            <input
              className="pwfb-input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. PWFB-DEP-001"
            />
          </div>

          <div>
            <label>Transfer Recipient</label>
            <select
              className="pwfb-input"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
            >
              <option value="">Select recipient</option>
              {customers
                .filter((customer) => customer.id !== customerId)
                .map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customerName(customer)}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
          <button
            className="pwfb-primary-button"
            disabled={loading}
            onClick={() => performOperation("deposit")}
          >
            {loading ? "Processing..." : "Deposit"}
          </button>

          <button
            className="pwfb-secondary-button"
            disabled={loading}
            onClick={() => performOperation("withdraw")}
          >
            Withdraw
          </button>

          <button
            className="pwfb-secondary-button"
            disabled={loading}
            onClick={() => performOperation("transfer")}
          >
            Transfer
          </button>
        </div>

        {message && (
          <div className="pwfb-alert" style={{ marginTop: 18 }}>
            {message}
          </div>
        )}
      </section>
    </main>
  );
}
