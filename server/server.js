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
  clientApiKey: z.string().optional()
});

const planSchema = z.object({
  title: z.string().min(1),
  goal: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  sessions: z.array(z.object({
    day: z.number(),
    focus: z.string()
  }).passthrough()).min(1)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['ADMIN', 'BOX_ADMIN', 'COACH', 'ATHLETE']).optional()
});

const { generateWorkout } = require('./utils/generator');
const { testConnection, generateMultiDayPlan, parseWorkoutText } = require('./services/ai-service');
const { registerUser, loginUser, updateProfile, authenticateToken, authorizeRoles } = require('./services/auth-service');
const {
  createBox, getBoxById, getBoxByInviteCode, getBoxUsers, validateUser, updateUserRole,
  createClass, bookClass, getBoxSchedule, createBoxWod, updateBox
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
    const { time, muscleGroups, type, equipment, aiProvider, profile, clientApiKey } = generateSchema.parse(req.body);

    generateWorkout(exercises, {
      time: parseInt(time),
      muscleGroups,
      type,
      equipment: equipment || [],
      aiProvider,
      profile: profile || {},
      clientApiKey
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

// --- Box Management ---
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
    const wods = await prisma.boxWod.findMany({
      where: { boxId: parseInt(req.params.boxId) },
      orderBy: { date: 'desc' },
      take: 10
    });
    res.json(wods);
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

app.get('/api/boxes/:boxId/classes', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const classes = await getBoxSchedule(req.params.boxId, date || new Date());
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/boxes/:boxId/classes', authenticateToken, authorizeRoles('ADMIN', 'BOX_ADMIN', 'COACH'), async (req, res) => {
  try {
    const { name, startTime, endTime, capacity } = req.body;
    const newClass = await createClass(req.params.boxId, name, startTime, endTime, capacity);
    res.status(201).json(newClass);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.body;
    const booking = await bookClass(req.user.userId, classId);
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/bookings/:bookingId', authenticateToken, async (req, res) => {
  try {
    await prisma.booking.update({
      where: { id: parseInt(req.params.bookingId), userId: req.user.userId },
      data: { status: 'CANCELLED' }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/box/results', authenticateToken, async (req, res) => {
  try {
    const { boxWodId, globalWodId, scheduledWorkoutId, score, type, notes } = req.body;
    const result = await prisma.result.create({
      data: {
        userId: req.user.userId,
        boxWodId: boxWodId ? parseInt(boxWodId) : null,
        globalWodId: globalWodId ? parseInt(globalWodId) : null,
        scheduledWorkoutId: scheduledWorkoutId ? parseInt(scheduledWorkoutId) : null,
        score,
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
    const results = await prisma.result.findMany({
      where: { boxWodId: parseInt(req.params.boxId) },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plans', authenticateToken, async (req, res) => {
  try {
    const { title, sessions, goal, startDate } = planSchema.parse(req.body);
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
        wod: true,
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

app.post('/api/generate-plan', aiLimiter, async (req, res) => {
  try {
    const data = req.body;
    // data contains: goal, level, freq, period, limitations
    const plan = await generateMultiDayPlan('gemini', data);
    res.json(plan);
  } catch (err) {
    console.error('Plan generation failed:', err);
    res.status(500).json({ error: 'Plan generation failed', details: err.message });
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
