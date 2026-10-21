// Calendário semanal do plano, inspirado no do TrainingPeaks: semanas seguidas com
// cartões de treino por dia (faixa de cor = cumprimento), blocos A/B/C1… e barra de
// estrutura. Ecrã largo: grelha de 7 colunas + resumo, com arrastar para mudar de dia.
// Telemóvel: agenda por semana com o resumo no cabeçalho.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Moon, GripVertical } from 'lucide-react'
import { StructureBar } from './TrainingUI'
import {
    localKey, workoutDayKey, workoutStatus, workoutTotals, isRestDay, parseMinutes,
    resultFeedback, resultRpe, setLogSummary, blockLabels, workoutCategory, STATUS, METRIC_COLORS
} from '../../lib/training'

const TILE_CSS = `.pc-tile { transition: transform 0.15s ease, box-shadow 0.15s ease; } .pc-tile:hover { transform: translateY(-1px); box-shadow: var(--shadow-premium); } .pc-tile:active { transform: scale(0.99); }`

const PARTIAL = { color: '#d97706', bg: 'rgba(217, 119, 6, 0.10)', label: 'Parcial' }
const statusInfo = (s) => (s === 'partial' ? PARTIAL : STATUS[s])

// Estado com "parcial" (amarelo no TrainingPeaks): feito, mas incompleto.
const tileStatus = (workout, plan) => {
    const s = workoutStatus(workout, plan)
    if (s !== 'done') return s
    const fb = workout.results?.map(resultFeedback).find(Boolean)
    const logged = fb?.sets ? setLogSummary(fb.sets) : null
    if (fb?.completed === false || (logged && logged.compliance < 80)) return 'partial'
    return 'done'
}

const useIsWide = () => {
    const query = '(min-width: 900px)'
    const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
    useEffect(() => {
        const mq = window.matchMedia(query)
        const on = () => setWide(mq.matches)
        mq.addEventListener('change', on)
        return () => mq.removeEventListener('change', on)
    }, [])
    return wide
}

