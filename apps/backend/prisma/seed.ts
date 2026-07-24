import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const departments = [
    'Administration Department',
    'Monitoring Department',
    'Customer Service Department',
    'Savings Department',
    'Loans Department',
    'Teller Operations Department',
    'Finance & Accounts Department',
    'Risk & Compliance Department',
    'Reports & Analytics Department',
    'Human Resources Department',
  ];

  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await prisma.branch.upsert({
    where: {
      name: 'Head Office',
    },
    update: {},
    create: {
      name: 'Head Office',
      address: 'Main Branch',
    },
  });

  console.log('PWFB organization seed completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
