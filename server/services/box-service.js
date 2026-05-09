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
async function createClass(boxId, name, startTime, endTime, capacity = 12, location = null, coachId = null, recurrence = 'none', recurrenceEndDate = null) {
    const box = await prisma.box.findUnique({ where: { id: parseInt(boxId) } });
    if (!box || !box.approved) {
        throw new Error('Não é possível criar aulas numa Box que não foi aprovada.');
    }

    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : null;
    const duration = end ? end.getTime() - start.getTime() : 0;
    
    const seriesId = recurrence !== 'none' ? `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : null;
    const instances = [{ start, end }];
    
    if (recurrence !== 'none') {
        let limit = recurrenceEndDate ? new Date(recurrenceEndDate) : new Date(start);
        if (!recurrenceEndDate || limit.getTime() <= start.getTime()) {
            // Default "unlimited" to 12 months (52 weeks)
            limit = new Date(start);
            limit.setFullYear(start.getFullYear() + 1);
        }

        let nextStart = new Date(start);
        nextStart.setDate(nextStart.getDate() + 7); // Weekly recurrence
        
        while (nextStart <= limit) {
            const nextEnd = end ? new Date(nextStart.getTime() + duration) : null;
            instances.push({ start: new Date(nextStart), end: nextEnd });
            nextStart.setDate(nextStart.getDate() + 7);
            
            // Safety break to prevent infinite loops (max 104 instances = 2 years)
            if (instances.length > 104) break;
        }
    }

    // Create all instances
    const created = await Promise.all(instances.map(inst => 
        prisma.gymClass.create({
            data: {
                boxId: parseInt(boxId),
                name,
                startTime: inst.start,
                endTime: inst.end,
                capacity: parseInt(capacity),
                location,
                coachId: coachId ? parseInt(coachId) : null,
                seriesId
            }
        })
    ));

    return created[0]; // Return the first one as confirmation
}

/**
 * Book a class (Athlete)
 */
async function bookClass(userId, classId) {
    const targetClass = await prisma.gymClass.findUnique({
        where: { id: parseInt(classId) },
        include: { 
            box: true,
            bookings: { 
                where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } },
                orderBy: { waitlistPosition: 'desc' }
            } 
        }
    });

    if (!targetClass) throw new Error('Aula não encontrada.');
    if (targetClass.cancelledAt) throw new Error('Esta aula foi cancelada.');
    if (targetClass.box && !targetClass.box.approved) {
        throw new Error('Esta Box ainda não foi aprovada pelo administrador do sistema.');
    }

    // Prevent booking classes that have already started
    if (new Date(targetClass.startTime) <= new Date()) {
        throw new Error('Não é possível inscrever-te numa aula que já começou ou já passou.');
    }

    // Check if user already booked this specific class
    const existingSelf = targetClass.bookings.find(b => b.userId === parseInt(userId));
    if (existingSelf && existingSelf.status !== 'CANCELLED') {
        throw new Error('Já estás inscrito nesta aula.');
    }

    // Check if user already has a CONFIRMED booking for this day
    const startOfDay = new Date(targetClass.startTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetClass.startTime);
    endOfDay.setHours(23, 59, 59, 999);

    const existingDaily = await prisma.booking.findFirst({
        where: {
            userId: parseInt(userId),
            status: 'CONFIRMED',
            gymClass: {
                startTime: { gte: startOfDay, lte: endOfDay }
            }
        }
    });

    if (existingDaily) {
        throw new Error('Já tens uma reserva confirmada para este dia. Limite de 1 aula por dia.');
    }

    const confirmedCount = targetClass.bookings.filter(b => b.status === 'CONFIRMED').length;
    const isFull = confirmedCount >= targetClass.capacity;

    return await prisma.booking.upsert({
        where: {
            userId_classId: {
                userId: parseInt(userId),
                classId: parseInt(classId)
            }
        },
        update: {
            status: isFull ? 'WAITLISTED' : 'CONFIRMED',
            waitlistPosition: isFull ? (targetClass.bookings.filter(b => b.status === 'WAITLISTED').length + 1) : null
        },
        create: {
            userId: parseInt(userId),
            classId: parseInt(classId),
            status: isFull ? 'WAITLISTED' : 'CONFIRMED',
            waitlistPosition: isFull ? (targetClass.bookings.filter(b => b.status === 'WAITLISTED').length + 1) : null
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
            startTime: { gte: start, lte: end },
            cancelledAt: null
        },
        include: {
            coach: { select: { name: true } },
            _count: {
                select: { 
                    bookings: { where: { status: 'CONFIRMED' } } 
                }
            },
            bookings: {
                where: { status: 'CONFIRMED' },
                include: { user: { select: { id: true, name: true, email: true, memberStatus: true } } }
            }
        },
        orderBy: { startTime: 'asc' }
    });
}

/**
 * Get Week Schedule
 */
async function getWeekSchedule(boxId, date) {
    const start = new Date(date);
    // Get Monday of that week
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(start.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const classes = await prisma.gymClass.findMany({
        where: {
            boxId: parseInt(boxId),
            startTime: { gte: monday, lte: sunday }
        },
        include: {
            coach: { select: { name: true } },
            bookings: {
                where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } },
                select: { status: true }
            }
        },
        orderBy: { startTime: 'asc' }
    });

    return classes.map(c => ({
        ...c,
        totalBooked: c.bookings.filter(b => b.status === 'CONFIRMED').length,
        totalWaitlisted: c.bookings.filter(b => b.status === 'WAITLISTED').length
    }));
}

/**
 * Promote from waitlist if spots open
 */
async function promoteWaitlist(classId) {
    const targetClass = await prisma.gymClass.findUnique({
        where: { id: parseInt(classId) },
        include: { 
            bookings: { 
                where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } },
                orderBy: { waitlistPosition: 'asc' }
            } 
        }
    });

    const confirmed = targetClass.bookings.filter(b => b.status === 'CONFIRMED');
    const available = targetClass.capacity - confirmed.length;

    if (available > 0) {
        const waitlisted = targetClass.bookings.filter(b => b.status === 'WAITLISTED');
        const toPromote = waitlisted.slice(0, available);

        for (const booking of toPromote) {
            await prisma.booking.update({
                where: { id: booking.id },
                data: { status: 'CONFIRMED', waitlistPosition: null }
            });
            console.log(`[Waitlist] Promoted User ${booking.userId} in Class ${classId}`);
        }
    }
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

/**
 * Update a class for a box (handles recurrence changes)
 */
async function updateClass(classId, data) {
    const { name, startTime, endTime, capacity, location, coachId, recurrence, recurrenceEndDate, updateAllSeries } = data;
    
    const targetClass = await prisma.gymClass.findUnique({ where: { id: parseInt(classId) } });
    if (!targetClass) throw new Error('Aula não encontrada.');

    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : null;
    const duration = end ? end.getTime() - start.getTime() : 0;

    // 1. Update the target class instance
    const updated = await prisma.gymClass.update({
        where: { id: parseInt(classId) },
        data: {
            name,
            startTime: start,
            endTime: end,
            capacity: parseInt(capacity),
            location,
            coachId: coachId ? parseInt(coachId) : null
        }
    });

    // 2. Handle Recurrence changes if requested for the series
    if (updateAllSeries) {
        // Delete all FUTURE classes in the OLD series (except current)
        if (targetClass.seriesId) {
            await prisma.gymClass.deleteMany({
                where: {
                    seriesId: targetClass.seriesId,
                    id: { not: updated.id },
                    startTime: { gt: targetClass.startTime }
                }
            });
        }

        // If NEW recurrence is not 'none', generate new series
        if (recurrence && recurrence !== 'none') {
            const newSeriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Update current class with new seriesId
            await prisma.gymClass.update({
                where: { id: updated.id },
                data: { seriesId: newSeriesId }
            });

            let limit = recurrenceEndDate ? new Date(recurrenceEndDate) : null;
            if (!limit || limit.getTime() <= start.getTime()) {
                // Default "unlimited" to 12 months
                limit = new Date(start);
                limit.setFullYear(start.getFullYear() + 1);
            }

            let nextStart = new Date(start);
            nextStart.setDate(nextStart.getDate() + 7);
            
            const instances = [];
            while (nextStart <= limit) {
                const nextEnd = end ? new Date(nextStart.getTime() + duration) : null;
                instances.push({ start: new Date(nextStart), end: nextEnd });
                nextStart.setDate(nextStart.getDate() + 7);
                if (instances.length > 104) break;
            }

            await Promise.all(instances.map(inst => 
                prisma.gymClass.create({
                    data: {
                        boxId: targetClass.boxId,
                        name,
                        startTime: inst.start,
                        endTime: inst.end,
                        capacity: parseInt(capacity),
                        location,
                        coachId: coachId ? parseInt(coachId) : null,
                        seriesId: newSeriesId
                    }
                })
            ));
        } else {
            // New recurrence is none, just clear seriesId from the current one
            await prisma.gymClass.update({
                where: { id: updated.id },
                data: { seriesId: null }
            });
        }
    }

    return updated;
}

module.exports = {
    createBox,
    getBoxById,
    getBoxByInviteCode,
    getBoxUsers,
    validateUser,
    updateUserRole,
    createClass,
    updateClass,
    bookClass,
    getBoxSchedule,
    getWeekSchedule,
    promoteWaitlist,
    createBoxWod,
    updateBox
};
