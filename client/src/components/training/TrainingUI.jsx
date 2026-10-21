// Grafismos partilhados dos treinos: barra de estrutura, métricas, pílulas de forma,
// gráfico de performance e faixa semanal. Usados pelos "meus treinos"; a box pode
// reutilizá-los sem depender da lógica dos planos.
import React, { useMemo, useRef, useState } from 'react'
import { METRIC_COLORS, STATUS, workoutBlocks } from '../../lib/training'

const PHASE_COLORS = { warmup: '#f59e0b', main: 'var(--primary-color)', cooldown: '#06b6d4' }
const PHASE_LABELS = { warmup: 'Aquec.', main: 'Parte principal', cooldown: 'Calma' }

// Barra de estrutura do treino (como a faixa "Warm up / Main Set / Cool down" do
// TrainingPeaks): largura = tempo estimado, altura = intensidade.
export function StructureBar({ data, height = 44, dark = false, labels = false }) {
    const blocks = useMemo(() => workoutBlocks(data), [data])
    if (!blocks.length) return null
    const total = blocks.reduce((s, b) => s + b.seconds, 0) || 1

    const phases = ['warmup', 'main', 'cooldown']
        .map(p => ({ p, share: blocks.filter(b => b.phase === p).reduce((s, b) => s + b.seconds, 0) / total }))
        .filter(x => x.share > 0)

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height }} aria-label="Estrutura do treino">
                {blocks.map((b, i) => (
                    <div
                        key={i}
                        title={`${b.name}${b.sets ? ` · ${b.sets}×${b.reps}` : ''}`}
                        style={{
                            flex: `${b.seconds} 1 0`,
                            minWidth: '3px',
                            height: `${Math.round(b.intensity * 100)}%`,
                            background: PHASE_COLORS[b.phase],
                            opacity: dark ? 0.9 : 0.85,
                            borderRadius: '3px 3px 1px 1px',
                            transformOrigin: 'bottom',
                            animation: `ft-grow 0.5s ${i * 0.03}s both cubic-bezier(0.2, 0.8, 0.2, 1)`
                        }}
                    />
                ))}
            </div>
            {labels && (
                <div style={{ display: 'flex', gap: '2px', marginTop: '6px' }}>
                    {phases.map(({ p, share }) => (
                        <div key={p} style={{
                            flex: `${share} 1 0`, minWidth: 0, fontSize: '0.65rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            color: dark ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                            borderTop: `2px solid ${PHASE_COLORS[p]}`, paddingTop: '4px'
                        }}>
                            {share > 0.08 ? PHASE_LABELS[p] : ''}
                        </div>
                    ))}
                </div>
            )}
            <style>{`@keyframes ft-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
        </div>
    )
}

// Número grande com unidade pequena, como os totais do TrainingPeaks ("00:45 hms").
export function MetricStat({ label, value, unit, color, dark = false, align = 'left' }) {
    return (
        <div style={{ textAlign: align, minWidth: 0 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: dark ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontWeight: 900, fontSize: '1.35rem', lineHeight: 1.15, color: color || (dark ? 'white' : 'var(--text-main)'), fontVariantNumeric: 'tabular-nums' }}>
                {value ?? '—'}
                {unit && value != null && <span style={{ fontSize: '0.7rem', fontWeight: 700, marginLeft: '4px', opacity: 0.6 }}>{unit}</span>}
            </div>
        </div>
    )
}

// Forma / Fadiga / Frescura em pílulas coloridas (cabeçalho do treino no TrainingPeaks).
export function FormPills({ point, size = 'md' }) {
    const items = [
        { k: 'ctl', label: 'Forma', value: point?.ctl },
        { k: 'atl', label: 'Fadiga', value: point?.atl },
        { k: 'tsb', label: 'Frescura', value: point?.tsb }
    ]
    const big = size === 'lg'
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {items.map(it => (
                <div key={it.k} style={{
                    background: METRIC_COLORS[it.k], color: 'white', borderRadius: '0.9rem',
                    padding: big ? '0.75rem 0.5rem' : '0.5rem', textAlign: 'center',
                    boxShadow: `0 6px 14px -6px ${METRIC_COLORS[it.k]}`
                }}>
                    <div style={{ fontSize: big ? '1.6rem' : '1.15rem', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {it.value == null ? '—' : Math.round(it.value)}{it.value != null && <span style={{ fontSize: '0.55em', fontWeight: 800, opacity: 0.85, marginLeft: '3px' }}>pts</span>}
                    </div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.9, marginTop: '4px' }}>{it.label}</div>
                </div>
            ))}
        </div>
    )
}

// Frase curta que traduz a frescura (TSB) para quem não conhece o modelo.
export const formAdvice = (tsb) => {
    if (tsb == null) return ''
    if (tsb > 15) return 'Muito fresco: bom dia para um treino forte ou um teste.'
    if (tsb > 5) return 'Fresco e recuperado.'
    if (tsb >= -10) return 'Zona neutra: a manter a forma.'
    if (tsb >= -30) return 'Zona produtiva: estás a construir forma.'
    return 'Fadiga elevada: considera um dia leve ou descanso.'
}

// Gráfico de performance (Performance Management Chart): Forma em área azul,
// Fadiga em linha rosa, Frescura em laranja numa faixa própria e carga diária em barras.
export function PerformanceChart({ series, height = 220 }) {
    const [hover, setHover] = useState(null)
    const ref = useRef(null)
    if (!series?.length) return null

    const W = 600, H = height, padL = 8, padR = 8, topH = H * 0.62, bandTop = topH + 16, bandH = H - bandTop - 18
    const n = series.length
    const x = i => padL + (i / Math.max(1, n - 1)) * (W - padL - padR)
    const maxY = Math.max(10, ...series.map(p => Math.max(p.ctl, p.atl))) * 1.15
    const y = v => 8 + (1 - v / maxY) * (topH - 8)
    const maxLoad = Math.max(1, ...series.map(p => p.load))
    const tsbAbs = Math.max(10, ...series.map(p => Math.abs(p.tsb)))
    const yT = v => bandTop + bandH / 2 - (v / tsbAbs) * (bandH / 2)

    const line = key => series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(key === 'tsb' ? yT(p.tsb) : y(p[key])).toFixed(1)}`).join('')
    const area = `${line('ctl')}L${x(n - 1)},${topH}L${x(0)},${topH}Z`
    const barW = Math.max(1.5, (W - padL - padR) / n - 1.5)

    const onMove = (e) => {
        const r = ref.current.getBoundingClientRect()
        const cx = ((e.touches?.[0]?.clientX ?? e.clientX) - r.left) / r.width * W
        setHover(Math.max(0, Math.min(n - 1, Math.round((cx - padL) / (W - padL - padR) * (n - 1)))))
    }
    const p = hover != null ? series[hover] : series[n - 1]
    const months = series.filter((s, i) => i > 0 && s.date.getDate() === 1).map(s => ({ i: series.indexOf(s), label: s.date.toLocaleDateString('pt-PT', { month: 'short' }) }))

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                    {p.date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: METRIC_COLORS.ctl }}>Forma {Math.round(p.ctl)} pts</span>
                    <span style={{ color: METRIC_COLORS.atl }}>Fadiga {Math.round(p.atl)} pts</span>
                    <span style={{ color: METRIC_COLORS.tsb }}>Frescura {Math.round(p.tsb)} pts</span>
                    {p.load > 0 && <span style={{ color: METRIC_COLORS.load }}>Carga {p.load} pts</span>}
                </div>
            </div>
            <svg
                ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }}
                onMouseMove={onMove} onTouchStart={onMove} onTouchMove={onMove} onMouseLeave={() => setHover(null)}
                role="img" aria-label="Gráfico de forma, fadiga e frescura"
            >
                <defs>
                    <linearGradient id="ft-ctl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={METRIC_COLORS.ctl} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={METRIC_COLORS.ctl} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map(f => <line key={f} x1={padL} x2={W - padR} y1={8 + f * (topH - 8)} y2={8 + f * (topH - 8)} stroke="currentColor" strokeOpacity="0.07" />)}
                {series.map((s, i) => s.load > 0 && (
                    <rect key={i} x={x(i) - barW / 2} width={barW} y={topH - (s.load / maxLoad) * topH * 0.35} height={(s.load / maxLoad) * topH * 0.35} fill={METRIC_COLORS.load} opacity="0.35" rx="1" />
                ))}
                <path d={area} fill="url(#ft-ctl)" />
                <path d={line('ctl')} fill="none" stroke={METRIC_COLORS.ctl} strokeWidth="2.5" strokeLinejoin="round" />
                <path d={line('atl')} fill="none" stroke={METRIC_COLORS.atl} strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />
                <line x1={padL} x2={W - padR} y1={topH} y2={topH} stroke="currentColor" strokeOpacity="0.15" />
                <rect x={padL} y={bandTop} width={W - padL - padR} height={bandH} fill="currentColor" opacity="0.03" rx="4" />
                <line x1={padL} x2={W - padR} y1={yT(0)} y2={yT(0)} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="3 3" />
                <path d={line('tsb')} fill="none" stroke={METRIC_COLORS.tsb} strokeWidth="1.75" strokeLinejoin="round" />
                {months.map(m => (
                    <text key={m.i} x={x(m.i)} y={H - 4} fontSize="11" fill="currentColor" opacity="0.45" textAnchor="middle" style={{ textTransform: 'capitalize' }}>{m.label}</text>
                ))}
                {hover != null && (
                    <g>
                        <line x1={x(hover)} x2={x(hover)} y1={4} y2={bandTop + bandH} stroke="currentColor" strokeOpacity="0.3" />
                        <circle cx={x(hover)} cy={y(p.ctl)} r="4" fill={METRIC_COLORS.ctl} stroke="white" strokeWidth="1.5" />
                        <circle cx={x(hover)} cy={y(p.atl)} r="3.5" fill={METRIC_COLORS.atl} stroke="white" strokeWidth="1.5" />
                        <circle cx={x(hover)} cy={yT(p.tsb)} r="3.5" fill={METRIC_COLORS.tsb} stroke="white" strokeWidth="1.5" />
                    </g>
                )}
            </svg>
        </div>
    )
}

