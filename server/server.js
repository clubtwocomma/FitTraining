const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const prisma = require('./lib/prisma');

const rateLimit = require('express-rate-limit');
const { z } = require('zod');

// Rate limiter for AI endpoints (10 requests per 15 minutes)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // A bit higher for testing but protects against abuse
  message: { error: 'Limite de gerações por IA atingido. Tenta novamente em 15 minutos.' }
});

// ─── Gerações por IA em segundo plano ────────────────────────────────────────
// Um plano de 7 dias demora ~60 s ou mais a gerar, e o nginx corta pedidos
// ao fim de 60 s (504). Com o cabeçalho "X-Async: 1" o servidor responde logo
// 202 { jobId } e o handler continua a correr; o cliente consulta
// GET /api/jobs/:id até o estado ser "done" ou "error". Sem o cabeçalho,
// tudo funciona como antes (versões antigas da app em cache).
const aiJobs = new Map();
const AI_JOB_TTL_MS = 30 * 60 * 1000;

function asyncJob(req, res, next) {
  if (req.get('X-Async') !== '1') return next();
  const jobId = require('crypto').randomUUID();
  const job = { userId: req.user.userId, status: 'running', createdAt: Date.now() };
  aiJobs.set(jobId, job);
  res.status(202).json({ jobId });
  // Daqui em diante o handler escreve no job em vez de na resposta (já enviada).
  let code = 200;
  res.status = (c) => { code = c; return res; };
  res.json = (body) => {
    job.status = code >= 400 ? 'error' : 'done';
    job.httpStatus = code;
    job.body = body;
    job.finishedAt = Date.now();
    return res;
  };
  res.send = res.json;
  next();
}

setInterval(() => {
  const cutoff = Date.now() - AI_JOB_TTL_MS;
  aiJobs.forEach((j, id) => { if (j.createdAt < cutoff) aiJobs.delete(id); });
}, 5 * 60 * 1000).unref();

// Rate limiter for login (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas tentativas de login. Tenta novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
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
  password: z.string().min(8),
  name: z.string().min(2)
});

const { generateWorkout } = require('./utils/generator');
const { testConnection, generateMultiDayPlan, parseWorkoutText, generateWod, generateBoxWodPlan, getDefaultModel, setDefaultModel } = require('./services/ai-service');
const { fetchAvailableModels } = require('./services/pollinations-models');
const { listPrompts, setOverride: setPromptOverride, clearOverride: clearPromptOverride, loadAllOverrides: loadPromptOverrides } = require('./services/prompt-overrides');
const { 
  registerUser, loginUser, updateProfile, authenticateToken, optionalAuthenticateToken, authorizeRoles,
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

// ─── Multi-tenant isolation ──────────────────────────────────────────────────
// Impede que um BOX_ADMIN/COACH de uma box giram recursos de outra box.
// ADMIN (super-admin do sistema) tem sempre acesso.
function requireSameBox(req, res, next) {
  if (req.user.role === 'ADMIN') return next();
  const boxId = parseInt(req.params.boxId || req.params.id || req.body.boxId || req.query.boxId);
  if (!boxId || req.user.boxId !== boxId) {
    return res.status(403).json({ error: 'Não autorizado a gerir esta box.' });
  }
  next();
}

// Para rotas que só têm classId/bookingId: resolve o boxId associado e valida.
async function requireSameBoxForClass(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') return next();
    const classId = parseInt(req.params.id || req.params.classId);
    const cls = await prisma.gymClass.findUnique({ where: { id: classId }, select: { boxId: true } });
    if (!cls) return res.status(404).json({ error: 'Aula não encontrada.' });
    if (req.user.boxId !== cls.boxId) {
      return res.status(403).json({ error: 'Não autorizado a gerir esta box.' });
    }
    next();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function requireSameBoxForBooking(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') return next();
    const bookingId = parseInt(req.params.id);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { gymClass: { select: { boxId: true } } } });
    if (!booking) return res.status(404).json({ error: 'Inscrição não encontrada.' });
    if (req.user.boxId !== booking.gymClass.boxId) {
      return res.status(403).json({ error: 'Não autorizado a gerir esta box.' });
    }
    next();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const {
  createBox, getBoxById, getBoxByInviteCode, getBoxUsers, validateUser, updateUserRole,
  createClass, updateClass, bookClass, getBoxSchedule, getWeekSchedule, promoteWaitlist, createBoxWod, updateBox
} = require('./services/box-service');

const app = express();
app.set('trust proxy', 1); // Confia no IP reencaminhado pelo Nginx
const PORT = process.env.PORT || 5050;

app.use(helmet({
  contentSecurityPolicy: false, // App is served via Nginx which may set its own CSP; avoid breaking the SPA for now
  // O default do helmet (`no-referrer`) faz com que os embeds do YouTube na TV
  // rebentem com "Erro 153" — o player exige um Referer válido. Este valor é o
  // default dos browsers: envia só a origem para terceiros, nunca o path.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Same-origin deployment behind Nginx (see nginx_fittraining.conf); restrict
// cross-origin API access to an explicit allowlist instead of reflecting any origin.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const user = await registerUser(email, password, name);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: 'Email ou palavra-passe incorretos.' });
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

// Chaves do perfil geridas por endpoints próprios (objetivos e check-ins diários).
// O PATCH do perfil substitui o objeto inteiro, por isso estas chaves são preservadas
// quando o cliente não as envia, para que guardar as definições não as apague.
const SERVER_MANAGED_PROFILE_KEYS = ['goals', 'checkins'];

const mergeProfile = async (userId, patch) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profile: true } });
  const current = user?.profile || {};
  return prisma.user.update({ where: { id: userId }, data: { profile: { ...current, ...patch } } });
};

