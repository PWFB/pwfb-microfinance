const fs = require("fs");

const files = [
  "apps/frontend/app/loans/add/page.tsx",
  "apps/frontend/app/banking/page.tsx",
];

for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  if (!text.includes('BankSearchSelect')) {
    const marker = 'import { pwfbApi } from "../../../lib/pwfb-api";';
    const markerAlt = 'import { pwfbApi } from "../../lib/pwfb-api";';
    if (text.includes(marker)) text = text.replace(marker, `${marker}\nimport BankSearchSelect from "../../../components/BankSearchSelect";`);
    else if (text.includes(markerAlt)) text = text.replace(markerAlt, `${markerAlt}\nimport BankSearchSelect from "../../components/BankSearchSelect";`);
    else throw new Error(`Could not find pwfbApi import in ${file}`);
  }

  // The reusable selector owns the search/ranking/A-Z ordering. Keep the old state for compatibility,
  // but stop rendering the duplicate native bank selector.
  text = text.replace(/\n\s*const filteredBanks = useMemo\(\(\) => \{[\s\S]*?\n\s*\}, \[banks, bankSearch\]\);/, "");

  if (file.endsWith("loans/add/page.tsx")) {
    const old = /<label className="label">BANK SEARCH \*<\/label>\s*<input className="input" value=\{bankSearch\}[\s\S]*?<\/select>/;
    const replacement = `<label className="label">BANK SEARCH *</label>\n                    <BankSearchSelect banks={banks} value={bankCode} onChange={(bank) => { setBankCode(bank.code); setBankName(bank.name); setBankSearch(bank.name); setAccountNumber(\"\"); resetVerification(); }} />`;
    if (old.test(text)) text = text.replace(old, replacement);
    else throw new Error(`Loan bank selector block not found in ${file}`);
  } else {
    const old = /<label className="pwfb-label">Bank Search<\/label><input className="pwfb-input" value=\{bankSearch\}[\s\S]*?<\/select>/;
    const replacement = `<label className="pwfb-label">Bank Search</label><BankSearchSelect banks={banks} value={bankCode} onChange={(bank) => { setBankSearch(bank.name); changeBank(bank.code); }} />`;
    if (old.test(text)) text = text.replace(old, replacement);
    else throw new Error(`Banking bank selector block not found in ${file}`);
  }

  fs.writeFileSync(file, text);
  console.log(`Updated ${file}`);
}
