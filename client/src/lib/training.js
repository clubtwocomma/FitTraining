// Cálculos partilhados pelos ecrãs de treino (os meus treinos e, mais tarde, a box).
// Inspirado no modelo do TrainingPeaks: cada treino tem uma carga, e a partir dela
// calcula-se Forma Física (CTL, média de 42 dias), Fadiga (ATL, média de 7 dias)
// e Frescura (TSB = CTL - ATL). Como não temos potência nem frequência cardíaca,
// a carga é a "session RPE": duração em minutos × esforço percebido (1-10).

export const CTL_DAYS = 42
export const ATL_DAYS = 7
const DEFAULT_RPE = 6
const DEFAULT_MINUTES = 45

// Chave de dia local (AAAA-MM-DD). Não usar toISOString(): em hora de verão
// a meia-noite local cai no dia anterior em UTC.
export const localKey = (d) => {
    const x = d instanceof Date ? d : new Date(d)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

// As datas dos treinos do plano são gravadas como meia-noite UTC do dia previsto,
// por isso o dia certo é a parte de data da string, não a data local.
export const workoutDayKey = (workout, plan) => {
    if (workout.date) return String(workout.date).slice(0, 10)
    if (plan?.startDate && workout.day) {
        const start = new Date(String(plan.startDate).slice(0, 10) + 'T00:00:00')
        start.setDate(start.getDate() + workout.day - 1)
        return localKey(start)
    }
    return null
}

// Lê a duração escrita pela IA: "60 min", "45-60 min" (média do intervalo),
// "1h30" e "Manhã: 60min | Tarde: 60min" (soma dos turnos). Mais de 10 h é tratado
// como inválido. Nunca juntar os algarismos: "45-60" não são 4560 minutos.
export const parseMinutes = (value) => {
    if (typeof value === 'number') return value > 0 && value <= 600 ? Math.round(value) : null
    const text = String(value ?? '')
    if (text.includes('|')) {
        const parts = text.split('|').map(parseMinutes).filter(Boolean)
        const sum = parts.reduce((a, b) => a + b, 0)
        return sum > 0 && sum <= 600 ? sum : null
    }
    const h = text.match(/(\d+(?:[.,]\d+)?)\s*h(?:\s*(\d+))?/i)
    let n
    if (h) {
        n = parseFloat(h[1].replace(',', '.')) * 60 + (h[2] ? parseInt(h[2], 10) : 0)
    } else {
        const range = text.match(/(\d+(?:[.,]\d+)?)\s*(?:-|–|a|até)\s*(\d+(?:[.,]\d+)?)/i)
        if (range) n = (parseFloat(range[1].replace(',', '.')) + parseFloat(range[2].replace(',', '.'))) / 2
        else n = parseFloat((text.match(/\d+(?:[.,]\d+)?/) || [''])[0].replace(',', '.'))
    }
    return Number.isFinite(n) && n > 0 && n <= 600 ? Math.round(n) : null
}

export const isRestDay = (workout) => {
    const c = workout?.content || {}
    return !(c.exercises?.length) && /descanso|rest/i.test(workout?.focus || c.focus || '')
}

// Os resultados da box (WOD da box ou cronómetro da TV) são outra função da app.
export const isBoxResult = (r) => !!r.boxWodId || r.type === 'tv_timer'

const parseFeedback = (r) => {
    if (r.type !== 'plan_feedback' || !r.notes) return null
    try { return JSON.parse(r.notes) } catch { return null }
}

export const resultRpe = (r) => {
    const fb = parseFeedback(r)
    const v = Number(fb?.rpe ?? (r.type === 'plan_feedback' ? r.scoreValue : null))
    return v >= 1 && v <= 10 ? v : null
}

export const resultFeedback = parseFeedback

export const resultMinutes = (r) =>
    parseFeedback(r)?.durationMin || parseMinutes(r.scheduledWorkout?.content?.duration) || DEFAULT_MINUTES

// Carga de um treino concluído. `estimated` indica se usámos valores por omissão.
export const resultLoad = (r) => {
    const rpe = resultRpe(r)
    const minutes = resultMinutes(r)
    return {
        load: Math.round(minutes * (rpe ?? DEFAULT_RPE)),
        minutes,
        rpe,
        estimated: rpe == null || !(parseFeedback(r)?.durationMin || parseMinutes(r.scheduledWorkout?.content?.duration))
    }
}

// Série diária de carga + CTL/ATL/TSB (médias exponenciais, como no TrainingPeaks).
// O TSB de um dia usa CTL/ATL do dia anterior: é a frescura com que se chega ao treino.
export const performanceSeries = (results, days = 90) => {
    const loadByDay = {}
    results.forEach(r => {
        const k = localKey(r.createdAt)
        loadByDay[k] = (loadByDay[k] || 0) + resultLoad(r).load
    })

    // Aquecer as médias com o histórico anterior à janela visível.
    const warmup = CTL_DAYS * 3
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() - (days + warmup) + 1)

    let ctl = 0, atl = 0
    const out = []
    for (let i = 0; i < days + warmup; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        const load = loadByDay[localKey(d)] || 0
        const tsb = ctl - atl
        ctl += (load - ctl) / CTL_DAYS
        atl += (load - atl) / ATL_DAYS
        if (i >= warmup) out.push({ date: d, key: localKey(d), load, ctl, atl, tsb })
    }
    return out
}

