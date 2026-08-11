import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
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
