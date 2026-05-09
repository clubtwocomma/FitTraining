const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const rateLimit = require('express-rate-limit');
const { z } = require('zod');

// Rate limiter for AI endpoints (10 requests per 15 minutes)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, // A bit higher for testing but protects against abuse
  message: { error: 'Limite de gerações por IA atingido. Tenta novamente em 15 minutos.' }
});

// Zod validation schemas
const generateSchema = z.object({
  time: z.union([z.string(), z.number()]),
  muscleGroups: z.array(z.string()).nonempty(),
  type: z.string().min(1),
  equipment: z.array(z.string()).optional(),
  aiProvider: z.string().optional(),
  profile: z.object({}).passthrough().optional(),
  clientApiKey: z.string().optional(),
  optimization: z.string().optional()
});

const planSchema = z.object({
  title: z.string().min(1),
  goal: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  sessions: z.array(z.object({
    day: z.number(),
    focus: z.string()
  }).passthrough()).min(1),
  coachingDecision: z.any().optional()
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['ADMIN', 'BOX_ADMIN', 'COACH', 'ATHLETE']).optional()
});

const { generateWorkout } = require('./utils/generator');
const { testConnection, generateMultiDayPlan, parseWorkoutText, generateWod, generateBoxWodPlan } = require('./services/ai-service');
const { 
  registerUser, loginUser, updateProfile, authenticateToken, authorizeRoles,
  changePassword, requestPasswordReset, resetPassword 
} = require('./services/auth-service');
const { sendWelcomeEmail, sendValidationEmail, sendEmail } = require('./services/email-service');

// ─── Notification Helper ─────────────────────────────────────────────────────
const createNotification = async (userId, type, message, classId = null) => {
  try {
    await prisma.notification.create({ data: { userId, type, message, classId } });
  } catch (e) { console.error('[Notification]', e.message); }
};
// ─────────────────────────────────────────────────────────────────────────────

const {
  createBox, getBoxById, getBoxByInviteCode, getBoxUsers, validateUser, updateUserRole,
  createClass, bookClass, getBoxSchedule, getWeekSchedule, promoteWaitlist, createBoxWod, updateBox
} = require('./services/box-service');

