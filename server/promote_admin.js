const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function promote(email) {
    if (!email) {
        console.error('Usage: node promote_admin.js <email>');
        process.exit(1);
    }

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { role: 'ADMIN' }
        });
        console.log(`✅ User ${email} successfully promoted to Global ADMIN.`);
        console.log(`   Detailed User Info:`, {
            id: user.id,
            name: user.name,
            role: user.role,
            boxId: user.boxId
        });
    } catch (err) {
        console.error(`❌ Error promoting user ${email}:`, err.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

const targetEmail = process.argv[2] || 'rjafreitas@gmail.com';
promote(targetEmail);
