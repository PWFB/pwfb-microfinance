import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// npm workspace tests run with apps/frontend as the working directory.
const pagePath = path.resolve(process.cwd(), "app/staff-dashboard/page.tsx");
const source = fs.readFileSync(pagePath, "utf8");

test("staff dashboard page exists and is a client component", () => {
  assert.ok(source.includes('"use client"'));
  assert.ok(source.includes("export default function StaffDashboardPage"));
});

test("staff dashboard contains core operational modules", () => {
  for (const moduleName of ["Customers", "Loans", "Savings", "Transactions", "Collections", "Reports"]) {
    assert.ok(source.includes(`title: "${moduleName}"`), `Missing ${moduleName} module`);
  }
});

test("staff dashboard contains required quick actions", () => {
  for (const href of ["/customers/add", "/loans/add", "/transactions/add"]) {
    assert.ok(source.includes(`href="${href}"`), `Missing quick action ${href}`);
  }
});

test("staff dashboard loads staff profile and loan data through the shared authenticated API client", () => {
  const apiPath = path.resolve(process.cwd(), "lib/api.ts");
  const apiSource = fs.readFileSync(apiPath, "utf8");
  assert.ok(source.includes("/auth/profile"));
  assert.ok(source.includes("/loans"));
  assert.ok(apiSource.includes("Authorization"));
  assert.ok(apiSource.includes('headers.set("Authorization", `Bearer ${token}`)'));
  assert.ok(source.includes("activeLoans"));
  assert.ok(source.includes("totalPortfolio"));
});

test("staff dashboard exposes staff identity and role", () => {
  assert.ok(source.includes("displayName"));
  assert.ok(source.includes("roleLabel"));
  assert.ok(source.includes("Staff Member"));
});

test("staff dashboard has responsive layout rules", () => {
  assert.ok(source.includes("@media (max-width: 1000px)"));
  assert.ok(source.includes("@media (max-width: 650px)"));
});


test("staging frontend defaults to the staging API instead of production", () => {
  const apiPath = path.resolve(process.cwd(), "lib/api.ts");
  const apiSource = fs.readFileSync(apiPath, "utf8");
  assert.ok(apiSource.includes('const STAGING_API_URL = "https://pwfb-backend-staging.onrender.com"'));
  assert.ok(apiSource.includes('window.location.hostname === "pwfb-microfinance-staging.onrender.com"'));
  assert.ok(apiSource.includes("IS_STAGING_FRONTEND ? STAGING_API_URL : CONFIGURED_API_URL || PRODUCTION_API_URL"));
});

test("ATM card page avoids claiming profile matching verifies card ownership", () => {
  const cardPage = fs.readFileSync(path.resolve(process.cwd(), "app/atm-cards/page.tsx"), "utf8");
  assert.ok(cardPage.includes("does not itself verify card ownership"));
  assert.ok(cardPage.includes("PWFB does not request or store an ATM PIN"));
  assert.ok(cardPage.includes("Unlink card"));
});


test("ATM card page keeps saved cards compact with unlink in the deposit flow", () => {
  const cardPage = fs.readFileSync(path.resolve(process.cwd(), "app/atm-cards/page.tsx"), "utf8");
  assert.ok(cardPage.includes("atm-saved-cards"));
  assert.ok(cardPage.includes("Unlink card"));
  assert.ok(!cardPage.includes('<h2>Attached Cards</h2>'));
  assert.ok(cardPage.includes("Continue to Paystack authorization"));
});


test("Paystack card attempts cool down after five failures and serialize duplicate credits", () => {
  const servicePath = path.resolve(process.cwd(), "../backend/src/banking/paystack.service.ts");
  const serviceSource = fs.readFileSync(servicePath, "utf8");
  assert.ok(serviceSource.includes('"failedAttempts"+1'));
  assert.ok(serviceSource.includes(">= 5"));
  assert.ok(serviceSource.includes("INTERVAL '1 hour'"));
  assert.ok(serviceSource.includes("pg_advisory_xact_lock"));
  assert.ok(serviceSource.includes("clearCardAttemptFailures"));
});


test("ATM card switching clears stale customer cards and unlink failures are reported", () => {
  const cardPage = fs.readFileSync(path.resolve(process.cwd(), "app/atm-cards/page.tsx"), "utf8");
  assert.ok(cardPage.includes('setCards([])'));
  assert.ok(cardPage.includes('setMessage("Saved card reference unlinked.")'));
  assert.ok(cardPage.includes("Could not unlink this saved card. No local changes were made."));
});
