"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

const BANKS = [
  "OPay",
  "PalmPay",
  "FCMB",
  "GTBank / GTCO",
  "Access Bank",
  "UBA",
  "First Bank",
  "Zenith Bank",
  "Kuda",
  "Moniepoint",
  "Stanbic IBTC",
  "Sterling Bank",
  "Union Bank",
  "Wema Bank",
  "Fidelity Bank",
  "Ecobank",
  "Polaris Bank",
  "Keystone Bank",
  "Jaiz Bank",
  "Other Bank",
];

const SERVICES = [
  {
    key: "transfer",
    label: "Transfer to Others",
    icon: "↗",
    description: "Send money to another customer or bank account.",
  },
  {
    key: "deposit",
    label: "Deposit for Others",
    icon: "+",
    description: "Record a deposit made on behalf of another customer.",
  },
  {
    key: "withdrawal",
    label: "Withdrawal Service",
    icon: "−",
    description: "Assist a customer with a withdrawal request.",
  },
  {
    key: "support",
    label: "Account Assistance",
    icon: "?",
    description: "Handle account and customer service requests.",
  },
];

export default function CustomerServicePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);
  const [service, setService] = useState("transfer");
  const [bankSearch, setBankSearch] = useState("");
  const [bank, setBank] = useState("OPay");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/customers`)
      .then((res) => res.json())
      .then((data) => {
        setCustomers(Array.isArray(data) ? data : []);
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, []);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return [];

    return customers
      .filter((customer) =>
        [
          customer.firstName,
          customer.lastName,
          customer.email,
          customer.phone,
          customer.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 6);
  }, [customers, search]);

  const filteredBanks = BANKS.filter((item) =>
    item.toLowerCase().includes(bankSearch.toLowerCase()),
  );

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setSearch(`${customer.firstName} ${customer.lastName}`);
    setNotice("");
  }

  function submitService(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedCustomer && !accountNumber.trim()) {
      setNotice("Select a customer or enter an account number first.");
      return;
    }

    setNotice(
      "Service request prepared. Account verification and transaction posting can be connected to the banking provider next.",
    );
  }

  return (
    <main className="pwfb-customer-service-page">
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">CUSTOMER SERVICE</p>
          <h1 className="pwfb-page-title">Customer Service</h1>
          <p className="pwfb-page-description">
            Find a customer, access an account, and provide services to
            others from one workspace.
          </p>
        </div>
      </div>

      <section className="pwfb-panel pwfb-cs-search-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Find Customer or Account</h2>
            <p>
              Search by name, phone, customer ID, or enter an account number
              directly.
            </p>
          </div>

          <span className="pwfb-record-count">
            {loading ? "Loading..." : `${customers.length} customers`}
          </span>
        </div>

        <div className="pwfb-cs-search-grid">
          <label>
            <span>Search Customer</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedCustomer(null);
              }}
              placeholder="Name, phone, email or customer ID"
              autoComplete="off"
            />
          </label>

          <label>
            <span>Account Number</span>
            <input
              value={accountNumber}
              onChange={(event) =>
                setAccountNumber(event.target.value.replace(/\D/g, ""))
              }
              placeholder="Type account number"
              inputMode="numeric"
            />
          </label>
        </div>

        {matches.length > 0 && (
          <div className="pwfb-cs-results">
            {matches.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => selectCustomer(customer)}
              >
                <span className="pwfb-cs-result-avatar">
                  {customer.firstName[0]}
                  {customer.lastName[0]}
                </span>

                <span>
                  <strong>
                    {customer.firstName} {customer.lastName}
                  </strong>
                  <small>
                    {customer.phone || customer.email || "No contact"} · ID{" "}
                    {customer.id}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedCustomer && (
          <div className="pwfb-cs-selected">
            <div>
              <small>SELECTED CUSTOMER</small>
              <strong>
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </strong>
              <span>
                {selectedCustomer.phone ||
                  selectedCustomer.email ||
                  "Customer contact not available"}
              </span>
            </div>

            <span className="pwfb-status-badge">Ready</span>
          </div>
        )}
      </section>

      <section className="pwfb-cs-layout">
        <div className="pwfb-panel">
          <div className="pwfb-panel-header">
            <div>
              <h2>Services to Others</h2>
              <p>Select the service you are providing.</p>
            </div>
          </div>

          <div className="pwfb-cs-service-grid">
            {SERVICES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setService(item.key)}
                className={`pwfb-cs-service ${
                  service === item.key ? "pwfb-cs-service-active" : ""
                }`}
              >
                <span>{item.icon}</span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </div>

        <form className="pwfb-panel pwfb-cs-form" onSubmit={submitService}>
          <div className="pwfb-panel-header">
            <div>
              <h2>
                {service === "transfer"
                  ? "Other Bank Transfer"
                  : "Service Details"}
              </h2>
              <p>Complete the service details below.</p>
            </div>
          </div>

          <label>
            <span>Search Bank</span>
            <input
              value={bankSearch}
              onChange={(event) => setBankSearch(event.target.value)}
              placeholder="Search PalmPay, OPay, FCMB, GTB..."
            />
          </label>

          <div className="pwfb-cs-bank-list">
            {filteredBanks.map((item) => (
              <button
                key={item}
                type="button"
                className={
                  bank === item ? "pwfb-cs-bank-active" : ""
                }
                onClick={() => setBank(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="pwfb-cs-form-grid">
            <label>
              <span>Account Number</span>
              <input
                value={accountNumber}
                onChange={(event) =>
                  setAccountNumber(event.target.value.replace(/\D/g, ""))
                }
                placeholder="Enter account number"
                inputMode="numeric"
              />
            </label>

            <label>
              <span>Amount (₦)</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </label>
          </div>

          <label>
            <span>Narration</span>
            <input
              value={narration}
              onChange={(event) => setNarration(event.target.value)}
              placeholder="Optional service narration"
            />
          </label>

          {notice && (
            <div className="pwfb-cs-notice">
              {notice}
            </div>
          )}

          <button
            type="submit"
            className="pwfb-primary-button pwfb-cs-submit"
          >
            Continue with {bank}
          </button>
        </form>
      </section>
    </main>
  );
}
