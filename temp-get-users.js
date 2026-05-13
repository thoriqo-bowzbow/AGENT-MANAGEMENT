const { PrismaClient } = require('./src/generated/prisma/client');
const prisma = new PrismaClient();

async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

getUsers();