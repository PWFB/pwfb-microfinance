"use client";

import Link from "next/link";
import BalmzAiPanel from "../../components/BalmzAiPanel";
import PWFBIntelligenceStyles from "../../components/PWFBIntelligenceStyles";

const capabilities = [
  ["◈", "Financial Integrity", "Scan core operational records for basic anomalies and integrity issues."],
  ["⌁", "Operational Intelligence", "Explain unusual activity, workflow problems and what the Super Admin should review."],
  ["✦", "AI Assistant", "Ask questions about PWFB operations and receive contextual guidance."],
  ["▣", "Receipt Verification", "Upload a payment receipt for BALMZ AI-assisted verification and review."],
];

export default function BalmzAiPage() {
  return <><PWFBIntelligenceStyles /><main className="pwfb-balmz-page">
    <section className="pwfb-balmz-hero"><div className="pwfb-balmz-hero-copy"><div className="pwfb-balmz-mark">✦</div><div><p className="pwfb-eyebrow">PWFB INTELLIGENCE LAYER</p><h1>BALMZ AI</h1><p>Financial intelligence and operational assistance for the PWFB Microfinance Super Admin.</p><div className="pwfb-balmz-pills"><span>Financial Audit</span><span>Anomaly Review</span><span>AI Assistance</span></div></div></div><div className="pwfb-balmz-status"><span className="pwfb-live-dot"/>AI CONTROLLED<br/><small>Server-side processing</small></div></section>
    <section className="pwfb-balmz-capabilities">{capabilities.map(([icon,title,text]) => <article key={title}><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</section>
    <section className="pwfb-balmz-workspace"><div className="pwfb-panel pwfb-balmz-main"><div className="pwfb-panel-header"><div><h2>AI Operations Desk</h2><p>Run an integrity audit or ask BALMZ AI to investigate an operational question.</p></div><span className="pwfb-record-count">SUPERVISED AI</span></div><div className="pwfb-balmz-panel-body"><BalmzAiPanel /></div></div><aside className="pwfb-panel pwfb-balmz-side"><div className="pwfb-panel-header"><div><h2>AI governance</h2><p>Important controls for financial AI.</p></div></div><div className="pwfb-governance"><div><b>Human oversight</b><span>AI findings are recommendations for review, not automatic financial approvals.</span></div><div><b>Server-side secrets</b><span>Provider credentials and AI keys must remain outside the browser.</span></div><div><b>Financial safety</b><span>Balance changes should remain inside authenticated financial workflows.</span></div><div><b>Auditability</b><span>Operational decisions should be traceable to the underlying records.</span></div></div><Link href="/balmz-ai/receipt" className="pwfb-primary-button">🧾 Verify a receipt</Link></aside></section>
    <section className="pwfb-panel pwfb-balmz-docs"><div className="pwfb-panel-header"><div><h2>BALMZ AI operating documentation</h2><p>What the AI layer is designed to do inside PWFB.</p></div></div><div className="pwfb-doc-content"><div><b>Financial integrity scans</b><p>BALMZ AI can inspect supported operational data and report basic integrity anomalies. A healthy result means no issue was detected by the configured checks; it does not replace accounting review.</p></div><div><b>Investigations</b><p>Use natural-language questions to ask for explanations, prioritization and operational guidance. Avoid sending passwords, API keys, private keys or other secrets in prompts.</p></div><div><b>Receipt verification</b><p>Receipt analysis should be treated as a verification aid. Confirm the transaction against PWFB records and provider evidence before considering funds settled.</p></div><div><b>Safe AI governance</b><p>Keep model credentials server-side, restrict administrative access, log important actions and require human approval for consequential financial decisions.</p></div></div></section>
  </main></>;
}
