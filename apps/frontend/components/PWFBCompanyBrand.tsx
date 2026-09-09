"use client";

export default function PWFBCompanyBrand({
  small = false,
}: {
  small?: boolean;
}) {
  return (
    <div
      className={`pwfb-company-brand ${small ? "pwfb-company-brand-small" : ""}`}
      aria-label="PWFB Microfinance"
      style={{ display: "inline-flex", alignItems: "center", gap: small ? 9 : 12, minWidth: 0 }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: small ? 40 : 48,
          height: small ? 40 : 48,
          flex: "0 0 auto",
          borderRadius: small ? 11 : 13,
          overflow: "hidden",
          background: "#ffffff",
          border: "2px solid #f28c18",
          boxShadow: "0 5px 14px rgba(0,0,0,.14)",
        }}
      >
        <svg
          width={small ? 34 : 42}
          height={small ? 34 : 42}
          viewBox="0 0 100 100"
          role="img"
          aria-label="PWFB logo"
        >
          <rect x="5" y="5" width="90" height="90" rx="20" fill="#0f7b35" />
          <path d="M25 27h12v46H25z" fill="#fff" />
          <path d="M37 27h14c12 0 19 6 19 16s-7 16-19 16H37V48h13c4 0 7-2 7-5s-3-5-7-5H37z" fill="#f28c18" />
          <path d="M56 59h13l7 14H63z" fill="#fff" />
          <circle cx="78" cy="25" r="7" fill="#f28c18" />
        </svg>
      </span>

      <span
        className="pwfb-company-brand-text"
        style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.1 }}
      >
        <strong
          style={{
            color: "#ffffff",
            fontSize: small ? 15 : 17,
            fontWeight: 950,
            letterSpacing: ".04em",
            whiteSpace: "nowrap",
          }}
        >
          PWFB
        </strong>
        <span
          style={{
            marginTop: 3,
            color: "#bfe4ca",
            fontSize: small ? 8 : 9,
            fontWeight: 750,
            letterSpacing: ".08em",
            whiteSpace: "nowrap",
          }}
        >
          MICROFINANCE
        </span>
      </span>
    </div>
  );
}
