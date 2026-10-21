// Cartões do início ligados aos objetivos e ao bem-estar: check-in diário com
// prontidão, contagem decrescente para o evento e editor de objetivos.
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Target, X, Moon, Pencil } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { localKey, readinessScore, readinessLabel, daysUntil } from '../../lib/training'

const SCALES = [
    { k: 'energy', label: 'Energia', low: 'Sem energia', high: 'Cheio de energia', good: 'high' },
    { k: 'stress', label: 'Stress', low: 'Calmo', high: 'Muito stressado', good: 'low' },
    { k: 'soreness', label: 'Dores musculares', low: 'Nenhuma', high: 'Muitas', good: 'low' }
]

function ScaleRow({ scale, value, onChange }) {
    return (
        <div style={{ marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                <span>{scale.label}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{value ? (value <= 2 ? scale.low : value >= 4 ? scale.high : 'Normal') : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem' }}>
                {[1, 2, 3, 4, 5].map(v => {
                    const goodness = scale.good === 'high' ? (v - 1) / 4 : (5 - v) / 4
                    const color = `hsl(${Math.round(goodness * 130)} 70% 45%)`
                    const sel = value === v
                    return (
                        <button key={v} onClick={() => onChange(sel ? null : v)} aria-pressed={sel} aria-label={`${scale.label} ${v}`} style={{
                            height: '2.4rem', borderRadius: '0.7rem', cursor: 'pointer', fontWeight: 900, font: 'inherit',
                            border: `2px solid ${sel ? color : 'var(--surface-color)'}`,
                            background: sel ? color : 'var(--surface-color)', color: sel ? 'white' : 'var(--text-muted)',
                            transition: 'all 0.15s ease'
                        }}>{v}</button>
                    )
                })}
            </div>
        </div>
    )
}

// Check-in diário: 20 segundos para registar sono e estado, e ver a prontidão do dia.
export function CheckinCard({ checkins = {}, tsb, onSaved }) {
    const today = localKey(new Date())
    const existing = checkins[today]
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState(existing || { sleep: 7, energy: null, stress: null, soreness: null, restingHr: '', hrv: '' })
    const [saving, setSaving] = useState(false)
    const score = readinessScore(existing, tsb)
    const info = readinessLabel(score)

    const save = async () => {
        setSaving(true)
        try {
            const res = await apiFetch('profile/checkin', { method: 'POST', body: JSON.stringify({ date: today, ...form, restingHr: form.restingHr === '' ? null : form.restingHr, hrv: form.hrv === '' ? null : form.hrv }) })
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao guardar')
            const saved = await res.json()
            onSaved?.({ ...checkins, [today]: saved })
            setEditing(false)
        } catch (err) {
            alert(`Não foi possível guardar o check-in: ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    if (!editing && existing) {
        return (
            <div className="premium-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
                    background: `conic-gradient(${info?.color || 'var(--primary-color)'} ${(score || 0) * 3.6}deg, var(--surface-color) 0deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.15rem' }}>{score ?? '—'}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Prontidão de hoje</div>
                    <div style={{ fontWeight: 900, color: info?.color }}>{info?.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                        {existing.sleep != null && <>😴 {existing.sleep}h</>}
                        {existing.energy != null && <> · ⚡ {existing.energy}/5</>}
                        {existing.stress != null && <> · 🧠 {existing.stress}/5</>}
                        {existing.soreness != null && <> · 🦵 {existing.soreness}/5</>}
                        {existing.restingHr != null && <> · ❤️ {existing.restingHr} bpm</>}
                        {existing.hrv != null && <> · VFC {existing.hrv} ms</>}
                    </div>
                </div>
                <button onClick={() => { setForm(existing); setEditing(true) }} aria-label="Editar check-in" className="chip" style={{ padding: '0.5rem' }}><Pencil size={16} /></button>
            </div>
        )
    }

    if (!editing) {
        return (
            <button onClick={() => setEditing(true)} className="premium-card" style={{ width: '100%', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', font: 'inherit', color: 'var(--text-main)', textAlign: 'left', border: '1px solid var(--surface-color)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Moon size={20} color="var(--primary-color)" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900 }}>Como estás hoje?</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Check-in de 20 segundos para veres a tua prontidão</div>
                </div>
                <span style={{ color: 'var(--primary-color)', fontWeight: 900, fontSize: '1.2rem' }}>›</span>
            </button>
        )
    }

    return (
        <div className="premium-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Moon size={18} color="var(--primary-color)" />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>Check-in de hoje</h4>
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>20 segundos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>Horas de sono</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button className="chip" aria-label="Menos meia hora" onClick={() => setForm(f => ({ ...f, sleep: Math.max(0, (f.sleep ?? 7) - 0.5) }))} style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center' }}>−</button>
                    <span style={{ fontWeight: 900, fontSize: '1.2rem', minWidth: '3.2rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{form.sleep ?? '—'}h</span>
                    <button className="chip" aria-label="Mais meia hora" onClick={() => setForm(f => ({ ...f, sleep: Math.min(16, (f.sleep ?? 7) + 0.5) }))} style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center' }}>+</button>
                </div>
            </div>
            {SCALES.map(sc => <ScaleRow key={sc.k} scale={sc} value={form[sc.k]} onChange={v => setForm(f => ({ ...f, [sc.k]: v }))} />)}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <label htmlFor="ck-hr" style={{ fontSize: '0.8rem', fontWeight: 800 }}>FC em repouso <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>(opcional)</span></label>
                <input id="ck-hr" type="number" inputMode="numeric" min="25" max="140" placeholder="bpm" value={form.restingHr ?? ''} onChange={e => setForm(f => ({ ...f, restingHr: e.target.value === '' ? '' : Number(e.target.value) }))}
                    style={{ width: '80px', padding: '0.5rem', borderRadius: '0.7rem', border: '2px solid var(--surface-color)', background: 'var(--surface-color)', color: 'var(--text-main)', fontWeight: 900, textAlign: 'center' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <label htmlFor="ck-hrv" style={{ fontSize: '0.8rem', fontWeight: 800 }}>VFC <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>(opcional, do relógio)</span></label>
                <input id="ck-hrv" type="number" inputMode="numeric" min="5" max="300" placeholder="ms" value={form.hrv ?? ''} onChange={e => setForm(f => ({ ...f, hrv: e.target.value === '' ? '' : Number(e.target.value) }))}
                    style={{ width: '80px', padding: '0.5rem', borderRadius: '0.7rem', border: '2px solid var(--surface-color)', background: 'var(--surface-color)', color: 'var(--text-main)', fontWeight: 900, textAlign: 'center' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="chip" onClick={() => setEditing(false)} style={{ flex: '0 0 auto', padding: '0 1rem' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={save} disabled={saving} style={{ height: '48px' }}>{saving ? 'A guardar...' : 'Guardar check-in'}</button>
            </div>
        </div>
    )
}

// Contagem decrescente para o evento-alvo (prova, competição, teste de 1RM...).
export function EventCountdown({ goals, onEdit }) {
    const ev = goals?.event
    if (!ev) {
        return (
            <button onClick={onEdit} className="premium-card" style={{ width: '100%', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', border: '2px dashed var(--surface-color)', background: 'transparent', font: 'inherit', color: 'var(--text-main)', textAlign: 'left' }}>
                <Target size={22} color="var(--primary-color)" />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900 }}>Para que estás a treinar?</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Define um evento e uma meta semanal</div>
                </div>
            </button>
        )
    }
    const days = daysUntil(ev.date)
    const past = days < 0
    return (
        <div className="premium-card" onClick={onEdit} style={{ padding: '1.25rem', marginBottom: '1.5rem', cursor: 'pointer', background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'center', minWidth: '64px' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{past ? '✓' : days}</div>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>{past ? 'feito' : days === 1 ? 'dia' : 'dias'}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-color)' }}>{past ? 'Evento passado' : days === 0 ? 'É hoje!' : 'Próximo evento'}</div>
                <div style={{ fontWeight: 900, fontSize: '1.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 600 }}>{new Date(ev.date + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
        </div>
    )
}

export function GoalsModal({ goals, onClose, onSaved }) {
    const [name, setName] = useState(goals?.event?.name || '')
    const [date, setDate] = useState(goals?.event?.date || '')
    const [workouts, setWorkouts] = useState(goals?.weeklyTarget?.workouts ?? 4)
    const [minutes, setMinutes] = useState(goals?.weeklyTarget?.minutes ?? 240)
    const [saving, setSaving] = useState(false)

    const save = async (clearEvent = false) => {
        setSaving(true)
        try {
            const body = {
                event: !clearEvent && name.trim() && date ? { name: name.trim(), date } : null,
                weeklyTarget: { workouts: Number(workouts) || null, minutes: Number(minutes) || null }
            }
            const res = await apiFetch('profile/goals', { method: 'PUT', body: JSON.stringify(body) })
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao guardar')
            onSaved?.(await res.json())
            onClose()
        } catch (err) {
            alert(err.message)
        } finally {
            setSaving(false)
        }
    }

    const field = { width: '100%', padding: '0.85rem 1rem', borderRadius: '0.9rem', border: '2px solid var(--surface-color)', background: 'var(--surface-color)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700 }
    return createPortal(
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10, 15, 30, 0.7)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()} className="premium-card animate-scale-up" style={{ width: '100%', maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-color)', padding: '1.5rem', position: 'relative' }}>
                <button onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                <h3 style={{ fontWeight: 900, marginBottom: '1.25rem' }}>Os teus objetivos</h3>

                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Evento</div>
                <input placeholder="Ex: Open 2027, 1RM de agachamento, Meia Maratona" value={name} maxLength={80} onChange={e => setName(e.target.value)} style={{ ...field, marginBottom: '0.6rem' }} />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...field, marginBottom: '1.5rem' }} />

                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Meta semanal</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Treinos
                        <input type="number" min="1" max="14" value={workouts} onChange={e => setWorkouts(e.target.value)} style={{ ...field, marginTop: '0.35rem', textAlign: 'center' }} />
                    </label>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Minutos
                        <input type="number" min="10" max="3000" step="10" value={minutes} onChange={e => setMinutes(e.target.value)} style={{ ...field, marginTop: '0.35rem', textAlign: 'center' }} />
                    </label>
                </div>

                <button className="btn btn-primary" onClick={() => save(false)} disabled={saving} style={{ height: '52px', marginBottom: '0.5rem' }}>{saving ? 'A guardar...' : 'Guardar objetivos'}</button>
                {goals?.event && <button onClick={() => save(true)} disabled={saving} style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', fontWeight: 800, padding: '0.6rem', cursor: 'pointer' }}>Remover evento</button>}
            </div>
        </div>,
        document.body
    )
}