// Estado de cumprimento de um treino planeado (cores do TrainingPeaks):
// done = verde, missed = vermelho, today/planned = neutro, rest = cinzento claro.
export const workoutStatus = (workout, plan) => {
    if (isRestDay(workout)) return 'rest'
    if (workout.completed || workout.results?.length) return 'done'
    const key = workoutDayKey(workout, plan)
    const todayKey = localKey(new Date())
    if (key && key < todayKey) return 'missed'
    if (key === todayKey) return 'today'
    return 'planned'
}

export const STATUS = {
    done: { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.10)', label: 'Concluído' },
    missed: { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)', label: 'Falhado' },
    today: { color: 'var(--primary-color)', bg: 'var(--primary-glow)', label: 'Hoje' },
    planned: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.10)', label: 'Planeado' },
    rest: { color: '#cbd5e1', bg: 'transparent', label: 'Descanso' }
}

// Cores das três métricas, iguais às do TrainingPeaks para leitura imediata.
export const METRIC_COLORS = { ctl: '#2563eb', atl: '#db2777', tsb: '#f97316', load: '#dc2626' }

// Estimativa de tempo e intensidade por exercício, para desenhar a barra de estrutura.
const restSeconds = (rest) => {
    const s = String(rest || '')
    const n = parseFloat(s.replace(',', '.'))
    if (!Number.isFinite(n)) return 60
    return /min|'/.test(s) ? n * 60 : n
}

const intensityOf = (ex) => {
    const pct = parseFloat(String(ex.rm_percent || ex.weight_h || '').match(/(\d{2,3})\s*%/)?.[1])
    if (pct) return Math.min(1, Math.max(0.35, pct / 100))
    if (ex.phase === 'warmup') return 0.4
    if (ex.phase === 'cooldown') return 0.3
    return 0.75
}

export const workoutBlocks = (data) => {
    const exercises = data?.exercises || data?.content?.exercises || []
    const blocks = []
    const warmup = data?.warmup || data?.content?.warmup
    const cooldown = data?.cooldown || data?.content?.cooldown
    if (warmup?.description && !exercises.some(e => e.phase === 'warmup')) {
        blocks.push({ phase: 'warmup', name: 'Aquecimento', seconds: (parseMinutes(warmup.duration_minutes) || 10) * 60, intensity: 0.4 })
    }
    exercises.forEach(ex => {
        const sets = parseInt(ex.sets, 10) || 1
        const work = 45 * sets
        const rest = restSeconds(ex.rest) * Math.max(0, sets - 1)
        blocks.push({ phase: ex.phase || 'main', name: ex.name, seconds: work + rest, intensity: intensityOf(ex), sets, reps: ex.reps })
    })
    if (cooldown?.description && !exercises.some(e => e.phase === 'cooldown')) {
        blocks.push({ phase: 'cooldown', name: 'Retorno à calma', seconds: (parseMinutes(cooldown.duration_minutes) || 8) * 60, intensity: 0.3 })
    }
    const order = { warmup: 0, main: 1, cooldown: 2 }
    return blocks.sort((a, b) => order[a.phase] - order[b.phase])
}

export const workoutTotals = (data) => {
    const exercises = data?.exercises || data?.content?.exercises || []
    const main = exercises.filter(e => (e.phase || 'main') === 'main')
    return {
        minutes: parseMinutes(data?.totalTime ?? data?.duration ?? data?.content?.duration),
        exercises: main.length,
        sets: main.reduce((s, e) => s + (parseInt(e.sets, 10) || 1), 0)
    }
}

// ── Registo de séries ────────────────────────────────────────────────────────

// 1RM estimado (Epley). Acima de 12 repetições a estimativa deixa de ser fiável.
export const estimate1RM = (kg, reps) => (kg > 0 && reps > 0 && reps <= 12 ? kg * (1 + reps / 30) : null)

