/**
 * Mensalidades (ligáveis por box) e regras de marcação.
 *
 * Tudo o que é de cobrança só tem efeito quando Box.billingEnabled = true; com o
 * interruptor desligado a box funciona como antes. Os pagamentos são registados
 * à mão pelo gestor (numerário, MB Way, transferência...) — o modelo já guarda o
 * método, para mais tarde se ligar um serviço de pagamentos online.
 *
 * Estado de uma inscrição (calculado, não guardado):
 *   EXEMPT  — isento
 *   OK      — em dia (hoje < próximo vencimento)
 *   DUE     — pendente (venceu, dentro dos dias de tolerância da box)
 *   OVERDUE — em atraso (passou a tolerância)
 */
const prisma = require('../lib/prisma');

const DAY = 86400000;
const METHODS = ['CASH', 'MBWAY', 'TRANSFER', 'MULTIBANCO', 'CARD', 'OTHER'];

// Regras por omissão quando a box nunca configurou nada: mantém o comportamento
// antigo do servidor (1 aula confirmada por dia), sem outros limites.
const LEGACY_RULES = { maxDaysAhead: null, minMinutesBefore: null, dailyLimit: 1, dailyLimitPerType: null };

const effectiveRules = (box) => ({ ...LEGACY_RULES, ...(box?.bookingRules || {}) });

