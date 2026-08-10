import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
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

  const adminEmail = "admin@pwfb.com";
  const adminPassword = "ChangeMe123!";

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: Role.SUPER_ADMIN,
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

  console.log("PWFB organization seed completed");
  console.log("Head Office created");
  console.log(`Super Admin: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
