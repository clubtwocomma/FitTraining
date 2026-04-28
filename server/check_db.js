const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const plan = await prisma.trainingPlan.findFirst({
        include: { workouts: true }
    });
    console.log(JSON.stringify(plan, null, 2));
}

main().then(() => prisma.$disconnect());
