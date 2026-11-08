"use client";

import { useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api";

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type SectionKey = "operations" | "builder" | "balmz" | "public";

const operations: Array<{ name: string; category: string; method: Method; path: string; description: string }> = [
  { name: "Company Dashboard", category: "Dashboards", method: "GET", path: "/dashboards/co", description: "Company-wide operational dashboard." },
  { name: "Reports Summary", category: "Reports", method: "GET", path: "/reports/summary", description: "Financial and operational report summary." },
  { name: "Branches", category: "Organization", method: "GET", path: "/branches", description: "List branches and organizational records." },
  { name: "Staff", category: "Organization", method: "GET", path: "/staff", description: "Search and inspect staff records." },
  { name: "Customers", category: "Customers", method: "GET", path: "/customers", description: "Search customer records." },
  { name: "Loans", category: "Loans", method: "GET", path: "/loans", description: "Inspect loan records and workflow data." },
  { name: "Collections", category: "Finance", method: "GET", path: "/collections", description: "Daily collection records." },
  { name: "Cashbook", category: "Finance", method: "GET", path: "/cashbook", description: "Cashbook entries and remittance records." },
  { name: "Cashbook Summary", category: "Finance", method: "GET", path: "/cashbook/summary", description: "Cashbook totals and balances." },
  { name: "Financial Periods", category: "Finance", method: "GET", path: "/periods", description: "Open and closed financial periods." },
  { name: "BALMZ Diagnose", category: "BALMZ AI", method: "GET", path: "/balmz-ai/diagnose", description: "Run the financial integrity and anomaly scan." },
  { name: "BALMZ Repair Check", category: "BALMZ AI", method: "GET", path: "/balmz-ai/repair-check", description: "Review safe-repair recommendations." },
];

const categories = ["All", ...Array.from(new Set(operations.map((item) => item.category)))];
const languages = ["curl", "JavaScript", "TypeScript", "Python"];

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function ApiWorkbenchSearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ operations: true, builder: true, balmz: true, public: false });
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("/reports/summary");
  const [body, setBody] = useState("{}");
  const [response, setResponse] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [balmzMessage, setBalmzMessage] = useState("");
  const [balmzReply, setBalmzReply] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [codingEnabled, setCodingEnabled] = useState(true);
  const [publicApiEnabled, setPublicApiEnabled] = useState(false);
  const [requireAuth, setRequireAuth] = useState(true);
  const [language, setLanguage] = useState("curl");

  const filtered = useMemo(() => operations.filter((item) => {
    const text = `${item.name} ${item.category} ${item.path} ${item.description}`.toLowerCase();
    return (category === "All" || item.category === category) && text.includes(query.toLowerCase());
  }), [category, query]);

  function toggle(section: SectionKey) {
    setSections((current) => ({ ...current, [section]: !current[section] }));
  }

  async function run(pathname: string, selectedMethod: Method = "GET", selectedBody?: string) {
    setBusy(true);
    setResponse(null);
    try {
      let parsed: unknown = undefined;
      if (selectedMethod !== "GET" && selectedMethod !== "DELETE" && selectedBody?.trim()) parsed = JSON.parse(selectedBody);
      const data = await apiRequest(pathname, {
        method: selectedMethod,
        ...(parsed === undefined ? {} : { body: JSON.stringify(parsed) }),
      });
      setResponse({ status: "success", data });
    } catch (error) {
      setResponse({ status: "error", data: { message: error instanceof Error ? error.message : "Request failed" } });
    } finally {
      setBusy(false);
    }
  }

  async function askBalmz() {
    if (!aiEnabled || !balmzMessage.trim()) return;
    setBalmzReply("Thinking...");
    try {
      const result = await apiRequest("/balmz-ai/chat", { method: "POST", body: JSON.stringify({ message: balmzMessage.trim() }) });
      setBalmzReply(String((result as { reply?: unknown })?.reply ?? pretty(result)));
    } catch (error) {
      setBalmzReply(error instanceof Error ? error.message : "BALMZ AI request failed");
    }
  }

  const code = language === "curl"
    ? `curl -X ${method} "$NEXT_PUBLIC_API_URL${path}" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"${method === "GET" || method === "DELETE" ? "" : ` -d '${body}'`}`
    : language === "JavaScript"
      ? `const response = await fetch(process.env.NEXT_PUBLIC_API_URL + "${path}", {\n  method: "${method}",\n  headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },\n${method === "GET" || method === "DELETE" ? "" : `  body: JSON.stringify(${body}),\n`} });\nconst data = await response.json();`
      : language === "TypeScript"
        ? `const data = await apiRequest("${path}", {\n  method: "${method}",\n${method === "GET" || method === "DELETE" ? "" : `  body: JSON.stringify(${body}),\n`} });`
        : `import requests\n\nresponse = requests.request(\n    "${method}",\n    f"{API_URL}${path}",\n    headers={"Authorization": f"Bearer {TOKEN}"},\n${method === "GET" || method === "DELETE" ? "" : `    json=${body},\n`} )\nprint(response.json())`;

  return (
    <main className="space-y-5">
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">SUPER ADMIN • DEVELOPER TOOLS</p>
          <h1 className="pwfb-page-title">API Workbench</h1>
          <p className="pwfb-page-description">Search, inspect and test authorized PWFB APIs from one controlled workspace.</p>
        </div>
        <a href="/admin-overview" className="pwfb-secondary-button">← Control Center</a>
      </div>

      <section className="pwfb-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-700">Search API</label>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search endpoint, operation or category..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-600" />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3 py-2 text-xs font-bold ${category === item ? "bg-emerald-800 text-white" : "bg-emerald-50 text-emerald-800"}`}>{item}</button>)}
          </div>
        </div>
      </section>

      <section className="pwfb-panel">
        <button type="button" onClick={() => toggle("operations")} className="flex w-full items-center justify-between text-left"><div><h2>API Directory</h2><p>Authorized PWFB operations available to the Super Admin.</p></div><span className="rounded-lg bg-emerald-50 px-3 py-2 font-bold">{sections.operations ? "−" : "+"}</span></button>
        {sections.operations && <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => <button key={`${item.method}-${item.path}`} type="button" onClick={() => { setMethod(item.method); setPath(item.path); }} className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-500 hover:bg-emerald-50/40"><div className="flex items-center justify-between gap-2"><strong>{item.name}</strong><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black">{item.method}</span></div><code className="mt-2 block text-xs text-emerald-700">{item.path}</code><p className="mt-2 text-xs text-slate-500">{item.description}</p></button>)}
          {!filtered.length && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No API matches this search.</p>}
        </div>}
      </section>

      <section className="pwfb-panel">
        <button type="button" onClick={() => toggle("builder")} className="flex w-full items-center justify-between text-left"><div><h2>Request Builder</h2><p>Test an authorized endpoint and inspect the live response.</p></div><span className="rounded-lg bg-emerald-50 px-3 py-2 font-bold">{sections.builder ? "−" : "+"}</span></button>
        {sections.builder && <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-[120px_1fr_auto]"><select value={method} onChange={(event) => setMethod(event.target.value as Method)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold"><option>GET</option><option>POST</option><option>PATCH</option><option>DELETE</option></select><input value={path} onChange={(event) => setPath(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm" placeholder="/endpoint" /><button type="button" disabled={busy} onClick={() => run(path, method, body)} className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Running..." : "Send Request"}</button></div>
          {method !== "GET" && method !== "DELETE" && <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={7} className="w-full rounded-xl border border-slate-200 p-4 font-mono text-xs" placeholder='{"key":"value"}' />}
          {response && <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{pretty(response)}</pre>}
        </div>}
      </section>

      <section className="pwfb-panel">
        <button type="button" onClick={() => toggle("balmz")} className="flex w-full items-center justify-between text-left"><div><h2>BALMZ AI Control</h2><p>Super Admin controls for diagnostics, coding assistance and AI operations.</p></div><span className="rounded-lg bg-emerald-50 px-3 py-2 font-bold">{sections.balmz ? "−" : "+"}</span></button>
        {sections.balmz && <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <label className="flex items-center justify-between text-sm font-semibold"><span>BALMZ AI enabled</span><input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} /></label>
            <label className="flex items-center justify-between text-sm font-semibold"><span>Coding assistant enabled</span><input type="checkbox" checked={codingEnabled} onChange={(e) => setCodingEnabled(e.target.checked)} /></label>
            <label className="flex items-center justify-between text-sm font-semibold"><span>Public API access</span><input type="checkbox" checked={publicApiEnabled} onChange={(e) => setPublicApiEnabled(e.target.checked)} /></label>
            <label className="flex items-center justify-between text-sm font-semibold"><span>Require authentication</span><input type="checkbox" checked={requireAuth} onChange={(e) => setRequireAuth(e.target.checked)} /></label>
            <p className="text-[11px] text-slate-500">Public access is disabled by default. Authentication remains the safe default for financial and administrative APIs.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-700">Ask BALMZ AI</label>
            <textarea value={balmzMessage} onChange={(e) => setBalmzMessage(e.target.value)} rows={4} disabled={!aiEnabled} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Ask BALMZ AI to explain an API, diagnose an operational issue or help write integration code..." />
            <button type="button" onClick={askBalmz} disabled={!aiEnabled || !balmzMessage.trim()} className="mt-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Ask BALMZ AI</button>
            {balmzReply && <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{balmzReply}</pre>}
          </div>
        </div>}
      </section>

      <section className="pwfb-panel">
        <button type="button" onClick={() => toggle("public")} className="flex w-full items-center justify-between text-left"><div><h2>Developer & Public API</h2><p>Generate integration examples and expose documentation without exposing Super Admin credentials.</p></div><span className="rounded-lg bg-emerald-50 px-3 py-2 font-bold">{sections.public ? "−" : "+"}</span></button>
        {sections.public && <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">{languages.map((item) => <button key={item} type="button" onClick={() => setLanguage(item)} className={`rounded-lg px-3 py-2 text-xs font-bold ${language === item ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-700"}`}>{item}</button>)}</div>
          {codingEnabled ? <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{code}</pre> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Coding assistant is disabled by the Super Admin.</p>}
          <div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><strong className="text-sm">Public API</strong><p className="mt-1 text-xs text-slate-500">{publicApiEnabled ? "Enabled in this control panel." : "Disabled."}</p></div><div className="rounded-xl bg-slate-50 p-4"><strong className="text-sm">Authentication</strong><p className="mt-1 text-xs text-slate-500">{requireAuth ? "Required" : "Not required"}</p></div><div className="rounded-xl bg-slate-50 p-4"><strong className="text-sm">AI</strong><p className="mt-1 text-xs text-slate-500">{aiEnabled ? "BALMZ AI enabled" : "BALMZ AI disabled"}</p></div></div>
        </div>}
      </section>
    </main>
  );
}
