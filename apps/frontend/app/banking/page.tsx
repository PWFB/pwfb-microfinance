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

type Operation = "deposit" | "withdraw" | "transfer";

export default function BankingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<BankingTransaction[]>([]);

  const [operation, setOperation] = useState<Operation>("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [recipientId, setRecipientId] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedOperation = params.get("operation");

    if (
      requestedOperation === "deposit" ||
      requestedOperation === "withdraw" ||
      requestedOperation === "transfer"
    ) {
      setOperation(requestedOperation);
    }

    pwfbApi.customers.search()
      .then((data) => data)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setCustomers(list);
      })
      .catch((error) => {
        console.error("Banking customer load failed:", error); setCustomers([]);
      });
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
      .then(([updatedWallet, updatedTransactions]) => {
        setWallet(updatedWallet);

        const list = Array.isArray(updatedTransactions)
          ? updatedTransactions
          : updatedTransactions?.data ?? [];

        setTransactions(list);
      })
      .catch((error) => {
        setWallet(null);
        setTransactions([]);
      });
  }, [customerId]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

  const customerName = (customer: Customer) =>
    customer.name ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.id;

  function chooseOperation(nextOperation: Operation) {
    setOperation(nextOperation);
    setMessage("");
    setRecipientId("");

    const url = new URL(window.location.href);
    url.searchParams.set("operation", nextOperation);
    window.history.replaceState({}, "", url.toString());
  }

  async function performOperation() {
    if (!customerId) {
      setMessage("Select a customer first.");
      return;
    }

    if (!amount) {
      setMessage("Enter an amount.");
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
        `${operation.charAt(0).toUpperCase()}${operation.slice(1)} completed successfully.`,
      );
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

  const operationTitle = {
    deposit: "Deposit Funds",
    withdraw: "Withdraw Funds",
    transfer: "Transfer Funds",
  }[operation];

  return (
    <main className="pwfb-banking-page">
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">FINANCE OPERATIONS</p>
          <h1 className="pwfb-page-title">Banking Operations</h1>
          <p className="pwfb-page-description">
            Manage customer deposits, withdrawals and transfers.
          </p>
        </div>
      </div>

      <section className="pwfb-panel pwfb-banking-customer-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Customer Wallet</h2>
            <p>Select a customer to manage their banking activity.</p>
          </div>
        </div>

        <div className="pwfb-banking-panel-body">
          <label className="pwfb-label">Customer</label>

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
            <div className="pwfb-banking-balance">
              <div>
                <span>AVAILABLE BALANCE</span>
                <strong>
                  {wallet.currency || "NGN"}{" "}
                  {Number(wallet.balance || 0).toLocaleString()}
                </strong>
                <small>{customerName(selectedCustomer)}</small>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="pwfb-panel pwfb-banking-operation-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Transaction Operation</h2>
            <p>Select the banking operation you want to perform.</p>
          </div>
        </div>

        <div className="pwfb-banking-panel-body">
          <div className="pwfb-banking-operation-grid">
            <button
              type="button"
              className={`pwfb-banking-operation ${
                operation === "deposit"
                  ? "pwfb-banking-operation-active"
                  : ""
              }`}
              onClick={() => chooseOperation("deposit")}
            >
              <span>💰</span>
              <strong>Deposit</strong>
              <small>Add money to customer wallet</small>
            </button>

            <button
              type="button"
              className={`pwfb-banking-operation ${
                operation === "withdraw"
                  ? "pwfb-banking-operation-active"
                  : ""
              }`}
              onClick={() => chooseOperation("withdraw")}
            >
              <span>💵</span>
              <strong>Withdrawal</strong>
              <small>Remove money from customer wallet</small>
            </button>

            <button
              type="button"
              className={`pwfb-banking-operation ${
                operation === "transfer"
                  ? "pwfb-banking-operation-active"
                  : ""
              }`}
              onClick={() => chooseOperation("transfer")}
            >
              <span>↔️</span>
              <strong>Transfer</strong>
              <small>Move money to another customer</small>
            </button>
          </div>
        </div>
      </section>

      <section className="pwfb-panel pwfb-banking-form-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>{operationTitle}</h2>
            <p>
              {operation === "deposit" &&
                "Add funds to the selected customer's wallet."}

              {operation === "withdraw" &&
                "Withdraw funds from the selected customer's wallet."}

              {operation === "transfer" &&
                "Transfer funds to another customer."}
            </p>
          </div>
        </div>

        <div className="pwfb-banking-panel-body">
          <div className="pwfb-banking-form">
            <div>
              <label className="pwfb-label">Amount</label>

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
              <label className="pwfb-label">Description</label>

              <input
                className="pwfb-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Transaction description"
              />
            </div>

            <div>
              <label className="pwfb-label">Transaction Reference</label>

              <input
                className="pwfb-input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={
                  operation === "deposit"
                    ? "e.g. PWFB-DEP-001"
                    : operation === "withdraw"
                      ? "e.g. PWFB-WDR-001"
                      : "e.g. PWFB-TRF-001"
                }
              />
            </div>

            {operation === "transfer" && (
              <div>
                <label className="pwfb-label">Transfer Recipient</label>

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
            )}
          </div>

          <button
            type="button"
            className="pwfb-primary-button pwfb-banking-submit"
            disabled={loading}
            onClick={performOperation}
          >
            {loading ? "Processing..." : operationTitle}
          </button>

          {message && (
            <div className="pwfb-alert pwfb-banking-message">
              {message}
            </div>
          )}
        </div>
      </section>

      <section className="pwfb-panel pwfb-banking-transactions-panel">
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
          <div className="pwfb-banking-empty">
            Select a customer to view transaction history.
          </div>
        ) : transactions.length === 0 ? (
          <div className="pwfb-banking-empty">
            No banking transactions found for this customer.
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

                    <td>
                      ₦{Number(transaction.amount || 0).toLocaleString()}
                    </td>

                    <td>{transaction.description || "—"}</td>

                    <td>{transaction.status || "COMPLETED"}</td>

                    <td>
                      {transaction.createdAt || transaction.created_at
                        ? new Date(
                            transaction.createdAt ||
                              transaction.created_at!,
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
