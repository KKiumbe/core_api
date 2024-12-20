// prismaClient.js

const { PrismaClient } = require('@prisma/client');

// Initialize the Prisma Client
const prisma = new PrismaClient();

// Export the Prisma Client instance
module.exports = prisma;

// Optional: Add shutdown hooks to gracefully close the Prisma Client when the Node.js process exits
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