app.patch('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { profile } = req.body;
    const existing = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { profile: true } });
    const preserved = {};
    SERVER_MANAGED_PROFILE_KEYS.forEach(k => {
      if (profile && !(k in profile) && existing?.profile?.[k] !== undefined) preserved[k] = existing.profile[k];
    });
    const user = await updateProfile(req.user.userId, { ...profile, ...preserved });
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

// Load exercises from the DB into memory (read-mostly, small enough to cache
// for the generator's synchronous filtering — see server/utils/generator.js).
let exercises = [];

async function loadExercisesFromDB() {
  const rows = await prisma.exercise.findMany();
  exercises = rows.map(r => ({
    id: String(r.id),
    name: r.name,
    name_en: r.nameEn || undefined,
    muscle_groups: r.muscleGroups,
    equipment: r.equipment,
    type: r.type,
    safety_notes: r.safetyNotes || '',
    default_reps: r.defaultReps || '10-12',
    default_time: r.defaultTime || 0
  }));
  console.log(`[Exercises] ${exercises.length} exercícios carregados da BD.`);
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

app.post('/api/generate', authenticateToken, aiLimiter, asyncJob, (req, res) => {
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

// --- AI Model Selection (Pollinations.ai) ---
const AI_MODEL_SETTING_KEY = 'pollinations_default_model';

app.get('/api/superadmin/ai-models', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const models = await fetchAvailableModels();
    res.json({ models, currentModel: getDefaultModel() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/superadmin/ai-model', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { model } = req.body;
    if (!model || typeof model !== 'string') {
      return res.status(400).json({ error: 'Modelo inválido.' });
    }
    await prisma.appSetting.upsert({
      where: { key: AI_MODEL_SETTING_KEY },
      update: { value: model },
      create: { key: AI_MODEL_SETTING_KEY, value: model }
    });
    setDefaultModel(model);
    console.log(`[SuperAdmin] Modelo Pollinations por defeito alterado para: ${model}`);
    res.json({ ok: true, model });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- AI Prompt Overrides (Planos de Treino & Box WODs) ---
app.get('/api/superadmin/prompts', authenticateToken, authorizeRoles('ADMIN'), (req, res) => {
  try {
    res.json({ prompts: listPrompts() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/superadmin/prompts', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { key, modality, text } = req.body;
    if (!key || typeof key !== 'string' || !text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Prompt inválido: chave e texto são obrigatórios.' });
    }
    const result = await setPromptOverride(key, modality, text);
    console.log(`[SuperAdmin] Prompt "${key}" (${result.modality || 'default'}) personalizado.`);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/superadmin/prompts/reset', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { key, modality } = req.body;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Chave do prompt é obrigatória.' });
    }
    const result = await clearPromptOverride(key, modality);
    console.log(`[SuperAdmin] Prompt "${key}" (${result.modality || 'default'}) reposto ao padrão.`);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    await prisma.$transaction(async (tx) => {
      // Results referencing this box's WODs must go first (no cascade on that FK)
      const boxWods = await tx.boxWod.findMany({ where: { boxId }, select: { id: true } });
      const boxWodIds = boxWods.map(w => w.id);
      if (boxWodIds.length > 0) {
        await tx.result.deleteMany({ where: { boxWodId: { in: boxWodIds } } });
      }
      await tx.gymClass.deleteMany({ where: { boxId } });
      await tx.boxWod.deleteMany({ where: { boxId } });
      // Mensalidades da box (pagamentos → inscrições → planos, pela ordem das FKs)
      await tx.payment.deleteMany({ where: { boxId } });
      await tx.membership.deleteMany({ where: { boxId } });
      await tx.membershipPlan.deleteMany({ where: { boxId } });
      await tx.user.updateMany({ where: { boxId }, data: { boxId: null, role: 'ATHLETE', boxValidated: false } });
      await tx.box.delete({ where: { id: boxId } });
    });
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

app.get('/api/boxes/:id', authenticateToken, requireSameBox, async (req, res) => {
  try {
    const box = await getBoxById(req.params.id);
    if (!box) return res.status(404).json({ error: 'Box não encontrada.' });
    res.json(box);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/boxes/:id/users', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBox, async (req, res) => {
  try {
    const users = await getBoxUsers(req.params.id);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/boxes/:id/users/:userId/validate', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN'), requireSameBox, async (req, res) => {
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

app.patch('/api/boxes/:id/users/:userId/role', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN'), requireSameBox, async (req, res) => {
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

app.get('/api/jobs/:id', authenticateToken, (req, res) => {
  const job = aiJobs.get(req.params.id);
  if (!job || job.userId !== req.user.userId) return res.status(404).json({ error: 'Tarefa não encontrada ou expirada.' });
  if (job.status === 'running') return res.json({ status: 'running', elapsedMs: Date.now() - job.createdAt });
  res.json({ status: job.status, httpStatus: job.httpStatus, body: job.body });
});

// --- Mensalidades (ligáveis por box) e regras de marcação ---
const billing = require('./services/billing-service');
const boxAdminOnly = [authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN'), requireSameBox];
const sendErr = (res, err) => res.status(/não encontrad/i.test(err.message) ? 404 : 400).json({ error: err.message });

app.get('/api/boxes/:id/billing', ...boxAdminOnly, async (req, res) => {
  try { res.json(await billing.getBillingOverview(req.params.id)); } catch (err) { sendErr(res, err); }
});
app.patch('/api/boxes/:id/billing/settings', ...boxAdminOnly, async (req, res) => {
  try { await billing.updateBillingSettings(req.params.id, req.body || {}); res.json(await billing.getBillingOverview(req.params.id)); } catch (err) { sendErr(res, err); }
});
app.post('/api/boxes/:id/billing/plans', ...boxAdminOnly, async (req, res) => {
  try { res.status(201).json(await billing.createPlan(req.params.id, req.body || {})); } catch (err) { sendErr(res, err); }
});
app.patch('/api/boxes/:id/billing/plans/:planId', ...boxAdminOnly, async (req, res) => {
  try { res.json(await billing.updatePlan(req.params.id, req.params.planId, req.body || {})); } catch (err) { sendErr(res, err); }
});
app.put('/api/boxes/:id/billing/members/:userId', ...boxAdminOnly, async (req, res) => {
  try { res.json(await billing.assignMembership(req.params.id, req.params.userId, req.body || {})); } catch (err) { sendErr(res, err); }
});
app.delete('/api/boxes/:id/billing/members/:userId', ...boxAdminOnly, async (req, res) => {
  try { res.json(await billing.endMembership(req.params.id, req.params.userId)); } catch (err) { sendErr(res, err); }
});
app.get('/api/boxes/:id/billing/members/:userId/payments', ...boxAdminOnly, async (req, res) => {
  try { res.json(await billing.memberPayments(req.params.id, req.params.userId)); } catch (err) { sendErr(res, err); }
});
app.post('/api/boxes/:id/billing/members/:userId/payments', ...boxAdminOnly, async (req, res) => {
  try {
    const payment = await billing.recordPayment(req.params.id, req.params.userId, req.user.userId, req.body || {});
    createNotification(parseInt(req.params.userId), 'payment_recorded', `Pagamento de ${(payment.amountCents / 100).toFixed(2).replace('.', ',')} € registado. Obrigado!`, null);
    res.status(201).json(payment);
  } catch (err) { sendErr(res, err); }
});
app.delete('/api/boxes/:id/billing/payments/:paymentId', ...boxAdminOnly, async (req, res) => {
  try { res.json(await billing.deletePayment(req.params.id, req.params.paymentId)); } catch (err) { sendErr(res, err); }
});

// O atleta vê o seu plano, estado, histórico de pagamentos e as regras da box.
app.get('/api/me/membership', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { boxId: true } });
    res.json(await billing.getMyMembership(req.user.userId, user?.boxId));
  } catch (err) { sendErr(res, err); }
});

// --- WOD & Class Management (Box Scoped) ---
app.get('/api/boxes/:boxId/wods', authenticateToken, requireSameBox, async (req, res) => {
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

app.get('/api/boxes/:boxId/classes', authenticateToken, requireSameBox, async (req, res) => {
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

app.post('/api/boxes/:boxId/wods', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBox, async (req, res) => {
  try {
    const { title, content, stimulus, date } = req.body;
    const newWod = await createBoxWod(req.params.boxId, date || new Date(), title, content, stimulus);
    res.status(201).json(newWod);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/boxes/:boxId/wods/bulk', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBox, async (req, res) => {
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
        { warmup: wod.warmup, skill: wod.skill || '', skillData: wod.skillData || null, main: wod.workout, cooldown: wod.cooldown || '' }, 
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

app.get('/api/boxes/:boxId/schedule/week', authenticateToken, requireSameBox, async (req, res) => {
  try {
    const { date } = req.query;
    const schedule = await getWeekSchedule(req.params.boxId, date || new Date());
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deprecated or keep for basic mobile use? Updated to call createClass with new fields
app.post('/api/boxes/:boxId/classes', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBox, async (req, res) => {
  try {
    const { name, startTime, endTime, capacity, location, coachId } = req.body;
    const newClass = await createClass(req.params.boxId, name, startTime, endTime, capacity, location, coachId);
    res.status(201).json(newClass);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Admin Dedicated Endpoints ---
app.post('/api/admin/classes', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBox, async (req, res) => {
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

app.patch('/api/admin/classes/:id', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBoxForClass, async (req, res) => {
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

app.delete('/api/admin/classes/:id', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBoxForClass, async (req, res) => {
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
          if (b.status === 'CONFIRMED' || b.status === 'WAITLISTED') {
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
          if (b.status === 'CONFIRMED' || b.status === 'WAITLISTED') {
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

app.get('/api/admin/classes/:id/bookings', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBoxForClass, async (req, res) => {
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

app.patch('/api/admin/bookings/:id/checkin', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBoxForBooking, async (req, res) => {
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

app.delete('/api/admin/bookings/:id', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBoxForBooking, async (req, res) => {
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

app.get('/api/admin/coaches', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), requireSameBox, async (req, res) => {
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
        // Notify the athletes actually promoted from the waitlist
        for (const promotedBooking of promoted) {
          const timeStr = new Date(cls.startTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
          createNotification(promotedBooking.userId, 'waitlist_promoted', `Boa notícia! Passaste da lista de espera para a aula das ${timeStr}`, booking.classId);
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

    // Um atleta só pode submeter para um WOD da sua própria box, e só para um
    // treino agendado que lhe pertença — caso contrário dava para poluir o
    // leaderboard de qualquer outra box.
    if (boxWodId) {
      const wod = await prisma.boxWod.findUnique({
        where: { id: parseInt(boxWodId) },
        select: { boxId: true }
      });
      if (!wod) return res.status(404).json({ error: 'WOD não encontrado.' });
      if (req.user.role !== 'ADMIN' && wod.boxId !== req.user.boxId) {
        return res.status(403).json({ error: 'Não autorizado a submeter resultados para esta box.' });
      }
    }

    if (scheduledWorkoutId) {
      const owned = await prisma.scheduledWorkout.findFirst({
        where: { id: parseInt(scheduledWorkoutId), plan: { userId: req.user.userId } },
        select: { id: true }
      });
      if (!owned) return res.status(404).json({ error: 'Treino não encontrado.' });
    }

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

app.get('/api/boxes/:boxId/results', authenticateToken, requireSameBox, async (req, res) => {
  try {
    const { boxWodId, globalWodId, scheduledWorkoutId } = req.query;

    // Sem nenhum identificador, o `where` ficava todo `undefined` e a query
    // devolvia os resultados de todos os utilizadores da aplicação.
    if (!boxWodId && !globalWodId && !scheduledWorkoutId) {
      return res.status(400).json({ error: 'Indica boxWodId, globalWodId ou scheduledWorkoutId.' });
    }

    let sortOrder = 'desc';
    if (boxWodId) {
      const wod = await prisma.boxWod.findUnique({ where: { id: parseInt(boxWodId) } });
      if (!wod) return res.status(404).json({ error: 'WOD não encontrado.' });
      // O :boxId do path já foi validado contra o utilizador pelo requireSameBox;
      // falta garantir que o WOD pedido é mesmo dessa box.
      if (wod.boxId !== parseInt(req.params.boxId)) {
        return res.status(403).json({ error: 'Este WOD não pertence a esta box.' });
      }
      if (wod.scoreType === 'TIME') sortOrder = 'asc';
    } else if (globalWodId) {
      const wod = await prisma.globalWod.findUnique({ where: { id: parseInt(globalWodId) } });
      if (wod?.scoreType === 'TIME') sortOrder = 'asc';
    } else if (scheduledWorkoutId) {
      // Treinos de plano são privados do atleta.
      const owned = await prisma.scheduledWorkout.findFirst({
        where: { id: parseInt(scheduledWorkoutId), plan: { userId: req.user.userId } },
        select: { id: true }
      });
      if (!owned) return res.status(404).json({ error: 'Treino não encontrado.' });
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

app.post('/api/generate-plan', authenticateToken, aiLimiter, asyncJob, async (req, res) => {
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
    // Se o utilizador fez o check-in de hoje, usa-o quando o questionário não traz o valor.
    const profileRow = await prisma.user.findUnique({ where: { id: userId }, select: { profile: true } });
    const todayKey = new Date().toISOString().slice(0, 10);
    const checkin = profileRow?.profile?.checkins?.[todayKey];
    const level = (v) => (v == null ? null : v <= 2 ? 'baixo' : v >= 4 ? 'alto' : 'normal');
    const stateToday = {
      energy: data.energy || level(checkin?.energy) || 'normal',
      sleep_hours: parseInt(data.sleep_hours) || checkin?.sleep || 7,
      stress: data.stress || level(checkin?.stress) || 'normal',
      ...(checkin?.soreness != null && { soreness_1_to_5: checkin.soreness }),
      ...(checkin?.restingHr != null && { resting_hr: checkin.restingHr }),
      ...(checkin?.hrv != null && { hrv_ms: checkin.hrv }),
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

    // Dados opcionais do registo detalhado (sensação, duração real e séries feitas).
    // Ficam no JSON de notes, como o resto do feedback; valores fora dos limites são descartados.
    const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
    const feel = num(req.body.feel, 1, 5);
    const durationMin = num(req.body.durationMin, 1, 600);
    const setLog = Array.isArray(req.body.sets) ? req.body.sets.slice(0, 60).map(ex => ({
      name: String(ex?.name || '').slice(0, 120),
      sets: (Array.isArray(ex?.sets) ? ex.sets : []).slice(0, 20).map(st => ({
        reps: num(st?.reps, 0, 1000),
        kg: num(st?.kg, 0, 1000),
        done: !!st?.done
      }))
    })).filter(ex => ex.name && ex.sets.length) : null;

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
      const { baseUrl, apiKey } = { baseUrl: 'https://gen.pollinations.ai', apiKey: process.env.POLLINATIONS_API_KEY };

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
          ...(feel != null && { feel }),
          ...(durationMin != null && { durationMin }),
          ...(setLog?.length && { sets: setLog }),
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

// ─── Objetivos: evento-alvo com contagem decrescente e meta semanal ───────────
app.put('/api/profile/goals', authenticateToken, async (req, res) => {
  try {
    const { event, weeklyTarget } = req.body || {};
    const goals = {};
    if (event && typeof event === 'object') {
      const name = String(event.name || '').trim().slice(0, 80);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(event.date || '') ? event.date : null;
      if (!name || !date) return res.status(400).json({ error: 'O evento precisa de nome e data (AAAA-MM-DD).' });
      goals.event = { name, date };
    }
    if (weeklyTarget && typeof weeklyTarget === 'object') {
      const workouts = parseInt(weeklyTarget.workouts, 10);
      const minutes = parseInt(weeklyTarget.minutes, 10);
      goals.weeklyTarget = {
        workouts: workouts >= 1 && workouts <= 14 ? workouts : null,
        minutes: minutes >= 10 && minutes <= 3000 ? minutes : null
      };
    }
    const user = await mergeProfile(req.user.userId, { goals });
    res.json(user.profile.goals);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Check-in diário (sono, energia, stress, dores, FC em repouso) ────────────
// Guarda os últimos 120 dias no perfil; alimenta o gráfico de bem-estar e o plano da IA.
app.post('/api/profile/checkin', authenticateToken, async (req, res) => {
  try {
    const b = req.body || {};
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : null;
    if (!date) return res.status(400).json({ error: 'Data inválida.' });
    const num = (v, min, max) => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null; };
    const entry = {
      sleep: num(b.sleep, 0, 16),
      energy: num(b.energy, 1, 5),
      stress: num(b.stress, 1, 5),
      soreness: num(b.soreness, 1, 5),
      restingHr: num(b.restingHr, 25, 140),
      hrv: num(b.hrv, 5, 300)
    };
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { profile: true } });
    const checkins = { ...(user?.profile?.checkins || {}), [date]: entry };
    const trimmed = Object.fromEntries(Object.entries(checkins).sort(([a], [b2]) => b2.localeCompare(a)).slice(0, 120));
    await mergeProfile(req.user.userId, { checkins: trimmed });
    res.json({ date, ...entry });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Mover um treino planeado para outro dia ──────────────────────────────────
app.patch('/api/workouts/:workoutId/date', authenticateToken, async (req, res) => {
  try {
    const workoutId = parseInt(req.params.workoutId);
    const { date } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'Data inválida (AAAA-MM-DD).' });
    const workout = await prisma.scheduledWorkout.findFirst({ where: { id: workoutId, plan: { userId: req.user.userId } } });
    if (!workout) return res.status(404).json({ error: 'Treino não encontrado.' });
    if (workout.completed) return res.status(409).json({ error: 'Não é possível mover um treino já concluído.' });
    // Meia-noite UTC do dia escolhido, o mesmo formato com que os planos são criados.
    const updated = await prisma.scheduledWorkout.update({ where: { id: workoutId }, data: { date: new Date(`${date}T00:00:00.000Z`) } });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/test-ai', authenticateToken, aiLimiter, async (req, res) => {
  const { provider, apiKey } = req.body;
  try {
    const result = await testConnection(provider, apiKey);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/generate-workout', authenticateToken, aiLimiter, asyncJob, async (req, res) => {
  try {
    const { prompt, goal } = req.body;
    const result = await generateWod(prompt, goal);
    res.json(result);
  } catch (err) {
    console.error('WOD generation failed:', err);
    res.status(500).json({ error: 'Falha ao gerar WOD via IA.', details: err.message });
  }
});

app.post('/api/generate-box-plan', authenticateToken, aiLimiter, asyncJob, async (req, res) => {
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

    // Inject new exercises into the DB (and the in-memory cache) for future AI prompts
    const existingNames = new Set(exercises.map(e => e.name.toLowerCase()));
    const newExercises = parsed.exercises.filter(ex =>
      !existingNames.has(ex.name.toLowerCase()) && ex.name !== '?' && ex.reps !== '?'
    );

    if (newExercises.length > 0) {
      const created = await Promise.all(newExercises.map(ex =>
        prisma.exercise.create({
          data: {
            name: ex.name,
            muscleGroups: [],
            equipment: [],
            type: [type || 'outro'],
            source: 'custom-library'
          }
        }).catch(() => null) // skip on unique-name collisions
      ));

      for (const row of created) {
        if (!row) continue;
        exercises.push({
          id: String(row.id),
          name: row.name,
          muscle_groups: row.muscleGroups,
          equipment: row.equipment,
          type: row.type,
          default_reps: row.defaultReps,
          default_time: row.defaultTime,
          safety_notes: row.safetyNotes || ''
        });
      }
      console.log(`[Custom Library] Injected ${created.filter(Boolean).length} new exercise(s) into the Exercise table`);
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

// ── TV Share (partilha de treinos para TV) ────────────────────────────────────
const tvShares = new Map(); // code -> { workout, createdAt }
const SHARE_TTL_MS = 6 * 60 * 60 * 1000;

function randomTvCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

setInterval(() => {
  const cutoff = Date.now() - SHARE_TTL_MS;
  tvShares.forEach((s, c) => { if (s.createdAt < cutoff) tvShares.delete(c); });
}, 60 * 60 * 1000);

const MAX_TV_SHARES = 500;

const tvShareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Limite de partilhas atingido. Tenta novamente em 15 minutos.' }
});

const tvResultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados registos seguidos. Tenta novamente mais tarde.' }
});

app.post('/api/tv-share', tvShareLimiter, optionalAuthenticateToken, express.json({ limit: '1mb' }), (req, res) => {
  const { workout } = req.body || {};
  if (!workout) return res.status(400).json({ error: 'workout obrigatório' });
  if (tvShares.size >= MAX_TV_SHARES) {
    return res.status(503).json({ error: 'Demasiadas salas ativas. Tenta novamente mais tarde.' });
  }
  let code;
  do { code = randomTvCode(); } while (tvShares.has(code));
  // Guardamos o dono da sala: a TV não tem sessão, por isso é este userId que
  // permite registar o resultado no histórico no fim do treino.
  tvShares.set(code, { workout, userId: req.user?.userId || null, createdAt: Date.now() });
  res.json({ code });
});

app.get('/api/tv-share/:code', (req, res) => {
  const share = tvShares.get(req.params.code.toUpperCase());
  if (!share) return res.status(404).json({ error: 'Sala não encontrada' });
  // A sala não fecha ao registar o score: da TV dá para repetir o WOD e
  // registar outra tentativa. Só expira por SHARE_TTL_MS.
  res.json({ workout: share.workout, canSaveResult: !!share.userId });
});

// Registo do resultado a partir da TV. Sem sessão iniciada do lado da TV: quem
// autoriza é o próprio código da sala, que só o dono conhece (foi ele que a
// criou autenticado na app) e que expira ao fim de SHARE_TTL_MS.
app.post('/api/tv-share/:code/result', tvResultLimiter, async (req, res) => {
  const code = req.params.code.toUpperCase();
  const share = tvShares.get(code);
  // Nunca 401/403 aqui: o apiFetch do cliente faz logout e recarrega a página
  // nesses estados, e a TV perderia o ecrã de resultado por baixo dos pés.
  if (!share) return res.status(404).json({ error: 'Sala não encontrada ou expirada.' });
  if (!share.userId) {
    return res.status(409).json({ error: 'Esta sala foi aberta sem sessão iniciada. Inicia sessão na app e envia o treino outra vez.' });
  }

  const { score, scoreValue, notes } = req.body || {};
  if (typeof score !== 'string' || !score.trim()) return res.status(400).json({ error: 'score obrigatório' });

  try {
    const result = await prisma.result.create({
      data: {
        userId: share.userId,
        score: score.trim().slice(0, 80),
        scoreValue: typeof scoreValue === 'number' && Number.isFinite(scoreValue) ? scoreValue : null,
        type: 'tv_timer',
        notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : null
      }
    });
    // Guardamos os registos da sala apenas para diagnóstico: cada repetição do
    // WOD pode gerar um resultado novo.
    share.resultIds = [...(share.resultIds || []), result.id];
    res.status(201).json({ id: result.id });
  } catch (err) {
    console.error('[TV] Falha ao registar resultado:', err.message);
    res.status(500).json({ error: 'Não foi possível registar o resultado.' });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

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

async function loadAiModelSetting() {
  const setting = await prisma.appSetting.findUnique({ where: { key: AI_MODEL_SETTING_KEY } });
  if (setting?.value) {
    setDefaultModel(setting.value);
    console.log(`[AI] Modelo Pollinations por defeito carregado da BD: ${setting.value}`);
  } else {
    console.log(`[AI] Nenhum modelo guardado — a usar o valor por defeito: ${getDefaultModel()}`);
  }
}

Promise.all([
  loadExercisesFromDB().catch(err => console.error('[Exercises] Falha ao carregar exercícios da BD:', err.message)),
  loadAiModelSetting().catch(err => console.error('[AI] Falha ao carregar definição de modelo:', err.message)),
  loadPromptOverrides().catch(err => console.error('[Prompts] Falha ao carregar overrides de prompt:', err.message))
]).finally(() => startServer(parseInt(PORT, 10)));
