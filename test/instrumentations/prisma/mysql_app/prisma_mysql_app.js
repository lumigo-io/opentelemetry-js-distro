const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const newUser = await prisma.user.create({
    data: {
      name: 'Alice',
      email: 'alice@prisma.io',
    },
  });

  console.error('Created new user:', newUser);

  const users = await prisma.user.findMany();

  console.error('Selected all users:', users);
}

main();
