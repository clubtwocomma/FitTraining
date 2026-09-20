const { PrismaClient } = require('@prisma/client');

// Single shared Prisma client for the whole process — avoids opening a
// separate connection pool per module (server.js, auth-service, box-service).
const prisma = new PrismaClient();

module.exports = prisma;
