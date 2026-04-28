const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

/**
 * Create a new Box
 */
async function createBox(name, location, description, adminId) {
    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars

    return await prisma.box.create({
        data: {
            name,
            location,
            description,
            inviteCode,
            adminId
        }
    });
}

/**
 * Update Box Settings
 */
async function updateBox(boxId, name, location) {
    return await prisma.box.update({
        where: { id: parseInt(boxId) },
        data: { name, location }
    });
}

/**
 * Get Box by ID
 */
async function getBoxById(boxId) {
    return await prisma.box.findUnique({
        where: { id: parseInt(boxId) }
    });
}

/**
 * Get Box by Invite Code
 */
async function getBoxByInviteCode(inviteCode) {
    return await prisma.box.findUnique({
        where: { inviteCode }
    });
}

/**
 * List all users in a box (for managers)
 */
async function getBoxUsers(boxId) {
    return await prisma.user.findMany({
        where: { boxId: parseInt(boxId) },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            boxValidated: true,
            createdAt: true
        }
    });
}

/**
 * Validate an athlete in a box
 */
async function validateUser(userId, boxId) {
    return await prisma.user.update({
        where: { id: parseInt(userId), boxId: parseInt(boxId) },
        data: { boxValidated: true }
    });
}

/**
 * Update user role within a box
 */
async function updateUserRole(userId, boxId, role) {
    return await prisma.user.update({
        where: { id: parseInt(userId), boxId: parseInt(boxId) },
        data: { role }
    });
}

/**
 * Create a class for a box
 */
async function createClass(boxId, name, startTime, endTime, capacity = 12) {
    return await prisma.gymClass.create({
        data: {
            boxId: parseInt(boxId),
            name,
            startTime: new Date(startTime),
            endTime: endTime ? new Date(endTime) : null,
            capacity: parseInt(capacity)
        }
    });
}

/**
 * Book a class (Athlete)
 */
async function bookClass(userId, classId) {
    const targetClass = await prisma.gymClass.findUnique({
        where: { id: parseInt(classId) },
        include: { bookings: { where: { status: 'CONFIRMED' } } }
    });

    if (!targetClass) throw new Error('Aula não encontrada.');
    if (targetClass.bookings.length >= targetClass.capacity) {
        throw new Error('Aula lotada.');
    }

    // Check if user already has a booking for this day
    const startOfDay = new Date(targetClass.startTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetClass.startTime);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBooking = await prisma.booking.findFirst({
        where: {
            userId: parseInt(userId),
            status: 'CONFIRMED',
            gymClass: {
                startTime: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        }
    });

    if (existingBooking) {
        throw new Error('Já tens uma reserva para este dia. Limite de 1 aula por dia.');
    }

    return await prisma.booking.create({
        data: {
            userId: parseInt(userId),
            classId: parseInt(classId)
        }
    });
}

/**
 * Get Box Schedule
 */
async function getBoxSchedule(boxId, date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return await prisma.gymClass.findMany({
        where: {
            boxId: parseInt(boxId),
            startTime: {
                gte: start,
                lte: end
            }
        },
        include: {
            _count: {
                select: { bookings: { where: { status: 'CONFIRMED' } } }
            },
            bookings: {
                where: { status: 'CONFIRMED' },
                include: { user: { select: { id: true, name: true, email: true } } }
            }
        },
        orderBy: { startTime: 'asc' }
    });
}

/**
 * Create Daily WOD for Box
 */
async function createBoxWod(boxId, date, title, content, stimulus) {
    return await prisma.boxWod.create({
        data: {
            boxId: parseInt(boxId),
            date: new Date(date),
            title,
            content,
            stimulus
        }
    });
}

module.exports = {
    createBox,
    getBoxById,
    getBoxByInviteCode,
    getBoxUsers,
    validateUser,
    updateUserRole,
    createClass,
    bookClass,
    getBoxSchedule,
    createBoxWod,
    updateBox
};