// As datas das mensalidades são dias de calendário guardados à meia-noite UTC (como
// as datas dos planos), para não mudarem de dia com a hora de verão.
const utcDay = (date) => { const d = new Date(date); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
const todayUTC = (now = new Date()) => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

const addMonths = (date, months) => {
  const d = utcDay(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 31 jan + 1 mês = 28/29 fev, não 3 mar
  return d;
};

// Dia local (para as aulas, cujas horas são locais).
const startOfDay = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };

function membershipStatus(membership, box, now = new Date()) {
  if (!membership) return null;
  if (membership.exempt) return { code: 'EXEMPT', label: 'Isento', daysOverdue: 0 };
  const due = utcDay(membership.nextDueDate);
  const today = todayUTC(now);
  if (today < due) return { code: 'OK', label: 'Em dia', daysOverdue: 0, daysUntilDue: Math.round((due - today) / DAY) };
  const daysOverdue = Math.round((today - due) / DAY);
  const grace = box?.billingGraceDays ?? 5;
  return daysOverdue <= grace
    ? { code: 'DUE', label: 'Pendente', daysOverdue }
    : { code: 'OVERDUE', label: 'Em atraso', daysOverdue };
}

const amountDue = (membership) => {
  if (!membership?.plan || membership.exempt) return 0;
  return Math.round(membership.plan.priceCents * (100 - (membership.discountPct || 0)) / 100);
};

const activeMembership = (db, userId, boxId) => db.membership.findFirst({
  where: { userId: parseInt(userId), boxId: parseInt(boxId), active: true },
  include: { plan: true },
  orderBy: { createdAt: 'desc' }
});

// ── Validação de marcações (chamada dentro da transação de bookClass) ────────
async function checkBookingRules(tx, userId, targetClass) {
  const box = targetClass.box;
  const rules = effectiveRules(box);
  const start = new Date(targetClass.startTime);
  const now = new Date();
  const uid = parseInt(userId);

  if (rules.maxDaysAhead != null && start - now > rules.maxDaysAhead * DAY) {
    throw new Error(`Só podes marcar aulas com até ${rules.maxDaysAhead} dias de antecedência.`);
  }
  if (rules.minMinutesBefore != null && start - now < rules.minMinutesBefore * 60000) {
    throw new Error(`As marcações fecham ${rules.minMinutesBefore} minutos antes do início da aula.`);
  }

  const dayStart = startOfDay(start);
  const dayEnd = new Date(dayStart.getTime() + DAY - 1);
  if (rules.dailyLimit != null || rules.dailyLimitPerType != null) {
    const sameDay = await tx.booking.findMany({
      where: { userId: uid, status: 'CONFIRMED', gymClass: { startTime: { gte: dayStart, lte: dayEnd } } },
      include: { gymClass: { select: { name: true } } }
    });
    if (rules.dailyLimit != null && sameDay.length >= rules.dailyLimit) {
      throw new Error(rules.dailyLimit === 1
        ? 'Já tens uma reserva confirmada para este dia. Limite de 1 aula por dia.'
        : `Já atingiste o limite de ${rules.dailyLimit} aulas por dia.`);
    }
    if (rules.dailyLimitPerType != null) {
      const sameType = sameDay.filter(b => (b.gymClass.name || '') === (targetClass.name || '')).length;
      if (sameType >= rules.dailyLimitPerType) {
        throw new Error(`Limite diário por tipo de aula: ${rules.dailyLimitPerType} de "${targetClass.name || 'Aula'}" por dia.`);
      }
    }
  }

  // Restrições do plano: só quando a box cobra mensalidades e o atleta tem plano.
  if (!box?.billingEnabled) return;
  const membership = await activeMembership(tx, uid, box.id);
  if (!membership) return;

  const types = Array.isArray(membership.plan.classTypes) ? membership.plan.classTypes : null;
  if (types?.length && !types.includes(targetClass.name || '')) {
    throw new Error(`A aula "${targetClass.name || 'Aula'}" não está incluída no teu plano (${membership.plan.name}).`);
  }
  if (membership.plan.weeklyLimit != null) {
    const weekStart = startOfDay(start);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
    const count = await tx.booking.count({
      where: { userId: uid, status: { in: ['CONFIRMED', 'WAITLISTED'] }, gymClass: { boxId: box.id, startTime: { gte: weekStart, lt: weekEnd } } }
    });
    if (count >= membership.plan.weeklyLimit) {
      throw new Error(`O teu plano (${membership.plan.name}) permite ${membership.plan.weeklyLimit} aulas por semana e já as marcaste.`);
    }
  }
  if (box.billingBlockOverdue && membershipStatus(membership, box)?.code === 'OVERDUE') {
    throw new Error('Tens a mensalidade em atraso. Regulariza o pagamento com a box para voltares a marcar aulas.');
  }
}

// ── Gestão (box admin) ───────────────────────────────────────────────────────
function sanitizeRules(input) {
  if (input == null) return null;
  const int = (v, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
  return {
    maxDaysAhead: int(input.maxDaysAhead, 0, 60),
    minMinutesBefore: int(input.minMinutesBefore, 0, 1440),
    dailyLimit: int(input.dailyLimit, 1, 10),
    dailyLimitPerType: int(input.dailyLimitPerType, 1, 10)
  };
}

async function getBillingOverview(boxId) {
  const id = parseInt(boxId);
  const box = await prisma.box.findUnique({ where: { id } });
  if (!box) throw new Error('Box não encontrada.');
  const [plans, users, memberships, monthPayments] = await Promise.all([
    prisma.membershipPlan.findMany({ where: { boxId: id }, orderBy: [{ active: 'desc' }, { priceCents: 'asc' }] }),
    prisma.user.findMany({ where: { boxId: id }, select: { id: true, name: true, email: true, role: true, memberStatus: true, boxValidated: true }, orderBy: { name: 'asc' } }),
    prisma.membership.findMany({ where: { boxId: id, active: true }, include: { plan: true } }),
    prisma.payment.findMany({ where: { boxId: id, paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } })
  ]);
  const byUser = Object.fromEntries(memberships.map(m => [m.userId, m]));
  const members = users.map(u => {
    const m = byUser[u.id];
    return { ...u, membership: m ? { ...m, status: membershipStatus(m, box), amountDueCents: amountDue(m) } : null };
  });
  const withPlan = members.filter(m => m.membership);
  return {
    settings: {
      billingEnabled: box.billingEnabled,
      billingBlockOverdue: box.billingBlockOverdue,
      billingGraceDays: box.billingGraceDays,
      bookingRules: effectiveRules(box),
      customRules: box.bookingRules != null
    },
    plans,
    members,
    summary: {
      receivedThisMonthCents: monthPayments.reduce((s, p) => s + p.amountCents, 0),
      paymentsThisMonth: monthPayments.length,
      withPlan: withPlan.length,
      overdue: withPlan.filter(m => m.membership.status.code === 'OVERDUE').length,
      pending: withPlan.filter(m => m.membership.status.code === 'DUE').length,
      expectedMonthlyCents: withPlan.reduce((s, m) => s + Math.round(amountDue(m.membership) / (m.membership.plan.periodMonths || 1)), 0)
    }
  };
}

async function updateBillingSettings(boxId, body) {
  const data = {};
  if (typeof body.billingEnabled === 'boolean') data.billingEnabled = body.billingEnabled;
  if (typeof body.billingBlockOverdue === 'boolean') data.billingBlockOverdue = body.billingBlockOverdue;
  if (body.billingGraceDays != null) {
    const g = parseInt(body.billingGraceDays, 10);
    if (!(g >= 0 && g <= 60)) throw new Error('Dias de tolerância inválidos (0 a 60).');
    data.billingGraceDays = g;
  }
  if ('bookingRules' in body) data.bookingRules = sanitizeRules(body.bookingRules);
  return prisma.box.update({ where: { id: parseInt(boxId) }, data });
}

function sanitizePlan(body, partial = false) {
  const data = {};
  if (!partial || 'name' in body) {
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) throw new Error('O plano precisa de um nome.');
    data.name = name;
  }
  if (!partial || 'priceCents' in body) {
    const p = parseInt(body.priceCents, 10);
    if (!(p >= 0 && p <= 10000000)) throw new Error('Preço inválido.');
    data.priceCents = p;
  }
  if (!partial || 'periodMonths' in body) {
    const m = parseInt(body.periodMonths ?? 1, 10);
    if (![1, 3, 6, 12].includes(m)) throw new Error('Periodicidade inválida (1, 3, 6 ou 12 meses).');
    data.periodMonths = m;
  }
  if (!partial || 'weeklyLimit' in body) {
    const w = body.weeklyLimit == null || body.weeklyLimit === '' ? null : parseInt(body.weeklyLimit, 10);
    if (w != null && !(w >= 1 && w <= 21)) throw new Error('Limite semanal inválido (1 a 21, ou vazio para ilimitado).');
    data.weeklyLimit = w;
  }
  if (!partial || 'classTypes' in body) {
    const t = Array.isArray(body.classTypes) ? body.classTypes.map(x => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 50) : [];
    data.classTypes = t.length ? t : null;
  }
  if ('active' in body) data.active = !!body.active;
  return data;
}

async function createPlan(boxId, body) {
  return prisma.membershipPlan.create({ data: { boxId: parseInt(boxId), ...sanitizePlan(body) } });
}

async function updatePlan(boxId, planId, body) {
  const plan = await prisma.membershipPlan.findFirst({ where: { id: parseInt(planId), boxId: parseInt(boxId) } });
  if (!plan) throw new Error('Plano não encontrado.');
  return prisma.membershipPlan.update({ where: { id: plan.id }, data: sanitizePlan(body, true) });
}

async function assignMembership(boxId, userId, body) {
  const bId = parseInt(boxId), uId = parseInt(userId);
  const user = await prisma.user.findFirst({ where: { id: uId, boxId: bId } });
  if (!user) throw new Error('Atleta não pertence a esta box.');
  const plan = await prisma.membershipPlan.findFirst({ where: { id: parseInt(body.planId), boxId: bId, active: true } });
  if (!plan) throw new Error('Plano não encontrado ou inativo.');
  const discountPct = Math.max(0, Math.min(100, parseInt(body.discountPct || 0, 10) || 0));
  const notes = body.notes ? String(body.notes).slice(0, 500) : null;

  return prisma.$transaction(async (tx) => {
    const current = await activeMembership(tx, uId, bId);
    if (current) {
      // Mudar de plano mantém o vencimento atual; só a data de início é nova se for pedida.
      return tx.membership.update({
        where: { id: current.id },
        data: { planId: plan.id, discountPct, exempt: !!body.exempt, notes },
        include: { plan: true }
      });
    }
    const start = body.startDate ? new Date(body.startDate) : todayUTC();
    if (isNaN(start)) throw new Error('Data de início inválida.');
    return tx.membership.create({
      data: { boxId: bId, userId: uId, planId: plan.id, startDate: utcDay(start), nextDueDate: utcDay(start), discountPct, exempt: !!body.exempt, notes },
      include: { plan: true }
    });
  });
}

async function endMembership(boxId, userId) {
  const m = await activeMembership(prisma, userId, boxId);
  if (!m) throw new Error('Este atleta não tem plano ativo.');
  return prisma.membership.update({ where: { id: m.id }, data: { active: false } });
}

// Regista o pagamento do período que vence em nextDueDate e avança o vencimento.
async function recordPayment(boxId, userId, recordedById, body) {
  const method = String(body.method || '').toUpperCase();
  if (!METHODS.includes(method)) throw new Error('Método de pagamento inválido.');
  return prisma.$transaction(async (tx) => {
    const m = await activeMembership(tx, userId, boxId);
    if (!m) throw new Error('Este atleta não tem plano ativo.');
    const periods = Math.max(1, Math.min(12, parseInt(body.periods || 1, 10) || 1));
    const periodStart = utcDay(m.nextDueDate);
    const periodEnd = addMonths(periodStart, (m.plan.periodMonths || 1) * periods);
    const amountCents = body.amountCents != null && body.amountCents !== ''
      ? parseInt(body.amountCents, 10)
      : amountDue(m) * periods;
    if (!(amountCents >= 0 && amountCents <= 10000000)) throw new Error('Valor inválido.');
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    if (isNaN(paidAt)) throw new Error('Data de pagamento inválida.');
    const payment = await tx.payment.create({
      data: {
        boxId: parseInt(boxId), userId: parseInt(userId), membershipId: m.id, amountCents, method,
        periodStart, periodEnd, paidAt, recordedById: recordedById || null,
        notes: body.notes ? String(body.notes).slice(0, 500) : null
      }
    });
    await tx.membership.update({ where: { id: m.id }, data: { nextDueDate: periodEnd } });
    return payment;
  });
}

// Anular um pagamento: só o mais recente da inscrição, e o vencimento recua.
async function deletePayment(boxId, paymentId) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findFirst({ where: { id: parseInt(paymentId), boxId: parseInt(boxId) } });
    if (!p) throw new Error('Pagamento não encontrado.');
    const latest = await tx.payment.findFirst({ where: { membershipId: p.membershipId }, orderBy: [{ periodEnd: 'desc' }, { id: 'desc' }] });
    if (latest.id !== p.id) throw new Error('Só é possível anular o pagamento mais recente deste atleta.');
    await tx.payment.delete({ where: { id: p.id } });
    await tx.membership.update({ where: { id: p.membershipId }, data: { nextDueDate: p.periodStart } });
    return { ok: true };
  });
}