const app = express();
app.set('trust proxy', 1); // Confia no IP reencaminhado pelo Nginx
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = registerSchema.parse(req.body);
    const user = await registerUser(email, password, name, role);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { profile } = req.body;
    const user = await updateProfile(req.user.userId, profile);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await changePassword(req.user.userId, oldPassword, newPassword);
    res.json({ message: 'Palavra-passe alterada com sucesso.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    await requestPasswordReset(email);
    res.json({ message: 'Se o email existir, as instruções foram enviadas.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    await resetPassword(token, newPassword);
    res.json({ message: 'Palavra-passe redefinida com sucesso.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Load exercises
const exercisesPath = path.join(__dirname, 'data', 'exercises.json');
let exercises = [];

try {
  const data = fs.readFileSync(exercisesPath, 'utf8');
  exercises = JSON.parse(data);
} catch (err) {
  console.error('Error loading exercises:', err);
}

app.get('/api/exercises', (req, res) => {
  res.json(exercises);
});

// Global WODs from Database
app.get('/api/heroes', async (req, res) => {
  try {
    const heroes = await prisma.globalWod.findMany({ where: { wodType: 'hero' }, orderBy: { name: 'asc' } });
    res.json(heroes);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/girls', async (req, res) => {
  try {
    const girls = await prisma.globalWod.findMany({ where: { wodType: 'girl' }, orderBy: { name: 'asc' } });
    res.json(girls);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/painstorms', async (req, res) => {
  try {
    const painstorms = await prisma.globalWod.findMany({ where: { wodType: 'painstorm' }, orderBy: { name: 'asc' } });
    res.json(painstorms);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', aiLimiter, (req, res) => {
  try {
    const { time, muscleGroups, type, equipment, aiProvider, profile, clientApiKey, optimization } = generateSchema.parse(req.body);

    generateWorkout(exercises, {
      time: parseInt(time),
      muscleGroups,
      type,
      equipment: equipment || [],
      aiProvider,
      profile: profile || {},
      clientApiKey,
      optimization
    }).then(workout => {
      res.json(workout);
    }).catch(err => {
      res.status(500).json({ error: 'Generation failed', details: err.message });
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(400).json({ error: err.message });
  }
});

// --- Super Admin Routes ---
app.get('/api/superadmin/stats', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + 1);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);

    const [totalBoxes, totalAthletes, classesThisWeek, bookingsToday] = await Promise.all([
      prisma.box.count(),
      prisma.user.count({ where: { role: 'ATHLETE' } }),
      prisma.gymClass.count({ where: { startTime: { gte: weekStart, lt: weekEnd } } }),
      prisma.booking.count({ where: { registeredAt: { gte: today, lt: tomorrow }, status: 'CONFIRMED' } })
    ]);
    res.json({ totalBoxes, totalAthletes, classesThisWeek, bookingsToday });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/superadmin/boxes', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const boxes = await prisma.box.findMany({
      include: { _count: { select: { users: true, classes: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(boxes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/superadmin/boxes', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { boxName, boxLocation, adminName, adminEmail, adminPassword } = req.body;
    console.log('[SuperAdmin] Creating Box:', { boxName, adminEmail });

    if (!boxName || !adminEmail || !adminPassword || !adminName) {
      return res.status(400).json({ error: 'Campos obrigatórios: boxName, adminName, adminEmail, adminPassword' });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existing) {
      return res.status(400).json({ error: 'O email do administrador já está em uso.' });
    }

    const { registerUser } = require('./services/auth-service');
    const crypto = require('crypto');
    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    // 1. Create Box with a dummy adminId initially (using 1 which is the SuperAdmin)
    const box = await prisma.box.create({
      data: { name: boxName, location: boxLocation || '', inviteCode, adminId: 1, approved: true }
    });

    // 2. Create the Admin user linked to the box
    const admin = await registerUser(adminEmail, adminPassword, adminName, 'BOX_ADMIN', box.id);

    // 3. Update the Box with the real adminId
    await prisma.box.update({ where: { id: box.id }, data: { adminId: admin.id } });

    // 4. Auto-validate the box admin
    await prisma.user.update({ where: { id: admin.id }, data: { boxValidated: true } });

    console.log('[SuperAdmin] Box created successfully:', box.id);

    // Send email
    try {
      const subject = `Conta de Administrador FitTraining - ${boxName}`;
      const text = `Olá ${adminName}!\n\nA tua conta de administrador para a box ${boxName} foi criada com sucesso.\n\nEmail: ${adminEmail}\nPassword: ${adminPassword}\n\nJá podes entrar na aplicação e configurar a tua box!\n\nLink: https://magnific1.ddns.net/fittraining/`;
      sendEmail(adminEmail, subject, text);
    } catch (e) { console.error('Admin Email Error:', e.message); }

    res.status(201).json({ box, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error('[SuperAdmin Error] Box creation failed:', err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/superadmin/boxes/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const boxId = parseInt(req.params.id);
    await prisma.gymClass.deleteMany({ where: { boxId } });
    await prisma.boxWod.deleteMany({ where: { boxId } });
    await prisma.user.updateMany({ where: { boxId }, data: { boxId: null, role: 'ATHLETE', boxValidated: false } });
    await prisma.box.delete({ where: { id: boxId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/superadmin/boxes/:id/approve', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const boxId = parseInt(req.params.id);
    const box = await prisma.box.findUnique({ where: { id: boxId } });
    if (!box) return res.status(404).json({ error: 'Box não encontrada.' });
    const updated = await prisma.box.update({ where: { id: boxId }, data: { approved: !box.approved } });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/superadmin/boxes/:id/users', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { boxId: parseInt(req.params.id) },
      select: { id: true, name: true, email: true, role: true, boxValidated: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/superadmin/boxes/:id/users/:userId/role', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { role } = req.body;
    const data = { role };
    if (role === 'BOX_ADMIN') data.boxValidated = true;
    
    await prisma.user.update({ where: { id: parseInt(req.params.userId) }, data });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/boxes', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'ATHLETE'), async (req, res) => {
  try {
    const { name, location, description } = req.body;
    const box = await createBox(name, location, description, req.user.userId);

    // Promote creator to BOX_ADMIN and associate with the box
    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        role: 'BOX_ADMIN',
        boxId: box.id,
        boxValidated: true
      }
    });

    res.status(201).json(box);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/boxes/join', authenticateToken, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const box = await getBoxByInviteCode(inviteCode);
    if (!box) return res.status(404).json({ error: 'Código de convite inválido.' });

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { boxId: box.id, boxValidated: false }
    });

    // Notify BOX_ADMIN of new athlete join
    try {
      const athlete = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true, email: true } });
      createNotification(box.adminId, 'athlete_joined', `${athlete.name} pediu para entrar na box.`, null);
      
      // Send emails
      const admin = await prisma.user.findUnique({ where: { id: box.adminId }, select: { email: true } });
      sendWelcomeEmail(athlete, box.name); // To Athlete
      if (admin) {
        sendEmail(admin.email, `Novo Atleta Pendente - ${box.name}`, `${athlete.name} (${athlete.email}) pediu para entrar na box e aguarda validação.`);
      }
    } catch (e) { console.error('Email Error:', e.message); }

    res.json({ ok: true, boxName: box.name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/boxes/:id', authenticateToken, async (req, res) => {
  try {
    const box = await getBoxById(req.params.id);
    if (!box) return res.status(404).json({ error: 'Box não encontrada.' });
    res.json(box);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/boxes/:id/users', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const users = await getBoxUsers(req.params.id);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/boxes/:id/users/:userId/validate', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN'), async (req, res) => {
  try {
    await validateUser(req.params.userId, req.params.id);

    // Notify user they were validated
    try {
      const box = await prisma.box.findUnique({ where: { id: parseInt(req.params.id) } });
      const user = await prisma.user.findUnique({ where: { id: parseInt(req.params.userId) }, select: { id: true, name: true, email: true } });
      createNotification(user.id, 'athlete_joined', `A tua conta na box ${box.name} foi validada! Já podes marcar aulas.`, null);
      sendValidationEmail(user, box.name);
    } catch (e) { console.error('Email Error:', e.message); }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/boxes/:id/users/:userId/role', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN'), async (req, res) => {
  try {
    const { role } = req.body;
    if (role === 'ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas os administradores de sistema podem atribuir a função ADMIN.' });
    }
    await updateUserRole(req.params.userId, req.params.id, role);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/boxes/:id', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN'), async (req, res) => {
  try {
    const { name, location } = req.body;

    if (req.user.role === 'BOX_ADMIN' && req.user.boxId !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Não autorizado a gerir esta box.' });
    }

    const updated = await updateBox(req.params.id, name, location);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- WOD & Class Management (Box Scoped) ---
app.get('/api/boxes/:boxId/wods', async (req, res) => {
  try {
    const { date } = req.query;
    let where = { boxId: parseInt(req.params.boxId) };
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(startOfDay.getDate() + 1);
      
      where.date = { gte: startOfDay, lt: endOfDay };
    }

    const wods = await prisma.boxWod.findMany({
      where,
      orderBy: { date: 'desc' },
      take: date ? 1 : 10
    });
    res.json(wods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/boxes/:boxId/classes', async (req, res) => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const today = new Date(targetDate);
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const classes = await prisma.gymClass.findMany({
      where: {
        boxId: parseInt(req.params.boxId),
        startTime: { gte: today, lt: tomorrow },
        cancelledAt: null
      },
      include: {
        coach: { select: { name: true } },
        bookings: { 
          where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } },
          include: { user: { select: { id: true, name: true } } }
        }
      },
      orderBy: { startTime: 'asc' }
    });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/boxes/:boxId/wods', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const { title, content, stimulus, date } = req.body;
    const newWod = await createBoxWod(req.params.boxId, date || new Date(), title, content, stimulus);
    res.status(201).json(newWod);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/boxes/:boxId/wods/bulk', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const { wods, startDate } = req.body;
    if (!wods || !Array.isArray(wods)) throw new Error('O formato dos wods deve ser um array.');
    
    let currentDate = new Date(startDate || new Date());
    const createdWods = [];

    for (let i = 0; i < wods.length; i++) {
      const wod = wods[i];
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      
      const newWod = await createBoxWod(
        req.params.boxId, 
        dateStr, 
        wod.title || `WOD Dia ${i+1}`, 
        { warmup: wod.warmup, main: wod.workout, cooldown: wod.cooldown || '' }, 
        wod.stimulus || ''
      );
      createdWods.push(newWod);
      
      // Increment 1 day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    res.status(201).json(createdWods);
  } catch (err) {
    console.error('Bulk WOD creation error:', err);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/boxes/:boxId/schedule/week', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const schedule = await getWeekSchedule(req.params.boxId, date || new Date());
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deprecated or keep for basic mobile use? Updated to call createClass with new fields
app.post('/api/boxes/:boxId/classes', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const { name, startTime, endTime, capacity, location, coachId } = req.body;
    const newClass = await createClass(req.params.boxId, name, startTime, endTime, capacity, location, coachId);
    res.status(201).json(newClass);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Admin Dedicated Endpoints ---
app.post('/api/admin/classes', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const { name, date, startTime, endTime, capacity, location, coachId, boxId, recurrence, recurrenceEndDate } = req.body;
    // Combine date and time
    const start = new Date(`${date}T${startTime}`);
    const end = endTime ? new Date(`${date}T${endTime}`) : null;
    
    const newClass = await createClass(boxId, name, start, end, capacity, location, coachId, recurrence, recurrenceEndDate);
    res.status(201).json(newClass);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/admin/classes/:id', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const { name, date, startTime, endTime, capacity, location, coachId, updateAllSeries, recurrence, recurrenceEndDate } = req.body;
    const classId = parseInt(req.params.id);
    const start = new Date(`${date}T${startTime}`);
    const end = endTime ? new Date(`${date}T${endTime}`) : null;

    const updated = await updateClass(classId, {
      name,
      startTime: start,
      endTime: end,
      capacity,
      location,
      coachId,
      updateAllSeries,
      recurrence,
      recurrenceEndDate
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/classes/:id', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const { deleteAllSeries } = req.query;
    const classId = parseInt(req.params.id);

    const targetClass = await prisma.gymClass.findUnique({ where: { id: classId } });
    if (!targetClass) return res.status(404).json({ error: 'Aula não encontrada' });

    if (deleteAllSeries === 'true' && targetClass.seriesId) {
      // Find all affected classes and their bookings
      const classes = await prisma.gymClass.findMany({ where: { seriesId: targetClass.seriesId }, include: { bookings: true } });
      for (const cls of classes) {
        const timeStr = new Date(cls.startTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(cls.startTime).toLocaleDateString('pt-PT');
        for (const b of cls.bookings) {
          if (b.status === 'CONFIRMED' || b.status === 'WAITLIST') {
            createNotification(b.userId, 'class_cancelled', `A série de aulas ${cls.name} (${dateStr} às ${timeStr}) foi cancelada.`, null);
          }
        }
      }
      await prisma.gymClass.deleteMany({
        where: { seriesId: targetClass.seriesId }
      });
      return res.json({ ok: true, message: 'Série apagada' });
    } else {
      // Notify bookings of this single class
      const cls = await prisma.gymClass.findUnique({ where: { id: classId }, include: { bookings: true } });
      if (cls) {
        const timeStr = new Date(cls.startTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(cls.startTime).toLocaleDateString('pt-PT');
        for (const b of cls.bookings) {
          if (b.status === 'CONFIRMED' || b.status === 'WAITLIST') {
            createNotification(b.userId, 'class_cancelled', `A aula ${cls.name} de ${dateStr} às ${timeStr} foi cancelada.`, null);
          }
        }
      }
      await prisma.gymClass.delete({ where: { id: classId } });
      return res.json({ ok: true, message: 'Aula apagada' });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/classes/:id/bookings', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { classId: parseInt(req.params.id) },
      include: { user: { select: { name: true, email: true } } },
      orderBy: [
        { status: 'asc' }, // CONFIRMED first
        { waitlistPosition: 'asc' },
        { registeredAt: 'asc' }
      ]
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/bookings/:id/checkin', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { gymClass: true }
    });

    if (!booking) return res.status(404).json({ error: 'Inscrição não encontrada.' });

    let data = { checkInAt: new Date() };

    // If waitlisted, promote to confirmed if there's space (though usually admin does this manually or system does it on cancel)
    if (booking.status === 'WAITLISTED') {
      const confirmedCount = await prisma.booking.count({
        where: { classId: booking.classId, status: 'CONFIRMED' }
      });
      if (confirmedCount < booking.gymClass.capacity) {
        data.status = 'CONFIRMED';
        data.waitlistPosition = null;
      } else {
        return res.status(400).json({ error: 'Não é possível fazer check-in: Aula lotada e atleta em lista de espera.' });
      }
    }

    const updated = await prisma.booking.update({
      where: { id: parseInt(req.params.id) },
      data
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/bookings/:id', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!booking) return res.status(404).json({ error: 'Inscrição não encontrada.' });

    await prisma.booking.delete({ where: { id: parseInt(req.params.id) } });

    // Auto-promote next in waitlist if a confirmed spot opened
    if (booking.status === 'CONFIRMED') {
      await promoteWaitlist(booking.classId);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/coaches', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const { boxId } = req.query;
    const coaches = await prisma.user.findMany({
      where: { boxId: parseInt(boxId), role: 'COACH' },
      select: { id: true, name: true, email: true }
    });
    res.json(coaches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.body;
    const booking = await bookClass(req.user.userId, classId);

    // Notify the coach of the class
    try {
      const cls = await prisma.gymClass.findUnique({ where: { id: classId }, include: { coach: { select: { id: true, name: true } } } });
      const athlete = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } });
      if (cls?.coachId) {
        const timeStr = new Date(cls.startTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        createNotification(cls.coachId, 'booking_new', `${athlete.name} inscreveu-se na aula das ${timeStr}`, classId);
      }
    } catch (e) {}

    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/bookings/:bookingId', authenticateToken, async (req, res) => {
  try {
    console.log('[Cancel Booking] Params:', req.params);
    const bId = parseInt(req.params.bookingId);
    const uId = req.user.userId;
    console.log(`[Cancel Booking] ID Parsed: ${bId}, User: ${uId}`);

    if (isNaN(bId)) {
      return res.status(400).json({ error: 'ID de inscrição inválido.' });
    }

    const booking = await prisma.booking.findFirst({
      where: { 
        id: bId,
        userId: uId
      }
    });
    
    if (!booking) {
      console.log(`[Cancel Booking] Not found for user ${uId}`);
      return res.status(404).json({ error: 'Inscrição não encontrada.' });
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED', waitlistPosition: null }
    });

    if (booking.status === 'CONFIRMED') {
      // Promote next in waitlist and notify them
      const promoted = await promoteWaitlist(booking.classId);
      try {
        const cls = await prisma.gymClass.findUnique({ where: { id: booking.classId } });
        // Notify coach
        if (cls?.coachId) {
          const athlete = await prisma.user.findUnique({ where: { id: uId }, select: { name: true } });
          const timeStr = new Date(cls.startTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
          createNotification(cls.coachId, 'booking_cancel', `${athlete.name} cancelou a inscrição na aula das ${timeStr}`, booking.classId);
        }
        // Notify the promoted athlete
        const waitlistNext = await prisma.booking.findFirst({ where: { classId: booking.classId, status: 'CONFIRMED', id: { not: booking.id } }, orderBy: { registeredAt: 'desc' } });
        if (waitlistNext) {
          const timeStr = new Date(cls.startTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
          createNotification(waitlistNext.userId, 'waitlist_promoted', `Boa notícia! Passaste da lista de espera para a aula das ${timeStr}`, booking.classId);
        }
      } catch (e) {}
    } else {
      await promoteWaitlist(booking.classId);
    }
    
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Notifications ---
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, read: false },
      data: { read: true }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: parseInt(req.params.id), userId: req.user.userId },
      data: { read: true }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function calculateScoreValue(score, scoreType) {
  if (!score) return 0;
  const cleanScore = score.toString().trim();
  
  if (scoreType === 'TIME') {
    const parts = cleanScore.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return parseFloat(cleanScore.replace(/[^0-9.]/g, '')) || 0;
  }
  
  if (scoreType === 'WEIGHT_AND_TIME') {
    const weightMatch = cleanScore.match(/(\d+(?:\.\d+)?)\s*(?:kg|lbs|quilos|kilos)?/i);
    const timeMatch = cleanScore.match(/(\d{1,2}):(\d{2})/);
    
    let weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
    let seconds = timeMatch ? parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]) : 0;
    
    // Weight wins (Higher is better), Time tie-breaks (Lower is better)
    // Formula: Weight - (seconds / 100000)
    // Example: 100kg in 10:00 -> 100 - (600/100000) = 99.994
    // Example: 100kg in 11:00 -> 100 - (660/100000) = 99.9934
    // 99.994 > 99.9934, so faster wins for same weight.
    return weight - (seconds / 100000);
  }
  
  return parseFloat(cleanScore.replace(/[^0-9.]/g, '')) || 0;
}

app.post('/api/box/results', authenticateToken, async (req, res) => {
  try {
    const { boxWodId, globalWodId, scheduledWorkoutId, score, type, notes, scoreType } = req.body;
    
    const scoreValue = calculateScoreValue(score, scoreType || 'REPS');

    // Check for existing result to avoid duplicates, but only if an ID is provided
    let existing = null;
    if (boxWodId || globalWodId || scheduledWorkoutId) {
      existing = await prisma.result.findFirst({
        where: {
          userId: req.user.userId,
          boxWodId: boxWodId ? parseInt(boxWodId) : undefined,
          globalWodId: globalWodId ? parseInt(globalWodId) : undefined,
          scheduledWorkoutId: scheduledWorkoutId ? parseInt(scheduledWorkoutId) : undefined,
        }
      });
    }

    if (existing) {
      const updated = await prisma.result.update({
        where: { id: existing.id },
        data: { score, scoreValue, type, notes }
      });
      return res.json(updated);
    }

    const result = await prisma.result.create({
      data: {
        userId: req.user.userId,
        boxWodId: boxWodId ? parseInt(boxWodId) : null,
        globalWodId: globalWodId ? parseInt(globalWodId) : null,
        scheduledWorkoutId: scheduledWorkoutId ? parseInt(scheduledWorkoutId) : null,
        score,
        scoreValue,
        type,
        notes
      }
    });

    if (scheduledWorkoutId) {
      await prisma.scheduledWorkout.update({
        where: { id: parseInt(scheduledWorkoutId) },
        data: { completed: true }
      });
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/boxes/:boxId/results', async (req, res) => {
  try {
    const { boxWodId, globalWodId, scheduledWorkoutId } = req.query;
    
    let sortOrder = 'desc';
    if (boxWodId) {
      const wod = await prisma.boxWod.findUnique({ where: { id: parseInt(boxWodId) } });
      if (wod?.scoreType === 'TIME') sortOrder = 'asc';
    } else if (globalWodId) {
      const wod = await prisma.globalWod.findUnique({ where: { id: parseInt(globalWodId) } });
      if (wod?.scoreType === 'TIME') sortOrder = 'asc';
    }

    const results = await prisma.result.findMany({
      where: {
        boxWodId: boxWodId ? parseInt(boxWodId) : undefined,
        globalWodId: globalWodId ? parseInt(globalWodId) : undefined,
        scheduledWorkoutId: scheduledWorkoutId ? parseInt(scheduledWorkoutId) : undefined,
      },
      include: { user: { select: { name: true } } },
      orderBy: [
        { scoreValue: sortOrder },
        { createdAt: 'asc' } // Tie-breaker: who submitted first
      ]
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plans', authenticateToken, async (req, res) => {
  try {
    const { title, sessions, goal, startDate, coachingDecision } = planSchema.parse(req.body);
    console.log('[API] Saving Plan with Coaching Decision:', coachingDecision ? 'Yes' : 'No');
    const start = startDate ? new Date(startDate) : new Date();

    // Removed auto-deactivation of ALL other plans to support Multi-Plan functionality.
    // We only deactivate a plan if it has the EXACT same title (optional, but safer).
    await prisma.userPlan.updateMany({
      where: { userId: req.user.userId, title, active: true },
      data: { active: false }
    });

    const newPlan = await prisma.userPlan.create({
      data: {
        userId: req.user.userId,
        title,
        goal,
        active: true,
        startDate: start,
        coachingInsights: coachingDecision || null,
        workouts: {
          create: sessions.map((s, index) => {
            const workoutDate = new Date(start);
            workoutDate.setDate(start.getDate() + index);
            return {
              day: s.day,
              date: workoutDate,
              focus: s.focus,
              content: s
            }
          })
        }
      },
      include: { workouts: true }
    });

    res.status(201).json(newPlan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const results = await prisma.result.findMany({
      where: { userId: req.user.userId },
      include: {
        boxWod: true,
        globalWod: true,
        scheduledWorkout: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/profile/benchmarks', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { profile: true }
    });

    const profile = user.profile || {};
    res.json(profile.liftBenchmarks || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/benchmarks', authenticateToken, async (req, res) => {
  try {
    const { benchmarks } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    const currentProfile = user.profile || {};
    const updatedProfile = {
      ...currentProfile,
      liftBenchmarks: benchmarks
    };

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { profile: updatedProfile }
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/plans/active', authenticateToken, async (req, res) => {
  try {
    const plans = await prisma.userPlan.findMany({
      where: { userId: req.user.userId, active: true },
      include: {
        workouts: {
          orderBy: { day: 'asc' },
          include: { results: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log('[API] Sending active plans. First plan insights:', plans[0]?.coachingInsights ? 'Yes' : 'No');
    res.json(plans); // Returns array of active plans
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/plans/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.userPlan.updateMany({
      where: { 
        id: parseInt(req.params.id),
        userId: req.user.userId // Security: Only owner can delete
      },
      data: { active: false }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const results = await prisma.result.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });

    // Points: 10 per workout
    const points = results.length * 10;

    // Streak calculation
    let streak = 0;
    if (results.length > 0) {
      const dates = results.map(r => new Date(r.createdAt).toDateString());
      const uniqueDates = [...new Set(dates)];

      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      let cursor = 0;
      let checkDate = new Date();

      // If no workout today or yesterday, streak is 0
      if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
        if (uniqueDates[0] === yesterday && uniqueDates.indexOf(today) === -1) {
          // still valid streak if yesterday was active but today not yet
        }

        for (let i = 0; i < uniqueDates.length; i++) {
          const d = new Date(uniqueDates[i]);
          const expected = new Date();
          expected.setDate(expected.getDate() - i);

          // If there's a gap larger than 1 day from today (or from the last check), break
          // Since we sorted by desc, we just check if dates are consecutive
          const diff = Math.floor((new Date(uniqueDates[0]) - new Date(uniqueDates[i])) / 86400000);
          if (diff === i) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    res.json({ points, streak });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/workouts/:id/complete', authenticateToken, async (req, res) => {
  try {
    const workout = await prisma.scheduledWorkout.update({
      where: { id: parseInt(req.params.id) },
      data: { completed: true }
    });
    res.json(workout);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/generate-plan', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const data = req.body;
    const userId = req.user.userId;

    // ── 1. Buscar último treino completado para last_session real ──────────────
    const lastCompletedWorkout = await prisma.scheduledWorkout.findFirst({
      where: { plan: { userId }, completed: true },
      orderBy: { date: 'desc' }
    });

    const lastResult = lastCompletedWorkout
      ? await prisma.result.findFirst({
          where: { userId, scheduledWorkoutId: lastCompletedWorkout.id },
          orderBy: { createdAt: 'desc' }
        })
      : null;

    // Calcular dias desde o último descanso (dias sem treino)
    let daysSinceRest = 1;
    if (lastCompletedWorkout?.date) {
      const msPerDay = 1000 * 60 * 60 * 24;
      daysSinceRest = Math.round((Date.now() - new Date(lastCompletedWorkout.date).getTime()) / msPerDay);
      daysSinceRest = Math.max(0, Math.min(daysSinceRest, 10)); // clamp 0-10
    }

    // Formatar last_session real
    const lastSession = lastCompletedWorkout ? {
      date: lastCompletedWorkout.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      muscle_groups: lastCompletedWorkout.focus
        ? lastCompletedWorkout.focus.split(/[\s,+\/]+/).filter(Boolean).slice(0, 4)
        : [],
      rpe_reported: lastResult?.score ? parseInt(lastResult.score) || 7 : 7,
      completed: lastCompletedWorkout.completed,
      notes: lastResult?.notes || ''
    } : null;

    // ── 2. Buscar histórico recente de resultados (para contexto da IA) ────────
    const recentResults = await prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { scheduledWorkout: true, boxWod: true, globalWod: true }
    });

    const history = recentResults.map(r => ({
      date: r.createdAt,
      workout: r.scheduledWorkout?.focus || r.boxWod?.title || r.globalWod?.name || 'Treino',
      score: r.score,
      notes: r.notes
    }));

    // Resumo da última semana (para o Treinador)
    const planFeedbackResults = recentResults.filter(r => r.type === 'plan_feedback');
    let weeklyAssessment = null;
    
    if (planFeedbackResults.length > 0) {
      const completedCount = planFeedbackResults.filter(r => {
        try { return JSON.parse(r.notes).completed === true; } catch(e) { return true; }
      }).length;
      
      const avgRpe = planFeedbackResults.reduce((acc, r) => acc + (parseFloat(r.score) || 7), 0) / planFeedbackResults.length;
      
      weeklyAssessment = {
        workouts_completed: completedCount,
        workouts_attempted: planFeedbackResults.length,
        average_rpe: avgRpe.toFixed(1),
        notable_feedback: planFeedbackResults
          .map(r => { try { return JSON.parse(r.notes).comment; } catch(e) { return r.notes; } })
          .filter(c => c && c.length > 0).join(' | ')
      };
    }

    // ── 3. Montar state_today a partir do frontend ─────────────────────────────
    const stateToday = {
      energy: data.energy || 'normal',
      sleep_hours: parseInt(data.sleep_hours) || 7,
      stress: data.stress || 'normal',
      days_since_rest: daysSinceRest
    };

    // ── 4. Injetar tudo no payload da IA ──────────────────────────────────────
    const enhancedData = {
      ...data,
      history,
      lastSession,
      stateToday,
      weeklyAssessment
    };

    const plan = await generateMultiDayPlan('gemini', enhancedData);
    res.json(plan);
  } catch (err) {
    console.error('Plan generation failed:', err);
    res.status(500).json({ error: 'Plan generation failed', details: err.message });
  }
});

// ─── Workout Complete + Feedback ─────────────────────────────────────────────
app.post('/api/workouts/:workoutId/complete', authenticateToken, async (req, res) => {
  try {
    const workoutId = parseInt(req.params.workoutId);
    const { rpe, completed, notes } = req.body;
    const userId = req.user.userId;

    // Verify ownership
    const workout = await prisma.scheduledWorkout.findFirst({
      where: { id: workoutId, plan: { userId } },
      include: { plan: true }
    });
    if (!workout) return res.status(404).json({ error: 'Treino não encontrado.' });

    // Mark as completed
    await prisma.scheduledWorkout.update({
      where: { id: workoutId },
      data: { completed: true }
    });

    // Process feedback via AI (non-blocking — if it fails, we still save the result)
    let processedFeedback = null;
    try {
      const { PROMPTS } = require('./services/fittraining-prompts-v2');
      const { baseUrl, apiKey } = { baseUrl: 'https://gen.pollinations.ai', apiKey: process.env.POLLINATIONS_API_KEY || 'sk_qYxYPRzO3EjO8TDaFEwxGAKhb3QBSBbM' };

      const workoutSummary = {
        focus: workout.focus,
        day: workout.day,
        date: workout.date,
        content_summary: workout.content?.exercises?.slice(0, 3).map(e => e.name).join(', ') || workout.focus
      };

      const { callGeminiAdapter } = require('./services/ai-service');
      processedFeedback = await callGeminiAdapter(
        baseUrl, apiKey,
        PROMPTS.FEEDBACK.system,
        PROMPTS.FEEDBACK.user(workoutSummary, { rpe, completed, comment: notes })
      );
    } catch (fbErr) {
      console.warn('[Feedback] AI processing skipped:', fbErr.message);
    }

    // Save result (RPE as score, feedback JSON in notes)
    const result = await prisma.result.create({
      data: {
        userId,
        scheduledWorkoutId: workoutId,
        score: String(rpe),
        scoreValue: parseFloat(rpe),
        type: 'plan_feedback',
        notes: JSON.stringify({
          rpe,
          completed,
          comment: notes || '',
          aiProcessed: processedFeedback
        })
      }
    });

    console.log(`[Feedback] Workout ${workoutId} completed (RPE ${rpe}) by user ${userId}`);
    res.json({ success: true, resultId: result.id, feedback: processedFeedback });
  } catch (err) {
    console.error('[Feedback] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/test-ai', async (req, res) => {
  const { provider, apiKey } = req.body;
  try {
    const result = await testConnection(provider, apiKey);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/generate-workout', aiLimiter, async (req, res) => {
  try {
    const { prompt, goal } = req.body;
    const result = await generateWod(prompt, goal);
    res.json(result);
  } catch (err) {
    console.error('WOD generation failed:', err);
    res.status(500).json({ error: 'Falha ao gerar WOD via IA.', details: err.message });
  }
});

app.post('/api/generate-box-plan', aiLimiter, async (req, res) => {
  try {
    const { prompt, days } = req.body;
    const plan = await generateBoxWodPlan(prompt, parseInt(days) || 5);
    res.json(plan);
  } catch (err) {
    console.error('Box plan generation failed:', err);
    res.status(500).json({ error: 'Falha ao gerar plano via IA.', details: err.message });
  }
});

// Serve frontend static files
const publicPath = path.join(__dirname, 'public');

// --- Custom Workouts Library ---
// --- Generator Endpoints ---
// --- Custom Workouts Library ---
app.get('/api/custom-workouts', authenticateToken, async (req, res) => {
  try {
    const workouts = await prisma.customWorkout.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(workouts);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/custom-workouts', authenticateToken, async (req, res) => {
  try {
    const { name, type, source, rawText } = req.body;
    if (!name || !rawText) {
      return res.status(400).json({ error: 'Nome e texto do treino são obrigatórios.' });
    }

    const parsed = await parseWorkoutText(rawText, type || 'outro');

    const workout = await prisma.customWorkout.create({
      data: {
        userId: req.user.userId,
        name,
        type: type || 'outro',
        source: source || null,
        rawText,
        exercises: parsed.exercises,
        structure: parsed.structure,
        aiNotes: parsed.aiNotes
      }
    });

    // Inject new exercises into the main exercises array for future AI prompts
    const existingNames = new Set(exercises.map(e => e.name.toLowerCase()));
    let injected = 0;
    for (const ex of parsed.exercises) {
      if (!existingNames.has(ex.name.toLowerCase()) && ex.name !== '?' && ex.reps !== '?') {
        exercises.push({
          id: exercises.length + 1,
          name: ex.name,
          muscle_groups: [],
          equipment: [],
          type: type || 'outro',
          source: 'custom-library'
        });
        existingNames.add(ex.name.toLowerCase());
        injected++;
      }
    }
    if (injected > 0) {
      // Still writing to exercises.json for now as it's not fully DB migrated
      const exercisesPath = path.join(__dirname, 'data', 'exercises.json');
      fs.writeFileSync(exercisesPath, JSON.stringify(exercises, null, 2), 'utf8');
      console.log(`[Custom Library] Injected ${injected} new exercise(s) into exercises.json`);
    }

    res.json(workout);
  } catch (err) {
    console.error('Custom workout save error:', err);
    res.status(500).json({ error: 'Erro ao processar o treino: ' + err.message });
  }
});

app.delete('/api/custom-workouts/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.customWorkout.deleteMany({
      where: { id: req.params.id, userId: req.user.userId }
    });
    res.json({ ok: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});
if (fs.existsSync(publicPath)) {
  console.log(`[Static] Serving from ${publicPath}`);

  // Debug logger for static assets
  app.use((req, res, next) => {
    if (req.path.includes('assets/')) {
      console.log(`[Static Request] ${req.method} ${req.path}`);
    }
    next();
  });

  // Serve static files both at root and at the /fittraining prefix
  // Explicitly handle assets to ensure they don't fall through
  app.use('/fittraining/assets', express.static(path.join(publicPath, 'assets')));
  app.use('/assets', express.static(path.join(publicPath, 'assets')));

  app.use('/fittraining', express.static(publicPath));
  app.use(express.static(publicPath));

  // Serve Super-Admin standalone page
  const superadminPath = path.join(__dirname, 'superadmin');
  app.use('/superadmin', express.static(superadminPath));
  app.get('/superadmin', (req, res) => res.sendFile(path.join(superadminPath, 'index.html')));

  // Handle SPA routing: Only send index.html if the request doesn't have a file extension
  const sendIndex = (req, res) => {
    if (req.path.includes('.')) {
      console.warn(`[404] File not found: ${req.path}`);
      return res.status(404).send('Not found');
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  };

  app.get(['/fittraining', '/fittraining/*'], sendIndex);
  app.get('*', sendIndex);
}

const http = require('http');

const startServer = (port) => {
  const server = http.createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ PORTA ${port} OCUPADA!`);
      console.error(`   Não é possível iniciar o servidor na porta ${port}.`);
      console.error(`   Corre 'fuser -k ${port}/tcp' para libertar o porto.`);
      process.exit(1);
    } else {
      console.error(err);
    }
  });

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startServer(parseInt(PORT, 10));