// Faixa da semana (Seg-Dom) com o estado de cada dia, como a vista semanal do calendário.
export function WeekStrip({ days, selectedKey, onSelect }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
            {days.map(d => {
                const st = d.status ? STATUS[d.status] : null
                const sel = d.key === selectedKey
                return (
                    <button
                        key={d.key}
                        onClick={onSelect ? () => onSelect(d) : undefined}
                        style={{
                            border: d.isToday ? '2px solid var(--primary-color)' : '1px solid transparent',
                            background: sel ? 'var(--primary-color)' : 'var(--surface-color)',
                            color: sel ? 'white' : 'var(--text-main)',
                            borderRadius: '0.9rem', padding: '0.45rem 0 0.5rem', cursor: onSelect ? 'pointer' : 'default',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                            transition: 'background 0.2s ease, transform 0.15s ease', font: 'inherit'
                        }}
                    >
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.6, textTransform: 'uppercase' }}>{d.label}</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 900, lineHeight: 1 }}>{d.num}</span>
                        <span style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            background: st && d.status !== 'rest' ? (sel ? 'white' : st.color) : 'transparent',
                            border: d.status === 'rest' ? `1.5px solid ${sel ? 'white' : STATUS.rest.color}` : 'none'
                        }} />
                    </button>
                )
            })}
        </div>
    )
}