export const parseKg = (v) => {
    const m = String(v ?? '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*kg/i)
    return m ? parseFloat(m[1]) : null
}

export const parseReps = (v) => {
    const n = parseInt(String(v ?? ''), 10)
    return Number.isFinite(n) ? n : null
}

// Totais de um registo [{ name, sets: [{ reps, kg, done }] }].
export const setLogSummary = (log = []) => {
    let planned = 0, done = 0, reps = 0, volume = 0
    log.forEach(ex => ex.sets.forEach(st => {
        planned++
        if (!st.done) return
        done++
        reps += st.reps || 0
        volume += (st.reps || 0) * (st.kg || 0)
    }))
    return { planned, done, reps, volume: Math.round(volume), compliance: planned ? Math.round(done / planned * 100) : null }
}

const sameExercise = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Histórico de um exercício a partir dos resultados: melhor 1RM estimado, volume e
// séries por sessão, por ordem cronológica, com os recordes pessoais marcados.
export const exerciseHistory = (results, name) => {
    const sessions = []
    results.forEach(r => {
        const ex = parseFeedback(r)?.sets?.find(e => sameExercise(e.name, name))
        if (!ex) return
        const done = ex.sets.filter(s => s.done)
        if (!done.length) return
        const e1rm = Math.max(0, ...done.map(s => estimate1RM(s.kg, s.reps) || 0)) || null
        sessions.push({
            date: new Date(r.createdAt),
            e1rm: e1rm && Math.round(e1rm * 10) / 10,
            topKg: Math.max(0, ...done.map(s => s.kg || 0)) || null,
            volume: Math.round(done.reduce((s, x) => s + (x.reps || 0) * (x.kg || 0), 0)),
            reps: done.reduce((s, x) => s + (x.reps || 0), 0),
            sets: done.length,
            planned: ex.sets.length
        })
    })
    sessions.sort((a, b) => a.date - b.date)
    let best = 0
    sessions.forEach(s => {
        s.pr = !!s.e1rm && s.e1rm > best
        if (s.e1rm) best = Math.max(best, s.e1rm)
    })
    return sessions
}

// Letras dos blocos (A, B, C…) pela ordem do treino, como no construtor de força.
export const blockLetter = (i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '')

// ── Recordes, ritmo de evolução, prontidão e resumo semanal ─────────────────

// Recordes pessoais por exercício a partir das séries registadas (Desempenhos de Pico).
export const peakPerformances = (results) => {
    const best = {}
    results.forEach(r => {
        const fb = parseFeedback(r)
        fb?.sets?.forEach(ex => {
            const key = ex.name.trim().toLowerCase()
            ex.sets.filter(s => s.done).forEach(s => {
                const e1rm = estimate1RM(s.kg, s.reps)
                if (!e1rm) return
                const cur = best[key]
                if (!cur || e1rm > cur.e1rm) best[key] = { name: ex.name, e1rm: Math.round(e1rm * 10) / 10, kg: s.kg, reps: s.reps, date: new Date(r.createdAt) }
            })
        })
    })
    return Object.values(best).sort((a, b) => b.date - a.date)
}

// Variação da Forma (CTL) em vários períodos, como as "Fitness Ramp Rates".
export const rampRates = (series) => {
    const last = series[series.length - 1]
    if (!last) return []
    return [7, 28, 90].filter(d => series.length > d).map(d => ({ days: d, delta: last.ctl - series[series.length - 1 - d].ctl }))
}

// Prontidão (0-100) a partir do check-in e da frescura. Pesos simples e explicáveis:
// sono 30%, energia 25%, stress 15%, dores 15%, frescura (TSB) 15%.
export const readinessScore = (checkin, tsb) => {
    if (!checkin) return null
    const parts = []
    if (checkin.sleep != null) parts.push([Math.min(1, checkin.sleep / 8), 0.30])
    if (checkin.energy != null) parts.push([(checkin.energy - 1) / 4, 0.25])
    if (checkin.stress != null) parts.push([(5 - checkin.stress) / 4, 0.15])
    if (checkin.soreness != null) parts.push([(5 - checkin.soreness) / 4, 0.15])
    if (tsb != null) parts.push([Math.max(0, Math.min(1, (tsb + 30) / 45)), 0.15])
    const w = parts.reduce((s, [, x]) => s + x, 0)
    if (!w) return null
    return Math.round(parts.reduce((s, [v, x]) => s + v * x, 0) / w * 100)
}

export const readinessLabel = (score) => {
    if (score == null) return null
    if (score >= 75) return { label: 'Pronto para treinar forte', color: '#16a34a' }
    if (score >= 50) return { label: 'Treino normal', color: '#d97706' }
    return { label: 'Dia leve ou descanso', color: '#dc2626' }
}

// Resumo das últimas semanas (segunda a domingo): treinos, minutos, carga e recordes.
export const weeklySummaries = (results, weeks = 8) => {
    const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const prDates = new Set()
    const best = {}
    ;[...results].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(r => {
        parseFeedback(r)?.sets?.forEach(ex => {
            const key = ex.name.trim().toLowerCase()
            const top = Math.max(0, ...ex.sets.filter(s => s.done).map(s => estimate1RM(s.kg, s.reps) || 0))
            if (top && top > (best[key] || 0)) { if (best[key]) prDates.add(r.id); best[key] = top }
        })
    })
    return Array.from({ length: weeks }, (_, i) => {
        const start = new Date(monday); start.setDate(monday.getDate() - 7 * i)
        const end = new Date(start); end.setDate(start.getDate() + 7)
        const inWeek = results.filter(r => { const d = new Date(r.createdAt); return d >= start && d < end })
        return {
            start,
            workouts: inWeek.length,
            minutes: inWeek.reduce((s, r) => s + resultLoad(r).minutes, 0),
            load: inWeek.reduce((s, r) => s + resultLoad(r).load, 0),
            prs: inWeek.filter(r => prDates.has(r.id)).length
        }
    })
}

export const daysUntil = (dateStr) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const d = new Date(dateStr + 'T00:00:00')
    return Math.round((d - today) / 86400000)
}

