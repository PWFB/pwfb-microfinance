import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.resolve(process.cwd(), "apps/frontend/app/staff-dashboard/page.tsx");
const source = fs.readFileSync(pagePath, "utf8");

test("staff dashboard page exists and is a client component", () => {
  assert.ok(source.includes('"use client"'));
  assert.ok(source.includes("export default function StaffDashboardPage"));
});

test("staff dashboard contains core operational modules", () => {
  for (const moduleName of [
    "Customers",
    "Loans",
    "Savings",
    "Transactions",
    "Collections",
    "Reports",
  ]) {
    assert.ok(source.includes(`title: "${moduleName}"`), `Missing ${moduleName} module`);
  }
});

test("staff dashboard contains required quick actions", () => {
  for (const href of ["/customers/add", "/loans/add", "/transactions/add"]) {
    assert.ok(source.includes(`href="${href}"`), `Missing quick action ${href}`);
  }
});

test("staff dashboard loads staff profile and loan data", () => {
  assert.ok(source.includes("/auth/profile"));
  assert.ok(source.includes("/loans"));
  assert.ok(source.includes("Authorization"));
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
