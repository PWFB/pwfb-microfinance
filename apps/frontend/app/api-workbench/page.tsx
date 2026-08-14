"use client";

import { useState } from "react";
import { pwfbApi } from "../../lib/pwfb-api";

type Result = {
  status: "success" | "error";
  data: unknown;
};

const operations = [
  {
    name: "Company Dashboard",
    description: "View the PWFB company-wide dashboard.",
    run: () => pwfbApi.dashboards.company(),
  },
  {
    name: "Reports Summary",
    description: "View the main PWFB reports summary.",
    run: () => pwfbApi.reports.summary(),
  },
  {
    name: "Financial Periods",
    description: "View all financial periods.",
    run: () => pwfbApi.periods.list(),
  },
  {
    name: "Current Financial Period",
    description: "View the currently active financial period.",
    run: () => pwfbApi.periods.current(),
  },
  {
    name: "Payroll",
    description: "View payroll records.",
    run: () => pwfbApi.payroll.list(),
  },
  {
    name: "Payroll Summary",
    description: "View payroll totals and summary.",
    run: () => pwfbApi.payroll.summary(),
  },
  {
    name: "Cashbook",
    description: "View cashbook records.",
    run: () => pwfbApi.cashbook.list(),
  },
  {
    name: "Cashbook Summary",
    description: "View cashbook totals and balances.",
    run: () => pwfbApi.cashbook.summary(),
  },
  {
    name: "Collections",
    description: "View collection records.",
    run: () => pwfbApi.collections.list(),
  },
  {
    name: "Collections Summary",
    description: "View collection totals and reconciliation status.",
    run: () => pwfbApi.collections.summary(),
  },
];

export default function ApiWorkbenchPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState("");

  async function execute(
    name: string,
    request: () => Promise<unknown>,
  ) {
    setLoading(name);
    setResult(null);

    try {
      const data = await request();

      setResult({
        status: "success",
        data,
      });
    } catch (error) {
      setResult({
        status: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Request failed",
        },
      });
    } finally {
      setLoading("");
    }
  }

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">PWFB ADMINISTRATION</p>

          <h1 className="pwfb-page-title">
            API Workbench
          </h1>

          <p className="pwfb-page-description">
            Central control interface for PWFB operational APIs.
          </p>
        </div>

        <a
          href="/dashboard"
          className="pwfb-secondary-button"
        >
          ← Dashboard
        </a>
      </div>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>PWFB API Operations</h2>
            <p>
              Run authorized operations against the live PWFB backend.
            </p>
          </div>

          <span className="pwfb-record-count">
            {operations.length} operations
          </span>
        </div>

        <div className="pwfb-quick-actions">
          {operations.map((operation) => (
            <button
              key={operation.name}
              type="button"
              className="pwfb-quick-action"
              onClick={() =>
                execute(operation.name, operation.run)
              }
              disabled={loading !== ""}
            >
              <strong>
                {operation.name}
              </strong>

              <span>
                {operation.description}
              </span>

              <small>
                {loading === operation.name
                  ? "Loading..."
                  : "Run operation →"}
              </small>
            </button>
          ))}
        </div>
      </section>

      {result && (
        <section className="pwfb-panel">
          <div className="pwfb-panel-header">
            <div>
              <h2>
                API Response
              </h2>

              <p>
                {result.status === "success"
                  ? "Request completed successfully."
                  : "The API request returned an error."}
              </p>
            </div>

            <span className="pwfb-record-count">
              {result.status.toUpperCase()}
            </span>
          </div>

          <pre
            style={{
              overflowX: "auto",
              padding: "1rem",
              borderRadius: "12px",
              background: "#111827",
              color: "#f9fafb",
              fontSize: "0.8rem",
            }}
          >
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