const memberPayments = (boxId, userId) => prisma.payment.findMany({
  where: { boxId: parseInt(boxId), userId: parseInt(userId) },
  orderBy: { paidAt: 'desc' },
  take: 50,
  include: { recordedBy: { select: { name: true } } }
});

// ── Vista do atleta ──────────────────────────────────────────────────────────
async function getMyMembership(userId, boxId) {
  if (!boxId) return { billingEnabled: false, bookingRules: null };
  const box = await prisma.box.findUnique({ where: { id: parseInt(boxId) } });
  if (!box) return { billingEnabled: false, bookingRules: null };
  const base = { billingEnabled: box.billingEnabled, bookingRules: effectiveRules(box), graceDays: box.billingGraceDays, blockOverdue: box.billingBlockOverdue };
  if (!box.billingEnabled) return base;
  const m = await activeMembership(prisma, userId, boxId);
  if (!m) return { ...base, membership: null };
  const payments = await prisma.payment.findMany({ where: { membershipId: m.id }, orderBy: { paidAt: 'desc' }, take: 24, select: { id: true, amountCents: true, method: true, periodStart: true, periodEnd: true, paidAt: true } });
  return { ...base, membership: { ...m, status: membershipStatus(m, box), amountDueCents: amountDue(m) }, payments };
}

module.exports = {
  METHODS, effectiveRules, membershipStatus, checkBookingRules,
  getBillingOverview, updateBillingSettings, createPlan, updatePlan,
  assignMembership, endMembership, recordPayment, deletePayment, memberPayments, getMyMembership
};
