"use client";

import { useEffect } from "react";

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PWFB login route error]", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#fffaf1",
        color: "#173d2b",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <section
        role="alert"
        style={{
          width: "min(100%, 520px)",
          padding: "24px",
          border: "1px solid #f0c9a5",
          borderRadius: "16px",
          background: "#fff",
          boxShadow: "0 12px 35px rgba(23,61,43,.08)",
        }}
      >
        <h1 style={{ margin: "0 0 10px", fontSize: "22px" }}>
          PWFB login needs to recover
        </h1>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          The login screen hit a browser-side error. Your registration and account
          records have not been changed by this screen.
        </p>
        <p
          style={{
            margin: "0 0 18px",
            padding: "12px",
            borderRadius: "8px",
            background: "#fff4e7",
            overflowWrap: "anywhere",
            fontSize: "13px",
          }}
        >
          {error.message || "No error message was provided by the browser."}
        </p>
        {error.digest && (
          <p style={{ margin: "0 0 16px", color: "#596960", fontSize: "12px" }}>
            Error reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: "44px",
            padding: "10px 18px",
            border: 0,
            borderRadius: "9px",
            background: "#0a5c28",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try login again
        </button>
      </section>
    </main>
  );
}
