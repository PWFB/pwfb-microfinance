"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Bank = {
  code: string;
  name: string;
  shortName?: string;
  provider?: string;
};

type Props = {
  banks: Bank[];
  value: string;
  onChange: (bank: Bank) => void;
  placeholder?: string;
  disabled?: boolean;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function score(bank: Bank, query: string) {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(bank.name);
  const shortName = normalize(bank.shortName);
  const code = normalize(bank.code);
  if (name === q || shortName === q || code === q) return 1000;
  if (name.startsWith(q) || shortName.startsWith(q) || code.startsWith(q)) return 900;
  const words = `${bank.name} ${bank.shortName ?? ""} ${bank.code}`.split(/\s+/);
  if (words.some((word) => normalize(word).startsWith(q))) return 800;
  if (name.includes(q) || shortName.includes(q) || code.includes(q)) return 500;
  return -1;
}

export default function BankSearchSelect({ banks, value, onChange, placeholder = "Search bank by name…", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const selected = banks.find((bank) => bank.code === value);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = useMemo(() => {
    const list = banks.map((bank) => ({ bank, score: score(bank, query) }));
    if (!query.trim()) {
      return list
        .sort((a, b) => a.bank.name.localeCompare(b.bank.name, undefined, { sensitivity: "base" }))
        .slice(0, 50)
        .map((item) => item.bank);
    }
    return list
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || a.bank.name.localeCompare(b.bank.name, undefined, { sensitivity: "base" }))
      .slice(0, 20)
      .map((item) => item.bank);
  }, [banks, query]);

  return (
    <div ref={root} style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen((v) => !v); setQuery(""); } }}
        style={{ width: "100%", textAlign: "left", border: "1px solid #dbe5df", borderRadius: 11, padding: "12px", background: disabled ? "#f1f4f2" : "#fbfdfc", color: selected ? "#21372d" : "#7a8780", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13 }}
      >
        {selected ? selected.name : "Select a bank…"}
      </button>

      {open && !disabled && (
        <div style={{ position: "absolute", zIndex: 100, left: 0, right: 0, top: "calc(100% + 6px)", background: "#fff", border: "1px solid #dbe5df", borderRadius: 12, boxShadow: "0 16px 35px rgba(5,63,36,.14)", overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid #edf2ef" }}>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #dbe5df", borderRadius: 9, padding: "10px 11px", outline: "none", fontSize: 13 }}
            />
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {results.length === 0 ? (
              <div style={{ padding: 14, color: "#7a8780", fontSize: 12 }}>No matching bank found.</div>
            ) : results.map((bank) => (
              <button
                key={`${bank.provider ?? "BANK"}-${bank.code}-${bank.name}`}
                type="button"
                onClick={() => { onChange(bank); setOpen(false); setQuery(""); }}
                style={{ width: "100%", border: 0, borderBottom: "1px solid #edf2ef", background: bank.code === value ? "#f2f9f5" : "#fff", textAlign: "left", padding: "11px 13px", cursor: "pointer" }}
              >
                <strong style={{ display: "block", color: "#075b2a", fontSize: 12 }}>{bank.name}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
