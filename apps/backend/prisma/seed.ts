import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to run the PWFB seed");

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function ensureDepartment(name: string) {
  await prisma.$executeRaw`INSERT INTO "Department" (id, name, "createdAt", "updatedAt") VALUES (${randomUUID()}, ${name}, NOW(), NOW()) ON CONFLICT (name) DO NOTHING`;
}
async function ensureBranch(name: string, address: string) {
  await prisma.$executeRaw`INSERT INTO "Branch" (id, name, address, "createdAt", "updatedAt") VALUES (${randomUUID()}, ${name}, ${address}, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET address = EXCLUDED.address, "updatedAt" = NOW()`;
}
async function ensureInstitution(name: string, shortName: string, code: string, type: string) {
  await prisma.$executeRaw`INSERT INTO "BankInstitution" (id, name, "shortName", code, type, active, "createdAt", "updatedAt") VALUES (${randomUUID()}, ${name}, ${shortName}, ${code}, ${type}::"InstitutionType", true, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET "shortName" = EXCLUDED."shortName", code = EXCLUDED.code, type = EXCLUDED.type, active = true, "updatedAt" = NOW()`;
}
async function ensureSuperAdmin(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE email = ${email} LIMIT 1`;
  if (existing.length) {
    await prisma.$executeRaw`UPDATE "User" SET password = ${hashedPassword}, role = 'SUPER_ADMIN'::"Role", "customerId" = NULL, "firstName" = 'Super', "lastName" = 'Admin', "updatedAt" = NOW() WHERE id = ${existing[0].id}`;
    return existing[0].id;
  }
  const id = randomUUID();
  await prisma.$executeRaw`INSERT INTO "User" (id, email, password, "firstName", "lastName", phone, role, "createdAt", "updatedAt") VALUES (${id}, ${email}, ${hashedPassword}, 'Super', 'Admin', '', 'SUPER_ADMIN'::"Role", NOW(), NOW())`;
  return id;
}
async function ensureBootstrapSuperAdminRole(email: string) {
  await prisma.$executeRaw`UPDATE "User" SET role = 'SUPER_ADMIN'::"Role", "customerId" = NULL, "updatedAt" = NOW() WHERE LOWER(email) = LOWER(${email})`;
}
async function main() {
  const departments = ["Administration Department", "Monitoring Department", "Customer Service Department", "Savings Department", "Loans Department", "Teller Operations Department", "Finance & Accounts Department", "Risk & Compliance Department", "Reports & Analytics Department", "Human Resources Department"];
  for (const name of departments) await ensureDepartment(name);
  await ensureBranch("Head Office", "Main Branch");
  const institutions = [["Access Bank", "Access", "044", "BANK"], ["First Bank of Nigeria", "FirstBank", "011", "BANK"], ["Guaranty Trust Bank", "GTBank", "058", "BANK"], ["United Bank for Africa", "UBA", "033", "BANK"], ["Zenith Bank", "Zenith", "057", "BANK"], ["Fidelity Bank", "Fidelity", "070", "BANK"], ["FCMB", "FCMB", "214", "BANK"], ["Union Bank of Nigeria", "Union Bank", "032", "BANK"], ["Sterling Bank", "Sterling", "232", "BANK"], ["Stanbic IBTC Bank", "Stanbic IBTC", "221", "BANK"], ["Ecobank Nigeria", "Ecobank", "050", "BANK"], ["Wema Bank", "Wema", "035", "BANK"], ["Keystone Bank", "Keystone", "082", "BANK"], ["Polaris Bank", "Polaris", "076", "BANK"], ["Heritage Bank", "Heritage", "030", "BANK"], ["Opay", "OPay", "999992", "FINTECH"], ["PalmPay", "PalmPay", "999991", "FINTECH"], ["Moniepoint", "Moniepoint", "999993", "FINTECH"], ["Kuda Microfinance Bank", "Kuda", "090267", "FINTECH"]] as const;
  for (const [name, shortName, code, type] of institutions) await ensureInstitution(name, shortName, code, type);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS customer_identity_verifications (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE REFERENCES "Customer"(id) ON DELETE CASCADE, bvn TEXT, bvn_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED', bvn_verified_at TIMESTAMP, bvn_overridden_at TIMESTAMP, bvn_override_by_user_id TEXT, bvn_override_by_email TEXT, bvn_override_reason TEXT, nin TEXT, nin_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED', nin_verified_at TIMESTAMP, nin_overridden_at TIMESTAMP, nin_override_by_user_id TEXT, nin_override_by_email TEXT, nin_override_reason TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS customer_identity_override_audits (id TEXT PRIMARY KEY, verification_id TEXT NOT NULL REFERENCES customer_identity_verifications(id) ON DELETE CASCADE, identity_type TEXT NOT NULL, previous_status TEXT NOT NULL, new_status TEXT NOT NULL, reason TEXT NOT NULL, admin_user_id TEXT NOT NULL, admin_email TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!adminEmail) throw new Error("SUPER_ADMIN_EMAIL is required to create/update the initial Super Admin");
  if (!adminPassword) throw new Error("SUPER_ADMIN_PASSWORD is required to create/update the initial Super Admin");
  await ensureSuperAdmin(adminEmail, adminPassword);
  await ensureBootstrapSuperAdminRole("pwfbmicrofinancemfb@gmail.com");
  console.log(`Super Admin synchronized: ${adminEmail}`);
  console.log("Bootstrap Super Admin synchronized: pwfbmicrofinancemfb@gmail.com");
  console.log(`Bank/payment institutions synchronized: ${institutions.length}`);
  console.log("Customer identity verification tables synchronized");
  console.log("PWFB organization seed completed");
}
main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
