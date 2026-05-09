const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const start = new Date('2026-04-28T00:00:00Z');
    const end = new Date('2026-04-29T00:00:00Z');
    
    const classes = await prisma.gymClass.findMany({
        where: {
            startTime: { gte: start, lt: end }
        },
        include: {
            _count: { select: { bookings: true } }
        }
    });
    
    console.log(JSON.stringify(classes, null, 2));
    await prisma.$disconnect();
}

check();