// Rótulos dos blocos com supersets: exercícios seguidos com a mesma letra de
// superset partilham a letra e são numerados (C1, C2); os isolados ficam A, B, D…
export const blockLabels = (mainExercises) => {
    const labels = []
    let block = -1
    mainExercises.forEach((ex, i) => {
        const prev = mainExercises[i - 1]
        const joinsPrev = ex.superset && prev?.superset === ex.superset
        if (!joinsPrev) block++
        labels.push({ letter: blockLetter(block), superset: !!ex.superset })
    })
    const counts = {}
    labels.forEach(l => { counts[l.letter] = (counts[l.letter] || 0) + 1 })
    const seen = {}
    return labels.map(l => {
        if (counts[l.letter] < 2) return { label: l.letter, superset: false }
        seen[l.letter] = (seen[l.letter] || 0) + 1
        return { label: `${l.letter}${seen[l.letter]}`, superset: true }
    })
}

// Miniatura de um vídeo do YouTube (watch?v=, youtu.be/ e shorts/). Outros sites: null.
export const youtubeThumb = (url) => {
    const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)
    return m ? `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg` : null
}

// Categoria de um treino a partir do nome (texto livre da IA). Ganha a palavra-chave
// que aparece primeiro: "Costas, Bíceps e Posterior" é Puxar, não Pernas.
export const CATEGORIES = [
    { k: 'pernas', label: 'Pernas', color: '#2563eb', re: /perna|gl[úu]te|joelho|anca|quadr[ií]c|membros inferiores|pliometr|agachament|lunge/i },
    { k: 'empurrar', label: 'Empurrar', color: '#f97316', re: /empurrar|push|peito|ombro|tr[ií]ceps|supino|press/i },
    { k: 'puxar', label: 'Puxar', color: '#7c3aed', re: /puxar|pull|costas|b[ií]ceps|remada|eleva[çc]/i },
    { k: 'metcon', label: 'Metcon / Cardio', color: '#dc2626', re: /metcon|cardio|hyrox|aer[óo]bi|condicionamento|\bwod\b|endurance|corrida|amrap|emom/i },
    { k: 'core', label: 'Core / Mobilidade', color: '#16a34a', re: /core|mobilidade|gin[áa]stica|postura|alongament/i }
]
export const OTHER_CATEGORY = { k: 'outro', label: 'Outro', color: '#94a3b8' }

export const workoutCategory = (text) => {
    let best = null, bestIdx = Infinity
    CATEGORIES.forEach(c => {
        const m = String(text || '').match(c.re)
        if (m && m.index < bestIdx) { best = c; bestIdx = m.index }
    })
    return best || OTHER_CATEGORY
}

// Minutos por categoria nos últimos `days` dias (distribuição do tempo de treino).
export const timeByCategory = (results, days) => {
    const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - days + 1)
    const totals = {}
    results.filter(r => new Date(r.createdAt) >= since).forEach(r => {
        const title = r.scheduledWorkout?.focus || (r.globalWodId || r.globalWod ? 'WOD' : r.notes)
        const cat = workoutCategory(title)
        totals[cat.k] = totals[cat.k] || { ...cat, minutes: 0, count: 0 }
        totals[cat.k].minutes += resultLoad(r).minutes
        totals[cat.k].count++
    })
    return Object.values(totals).sort((a, b) => b.minutes - a.minutes)
}
