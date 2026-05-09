const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Iniciando migração de dados...');

    // 1. Migrate Exercises
    const exercisesPath = path.join(__dirname, '..', 'data', 'exercises.json');
    if (fs.existsSync(exercisesPath)) {
        const exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'));
        console.log(`📦 Encontrados ${exercises.length} exercícios. Migrando...`);

        for (const ex of exercises) {
            await prisma.exercise.upsert({
                where: { name: ex.name },
                update: {
                    muscleGroups: ex.muscle_groups || [],
                    equipment: ex.equipment || [],
                    type: ex.type || 'outro',
                },
                create: {
                    name: ex.name,
                    muscleGroups: ex.muscle_groups || [],
                    equipment: ex.equipment || [],
                    type: ex.type || 'outro',
                    source: ex.source || 'default'
                }
            });
        }
        console.log('✅ Exercícios migrados.');
    }

    // 2. Initial Setup: Box and Admin
    console.log('🏢 Configurando Box inicial...');
    const defaultBox = await prisma.box.upsert({
        where: { inviteCode: 'FT2026' },
        update: {},
        create: {
            name: 'Pires Army Box',
            location: 'Lisboa, Portugal',
            inviteCode: 'FT2026',
            adminId: 1 // Temporário, será atualizado após criar o user
        }
    });

    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@fittraining.com' },
        update: { role: 'ADMIN' },
        create: {
            email: 'admin@fittraining.com',
            password: 'fittraining_admin_pass', // Idealmente usar hash, mas para seed serve
            name: 'FitTraining Admin',
            role: 'ADMIN',
            boxId: defaultBox.id,
            boxValidated: true
        }
    });

    // Atualizar adminId da box
    await prisma.box.update({
        where: { id: defaultBox.id },
        data: { adminId: adminUser.id }
    });

    // 3. Initial Gym Classes (Example)
    const countClasses = await prisma.gymClass.count();
    if (countClasses === 0) {
        console.log('🕒 Criando horário de aulas inicial...');
        const today = new Date();
        today.setHours(7, 0, 0, 0);

        const sessions = [7, 8, 12, 18, 19, 20];
        for (const hour of sessions) {
            const startTime = new Date(today);
            startTime.setHours(hour);
            await prisma.gymClass.create({
                data: {
                    startTime,
                    capacity: 12,
                    boxId: defaultBox.id
                }
            });
        }
        console.log('✅ Aulas iniciais criadas.');
    }

    // 3. Migrate Global WODs (Heroes, Girls, Painstorms)
    const loadWods = (filename, type) => {
        const filePath = path.join(__dirname, '..', 'data', filename);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8')).map(w => ({ ...w, _type: type }));
        }
        return [];
    };

    const globalWods = [
        ...loadWods('hero_wods.json', 'hero'),
        ...loadWods('girls_wods.json', 'girl'),
        ...loadWods('painstorms.json', 'painstorm')
    ];

    if (globalWods.length > 0) {
        console.log(`🏋️  Encontrados ${globalWods.length} WODs globais. Migrando para GlobalWod...`);
        for (const wod of globalWods) {
            // Check if name exists since id/slug might be different or missing originally
            const slug = wod.id || wod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            
            await prisma.globalWod.upsert({
                where: { slug },
                update: {
                    name: wod.name,
                    wodType: wod._type,
                    description: wod.description || '',
                    stimulus: wod.stimulus || null,
                    workout: wod.workout || [],
                    rounds: wod.rounds || null,
                    amrap: wod.amrap || null,
                    honor: wod.hero || wod.honor || null,
                },
                create: {
                    slug,
                    name: wod.name,
                    wodType: wod._type,
                    description: wod.description || '',
                    stimulus: wod.stimulus || null,
                    workout: wod.workout || [],
                    rounds: wod.rounds || null,
                    amrap: wod.amrap || null,
                    honor: wod.hero || wod.honor || null,
                }
            });
        }
        console.log('✅ Global WODs migrados.');
    }

    console.log('🏁 Migração concluída com sucesso.');
}

main()
    .catch((e) => {
        console.error('❌ Erro na migração:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
