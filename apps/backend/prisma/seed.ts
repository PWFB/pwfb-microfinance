import "dotenv/config";
import { PrismaClient, Role, InstitutionType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the PWFB seed");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const departments = [
    "Administration Department",
    "Monitoring Department",
    "Customer Service Department",
    "Savings Department",
    "Loans Department",
    "Teller Operations Department",
    "Finance & Accounts Department",
    "Risk & Compliance Department",
    "Reports & Analytics Department",
    "Human Resources Department",
  ];

  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await prisma.branch.upsert({
    where: { name: "Head Office" },
    update: {},
    create: {
      name: "Head Office",
      address: "Main Branch",
    },
  });

  // Keep the customer bank selector populated with common Nigerian
  // banks and payment institutions. These are institution records only;
  // actual account-name enquiry and money movement still require a provider.
  const institutions = [
    { name: "Access Bank", shortName: "Access", code: "044", type: InstitutionType.BANK },
    { name: "First Bank of Nigeria", shortName: "FirstBank", code: "011", type: InstitutionType.BANK },
    { name: "Guaranty Trust Bank", shortName: "GTBank", code: "058", type: InstitutionType.BANK },
    { name: "United Bank for Africa", shortName: "UBA", code: "033", type: InstitutionType.BANK },
    { name: "Zenith Bank", shortName: "Zenith", code: "057", type: InstitutionType.BANK },
    { name: "Fidelity Bank", shortName: "Fidelity", code: "070", type: InstitutionType.BANK },
    { name: "FCMB", shortName: "FCMB", code: "214", type: InstitutionType.BANK },
    { name: "Union Bank of Nigeria", shortName: "Union Bank", code: "032", type: InstitutionType.BANK },
    { name: "Sterling Bank", shortName: "Sterling", code: "232", type: InstitutionType.BANK },
    { name: "Stanbic IBTC Bank", shortName: "Stanbic IBTC", code: "221", type: InstitutionType.BANK },
    { name: "Ecobank Nigeria", shortName: "Ecobank", code: "050", type: InstitutionType.BANK },
    { name: "Wema Bank", shortName: "Wema", code: "035", type: InstitutionType.BANK },
    { name: "Keystone Bank", shortName: "Keystone", code: "082", type: InstitutionType.BANK },
    { name: "Polaris Bank", shortName: "Polaris", code: "076", type: InstitutionType.BANK },
    { name: "Heritage Bank", shortName: "Heritage", code: "030", type: InstitutionType.BANK },
    { name: "Opay", shortName: "OPay", code: "999992", type: InstitutionType.FINTECH },
    { name: "PalmPay", shortName: "PalmPay", code: "999991", type: InstitutionType.FINTECH },
    { name: "Moniepoint", shortName: "Moniepoint", code: "999993", type: InstitutionType.FINTECH },
    { name: "Kuda Microfinance Bank", shortName: "Kuda", code: "090267", type: InstitutionType.FINTECH },
  ];

  for (const institution of institutions) {
    await prisma.bankInstitution.upsert({
      where: { name: institution.name },
      update: {
        shortName: institution.shortName,
        code: institution.code,
        type: institution.type,
        active: true,
      },
      create: {
        name: institution.name,
        shortName: institution.shortName,
        code: institution.code,
        type: institution.type,
        active: true,
      },
    });
  }

  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!adminEmail) {
    throw new Error(
      "SUPER_ADMIN_EMAIL is required to create/update the initial Super Admin",
    );
  }

  if (!adminPassword) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD is required to create/update the initial Super Admin",
    );
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      firstName: "Super",
      lastName: "Admin",
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      firstName: "Super",
      lastName: "Admin",
      phone: "",
      role: Role.SUPER_ADMIN,
    },
  });

  console.log(`Super Admin synchronized: ${admin.email}`);
  console.log(`Bank/payment institutions synchronized: ${institutions.length}`);
  console.log("PWFB organization seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