function WorkoutTile({ workout, plan, onOpen, draggable, compact }) {
    const status = tileStatus(workout, plan)
    const st = statusInfo(status)
    const rest = status === 'rest'
    const c = workout.content || {}
    const totals = workoutTotals(c)
    const fb = workout.results?.map(resultFeedback).find(Boolean)
    const logged = fb?.sets ? setLogSummary(fb.sets) : null
    const rpe = workout.results?.map(resultRpe).find(v => v != null)
    const main = (c.exercises || []).filter(e => (e.phase || 'main') === 'main')
    const labels = blockLabels(main)
    const shown = compact ? 3 : 4
    const cat = workoutCategory(workout.focus)
    const minutes = fb?.durationMin ?? parseMinutes(c.duration)

    if (rest) {
        return (
            <div className="pc-tile" style={{ padding: '0.55rem 0.7rem', borderRadius: '0.9rem', border: '1.5px dashed var(--surface-color)', display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                <Moon size={14} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.focus || 'Descanso'}</span>
            </div>
        )
    }

    return (
        <div
            className="pc-tile"
            role="button"
            tabIndex={0}
            onClick={() => onOpen(workout)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(workout) }}
            draggable={draggable}
            onDragStart={draggable ? (e) => { e.dataTransfer.setData('text/plain', String(workout.id)); e.dataTransfer.effectAllowed = 'move' } : undefined}
            style={{
                borderRadius: '0.9rem', overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-color)',
                border: '1px solid var(--surface-color)', boxShadow: 'var(--shadow-soft)', borderTop: `5px solid ${st.color}`
            }}
        >
            <div style={{ padding: '0.6rem 0.7rem 0.55rem', background: st.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
                    {draggable && <GripVertical size={13} style={{ opacity: 0.35, flexShrink: 0 }} aria-hidden="true" />}
                </div>
                <div style={{ fontWeight: 900, fontSize: '0.88rem', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{workout.focus}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.1rem 0.6rem', marginTop: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
                    {minutes != null && <span style={{ fontWeight: 900, fontSize: '0.95rem' }}>{minutes}<span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: '2px' }}>min</span></span>}
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                        {logged ? <b style={{ color: logged.compliance >= 80 ? STATUS.done.color : PARTIAL.color }}>{logged.done}/{logged.planned}</b> : <b>{totals.sets}</b>} séries
                    </span>
                    {rpe != null && <span style={{ fontSize: '0.75rem', fontWeight: 800, color: METRIC_COLORS.atl }}>RPE {rpe}/10</span>}
                </div>
            </div>
            {main.length > 0 && (
                <div style={{ padding: '0.45rem 0.7rem 0.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {main.slice(0, shown).map((ex, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 600, minWidth: 0 }}>
                            <span style={{
                                minWidth: '20px', height: '20px', padding: '0 4px', borderRadius: '999px', flexShrink: 0,
                                background: labels[i].superset ? '#7c3aed' : '#ef4444', color: 'white',
                                fontSize: '0.6rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}>{labels[i].label}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                        </div>
                    ))}
                    {main.length > shown && <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>+{main.length - shown} mais</div>}
                </div>
            )}
            <div style={{ padding: '0.35rem 0.7rem 0.55rem' }}>
                <StructureBar data={c} height={16} />
            </div>
        </div>
    )
}

// Totais de uma semana: feito vs planeado, cumprimento e carga.
const weekStats = (days, plan) => {
    const ws = days.flatMap(d => d.workouts).filter(w => !isRestDay(w))
    const statuses = ws.map(w => tileStatus(w, plan))
    const doneWs = ws.filter((w, i) => ['done', 'partial'].includes(statuses[i]))
    const due = statuses.filter(s => ['done', 'partial', 'missed'].includes(s)).length
    const minutesOf = (w) => w.results?.map(resultFeedback).find(Boolean)?.durationMin ?? parseMinutes(w.content?.duration) ?? 0
    const plannedMin = ws.reduce((s, w) => s + (parseMinutes(w.content?.duration) || 0), 0)
    const doneMin = doneWs.reduce((s, w) => s + minutesOf(w), 0)
    const load = doneWs.reduce((s, w) => s + minutesOf(w) * (w.results?.map(resultRpe).find(v => v != null) ?? 6), 0)
    return { planned: ws.length, done: doneWs.length, plannedMin, doneMin, compliance: due ? Math.round(doneWs.length / due * 100) : null, load: Math.round(load) }
}

function SummaryBar({ label, value, max, unit = '' }) {
    const pct = max ? Math.min(100, Math.round(value / max * 100)) : 0
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 800, marginBottom: '3px', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span>{value}{unit} <span style={{ opacity: 0.5 }}>/ {max}{unit}</span></span>
            </div>
            <div style={{ height: '5px', borderRadius: '999px', background: 'var(--surface-color)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? STATUS.done.color : 'var(--primary-color)', borderRadius: '999px' }} />
            </div>
        </div>
    )
}

function WeekSummary({ stats, formPoint, horizontal }) {
    const compColor = stats.compliance == null ? 'var(--text-muted)' : stats.compliance >= 80 ? STATUS.done.color : stats.compliance >= 50 ? PARTIAL.color : STATUS.missed.color
    return (
        <div style={{ display: 'grid', gridTemplateColumns: horizontal ? '1fr 1fr' : '1fr', gap: '0.55rem' }}>
            <SummaryBar label="Treinos" value={stats.done} max={stats.planned} />
            <SummaryBar label="Minutos" value={stats.doneMin} max={stats.plannedMin} unit=" min" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.7rem', fontWeight: 800, gridColumn: horizontal ? '1 / -1' : undefined, gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ color: compColor }}>Cumprimento {stats.compliance == null ? '—' : `${stats.compliance}%`}</span>
                <span style={{ color: METRIC_COLORS.load }}>Carga {stats.load} pts</span>
                {formPoint && (
                    <span style={{ display: 'inline-flex', gap: '0.45rem' }}>
                        <span style={{ color: METRIC_COLORS.ctl }}>Forma {Math.round(formPoint.ctl)} pts</span>
                        <span style={{ color: METRIC_COLORS.tsb }}>Frescura {Math.round(formPoint.tsb)} pts</span>
                    </span>
                )}
            </div>
        </div>
    )
}

export default function PlanCalendar({ plan, series = [], onOpen, onMove }) {
    const wide = useIsWide()
    const todayKey = localKey(new Date())
    const [dragOver, setDragOver] = useState(null)
    const currentWeekRef = useRef(null)

    // Semanas (segunda a domingo) desde a do início do plano até à do último treino.
    const weeks = useMemo(() => {
        const keys = plan.workouts.map(w => workoutDayKey(w, plan)).filter(Boolean).sort()
        if (!keys.length) return []
        const first = new Date(keys[0] + 'T00:00:00')
        const last = new Date(keys[keys.length - 1] + 'T00:00:00')
        const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
        const out = []
        for (let w = new Date(start); w <= last; w.setDate(w.getDate() + 7)) {
            const days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(w); d.setDate(w.getDate() + i)
                const key = localKey(d)
                return { d, key, workouts: plan.workouts.filter(x => workoutDayKey(x, plan) === key) }
            })
            out.push({ start: new Date(w), days })
        }
        return out
    }, [plan])

    const seriesByKey = useMemo(() => Object.fromEntries(series.map(p => [p.key, p])), [series])

    useEffect(() => {
        currentWeekRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, [wide])

    const dropOn = (key) => (e) => {
        e.preventDefault()
        setDragOver(null)
        const id = Number(e.dataTransfer.getData('text/plain'))
        const w = plan.workouts.find(x => x.id === id)
        if (w && workoutDayKey(w, plan) !== key) onMove(w, key)
    }

    const isCurrent = (wk) => wk.days.some(d => d.key === todayKey)
    const canDrag = (w) => wide && !['done', 'partial', 'rest'].includes(tileStatus(w, plan))

    const legend = (
        <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.9rem' }}>
            {[['done', STATUS.done], ['partial', PARTIAL], ['missed', STATUS.missed], ['today', STATUS.today], ['planned', STATUS.planned]].map(([k, s]) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '14px', height: '5px', borderRadius: '2px', background: s.color }} /> {s.label}
                </span>
            ))}
            {wide && <span style={{ marginLeft: 'auto' }}>Arrasta um treino para mudar de dia</span>}
        </div>
    )

    if (wide) {
        return (
            <div style={{ width: 'min(1400px, calc(100vw - 2rem))', marginLeft: 'calc(50% - min(700px, 50vw - 1rem))' }}>
                <style>{TILE_CSS}</style>
                {legend}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr)) 210px', gap: '0', position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-color)', borderBottom: '1px solid var(--surface-color)' }}>
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom', 'Resumo'].map(h => (
                        <div key={h} style={{ padding: '0.5rem 0.6rem', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{h}</div>
                    ))}
                </div>
                {weeks.map((wk, wi) => {
                    const stats = weekStats(wk.days, plan)
                    const lastKey = wk.days[6].key
                    const formPoint = wk.days[0].key <= todayKey ? seriesByKey[lastKey > todayKey ? todayKey : lastKey] : null
                    return (
                        <div key={wi} ref={isCurrent(wk) ? currentWeekRef : null} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr)) 210px', borderBottom: '1px solid var(--surface-color)', scrollMarginTop: '3rem' }}>
                            {wk.days.map(day => {
                                const isToday = day.key === todayKey
                                return (
                                    <div
                                        key={day.key}
                                        onDragOver={(e) => { e.preventDefault(); setDragOver(day.key) }}
                                        onDragLeave={() => setDragOver(k => (k === day.key ? null : k))}
                                        onDrop={dropOn(day.key)}
                                        style={{
                                            minHeight: '9rem', padding: '0.45rem', borderRight: '1px solid var(--surface-color)',
                                            background: dragOver === day.key ? 'var(--primary-glow)' : isToday ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                                            display: 'flex', flexDirection: 'column', gap: '0.45rem', transition: 'background 0.15s ease'
                                        }}
                                    >
                                        <div style={{
                                            fontSize: '0.7rem', fontWeight: 900, alignSelf: 'flex-start', padding: '2px 7px', borderRadius: '999px',
                                            background: isToday ? 'var(--primary-color)' : 'transparent', color: isToday ? 'white' : 'var(--text-muted)'
                                        }}>
                                            {day.d.getDate() === 1 || (wi === 0 && day.d.getDay() === 1) ? day.d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : day.d.getDate()}
                                        </div>
                                        {day.workouts.map(w => <WorkoutTile key={w.id} workout={w} plan={plan} onOpen={onOpen} draggable={canDrag(w)} compact />)}
                                    </div>
                                )
                            })}
                            <div style={{ padding: '0.6rem 0.7rem', background: 'var(--surface-color)' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                    Semana de {wk.start.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                                </div>
                                <WeekSummary stats={stats} formPoint={formPoint} />
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    // Telemóvel: agenda por semana.
    return (
        <div>
            {legend}
            {weeks.map((wk, wi) => {
                const stats = weekStats(wk.days, plan)
                const lastKey = wk.days[6].key
                const formPoint = wk.days[0].key <= todayKey ? seriesByKey[lastKey > todayKey ? todayKey : lastKey] : null
                return (
                    <div key={wi} ref={isCurrent(wk) ? currentWeekRef : null} className="premium-card" style={{ padding: '1rem', marginBottom: '1rem', scrollMarginTop: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: isCurrent(wk) ? 'var(--primary-color)' : 'var(--text-muted)', marginBottom: '0.6rem' }}>
                            {isCurrent(wk) ? 'Esta semana · ' : ''}Semana de {wk.start.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                        </div>
                        <WeekSummary stats={stats} formPoint={formPoint} horizontal />
                        <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column' }}>
                            {wk.days.map(day => {
                                const isToday = day.key === todayKey
                                return (
                                    <div key={day.key} style={{ display: 'grid', gridTemplateColumns: '2.6rem 1fr', gap: '0.6rem', padding: '0.5rem 0', borderTop: '1px solid var(--surface-color)', alignItems: 'start' }}>
                                        <div style={{ textAlign: 'center', lineHeight: 1.1, paddingTop: '0.2rem' }}>
                                            <div style={{ fontSize: '0.58rem', fontWeight: 900, textTransform: 'uppercase', color: isToday ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                                                {day.d.toLocaleDateString('pt-PT', { weekday: 'short' }).slice(0, 3)}
                                            </div>
                                            <div style={{
                                                fontSize: '1rem', fontWeight: 900, margin: '2px auto 0', width: '1.9rem', height: '1.9rem', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: isToday ? 'var(--primary-color)' : 'transparent', color: isToday ? 'white' : 'var(--text-main)'
                                            }}>{day.d.getDate()}</div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                                            {day.workouts.length
                                                ? day.workouts.map(w => <WorkoutTile key={w.id} workout={w} plan={plan} onOpen={onOpen} />)
                                                : <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.55rem 0', opacity: 0.6 }}>—</div>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
            <style>{TILE_CSS}</style>
        </div>
    )
}