export function StatusBadge({ status }) {
    const st = STATUS[status]
    if (!st) return null
    return (
        <span style={{
            fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: st.color, background: st.bg, padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap'
        }}>{st.label}</span>
    )
}

// Tendência de um exercício ao longo das sessões (1RM estimado, volume ou séries feitas),
// com média das últimas 3 sessões a tracejado e recordes pessoais a dourado.
const TREND_TABS = [
    { k: 'e1rm', label: '1RM est.', unit: 'kg' },
    { k: 'volume', label: 'Volume', unit: 'kg' },
    { k: 'compliance', label: 'Séries', unit: '%' }
]

export function ExerciseTrend({ sessions }) {
    const [tab, setTab] = useState(sessions.some(s => s.e1rm) ? 'e1rm' : 'volume')
    const pts = sessions
        .map(s => ({ ...s, compliance: s.planned ? Math.round(s.sets / s.planned * 100) : null }))
        .filter(s => s[tab] != null && s[tab] > 0)
    const cfg = TREND_TABS.find(t => t.k === tab)

    if (!sessions.length) {
        return <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.75rem 0' }}>Ainda sem registos deste exercício. Marca as séries feitas e o histórico aparece aqui.</div>
    }

    const W = 300, H = 110, pad = 14
    const vals = pts.map(p => p[tab])
    const min = Math.min(...vals), max = Math.max(...vals)
    const span = max - min || Math.max(1, max * 0.1)
    const x = i => pad + (pts.length > 1 ? i / (pts.length - 1) : 0.5) * (W - pad * 2)
    const y = v => 10 + (1 - (v - min + span * 0.1) / (span * 1.2)) * (H - 28)
    const avg = pts.map((_, i) => { const w = pts.slice(Math.max(0, i - 2), i + 1); return w.reduce((s, p) => s + p[tab], 0) / w.length })
    const last = pts[pts.length - 1], first = pts[0]
    const delta = last && first && pts.length > 1 ? last[tab] - first[tab] : null

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {TREND_TABS.map(t => (
                        <button key={t.k} onClick={() => setTab(t.k)} style={{
                            border: `1.5px solid ${tab === t.k ? 'var(--primary-color)' : 'var(--surface-color)'}`,
                            background: tab === t.k ? 'var(--primary-color)' : 'transparent', color: tab === t.k ? 'white' : 'var(--text-muted)',
                            borderRadius: '999px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', font: 'inherit'
                        }}>{t.label}</button>
                    ))}
                </div>
                {last && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(last[tab] * 10) / 10}<span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: '2px' }}>{cfg.unit}</span>
                        {delta != null && delta !== 0 && (
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: delta > 0 ? '#16a34a' : '#dc2626' }}>{delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 10) / 10)}</span>
                        )}
                    </div>
                )}
            </div>
            {pts.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Sem dados de {cfg.label.toLowerCase()} (regista as cargas em kg).</div>
            ) : (
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label={`Tendência de ${cfg.label}`}>
                    <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[tab])}`).join('')} fill="none" stroke="var(--primary-color)" strokeWidth="2" strokeLinejoin="round" />
                    {pts.length > 2 && <path d={avg.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')} fill="none" stroke="var(--primary-color)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 3" />}
                    {pts.map((p, i) => {
                        const pr = tab === 'e1rm' && p.pr
                        const lastPr = pr && !pts.slice(i + 1).some(q => q.pr)
                        return (
                            <g key={i}>
                                <circle cx={x(i)} cy={y(p[tab])} r={pr ? 5 : 3} fill={pr ? '#f59e0b' : 'var(--primary-color)'} stroke="white" strokeWidth="1.5">
                                    <title>{`${p.date.toLocaleDateString('pt-PT')}: ${Math.round(p[tab] * 10) / 10} ${cfg.unit}${pr ? ' · recorde' : ''}`}</title>
                                </circle>
                                {lastPr && <text x={x(i)} y={y(p[tab]) - 8} fontSize="8" fontWeight="800" fill="#d97706" textAnchor="middle">PR</text>}
                            </g>
                        )
                    })}
                    <text x={pad} y={H - 4} fontSize="9" fill="currentColor" opacity="0.45">{first.date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</text>
                    {pts.length > 1 && <text x={W - pad} y={H - 4} fontSize="9" fill="currentColor" opacity="0.45" textAnchor="end">{last.date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</text>}
                </svg>
            )}
        </div>
    )
}

// Registo de séries de um exercício: repetições, carga e visto de concluído.
export function SetLogger({ sets, onChange }) {
    const update = (i, patch) => onChange(sets.map((s, j) => (j === i ? { ...s, ...patch } : s)))
    const inputStyle = {
        width: '100%', minWidth: 0, padding: '0.45rem 0.4rem', borderRadius: '0.6rem', textAlign: 'center',
        border: '1.5px solid var(--surface-color)', background: 'var(--surface-color)', color: 'var(--text-main)',
        fontSize: '0.95rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums'
    }
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '2.2rem 1fr 1fr 2.6rem', gap: '0.4rem 0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Série</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Reps</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Kg</span>
            <span />
            {sets.map((s, i) => (
                <React.Fragment key={i}>
                    <span style={{ fontWeight: 900, color: s.done ? STATUS.done.color : 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</span>
                    <input type="number" inputMode="numeric" min="0" aria-label={`Repetições da série ${i + 1}`} value={s.reps ?? ''} onChange={e => update(i, { reps: e.target.value === '' ? null : Number(e.target.value) })} style={inputStyle} />
                    <input type="number" inputMode="decimal" min="0" step="0.5" aria-label={`Carga da série ${i + 1}`} placeholder="—" value={s.kg ?? ''} onChange={e => update(i, { kg: e.target.value === '' ? null : Number(e.target.value) })} style={inputStyle} />
                    <button
                        onClick={() => update(i, { done: !s.done })}
                        aria-label={s.done ? `Desmarcar série ${i + 1}` : `Marcar série ${i + 1} como feita`}
                        aria-pressed={s.done}
                        style={{
                            width: '2.6rem', height: '2.3rem', borderRadius: '0.7rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 900,
                            border: `2px solid ${s.done ? STATUS.done.color : 'var(--surface-color)'}`,
                            background: s.done ? STATUS.done.color : 'transparent', color: s.done ? 'white' : 'var(--text-muted)',
                            transition: 'all 0.15s ease'
                        }}
                    >✓</button>
                </React.Fragment>
            ))}
        </div>
    )
}

// Letra do bloco (A, B, C…) num círculo, como no construtor de força.
export function BlockBadge({ letter, color = 'var(--primary-color)' }) {
    return (
        <span style={{
            width: '30px', height: '30px', borderRadius: '50%', background: color, color: 'white', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem'
        }}>{letter}</span>
    )
}

// Distribuição do tempo por categoria: anel com o total ao centro e legenda com minutos e %.
export function CategoryDonut({ items }) {
    const total = items.reduce((s, i) => s + i.minutes, 0)
    if (!total) return <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sem treinos neste período.</div>
    const R = 42, C = 2 * Math.PI * R
    let acc = 0
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <svg viewBox="0 0 120 120" width="130" height="130" role="img" aria-label="Distribuição do tempo por tipo de treino" style={{ flexShrink: 0 }}>
                <g transform="rotate(-90 60 60)">
                    {items.map(it => {
                        const len = it.minutes / total * C
                        const seg = <circle key={it.k} cx="60" cy="60" r={R} fill="none" stroke={it.color} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc}><title>{`${it.label}: ${it.minutes} min`}</title></circle>
                        acc += len
                        return seg
                    })}
                </g>
                <text x="60" y="58" textAnchor="middle" fontSize="18" fontWeight="900" fill="currentColor">{total >= 600 ? `${Math.round(total / 60)}` : total}</text>
                <text x="60" y="74" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor" opacity="0.55">{total >= 600 ? 'horas' : 'min'}</text>
            </svg>
            <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {items.map(it => (
                    <div key={it.k} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700 }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: it.color, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{it.label}</span>
                        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{it.minutes} min · {Math.round(it.minutes / total * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
