import React, { useState, useEffect } from 'react';
import { ChevronLeft, History, Trophy, TrendingUp, Calendar, Clock, Dumbbell, Save, Plus, Flame, Medal, Award } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { isBoxResult, performanceSeries, resultLoad, setLogSummary, METRIC_COLORS, localKey, peakPerformances, rampRates, weeklySummaries, readinessScore, timeByCategory } from '../lib/training';
import { PerformanceChart, FormPills, MetricStat, CategoryDonut, formAdvice } from './training/TrainingUI';

// Resultado livre ("56:45", "85kg", "30") com a unidade e o tipo explícitos.
const formatScore = (score) => {
    const t = String(score ?? '').trim();
    const time = t.match(/^(\d{1,3}):(\d{2})$/);
    if (time) return { value: `${parseInt(time[1], 10)} min ${time[2]} s`, label: 'tempo' };
    const kg = t.match(/^(\d+(?:[.,]\d+)?)\s*kg$/i);
    if (kg) return { value: `${kg[1]} kg`, label: 'carga' };
    return { value: t || '—', label: 'resultado' };
};

const RANGES = [{ days: 42, label: '6 sem' }, { days: 90, label: '3 meses' }, { days: 180, label: '6 meses' }];

const DEFAULT_LIFTS = [
    { id: 'back_squat', name: 'Back Squat' },
    { id: 'front_squat', name: 'Front Squat' },
    { id: 'deadlift', name: 'Deadlift' },
    { id: 'clean', name: 'Clean' },
    { id: 'jerk', name: 'Jerk' },
    { id: 'snatch', name: 'Snatch' },
    { id: 'strict_press', name: 'Strict Press' },
    { id: 'push_press', name: 'Push Press' }
];

const WOD_BENCHMARKS = [
    { id: 'fran', name: 'Fran (21-15-9)' },
    { id: 'grace', name: 'Grace (30 Clean & Jerks)' },
    { id: 'murph', name: 'Murph' },
    { id: 'helen', name: 'Helen' },
    { id: 'annic', name: 'Annie' },
    { id: 'cindy', name: 'Cindy (AMRAP 20)' },
    { id: 'amanda', name: 'Amanda' },
    { id: 'painstorm_1', name: 'Painstorm I' },
    { id: 'painstorm_21', name: 'Painstorm XXI' }
];

export default function HistoryView({ onBack, profile }) {
    const [activeTab, setActiveTab] = useState('history'); // 'history', 'benchmarks', or 'wods'
    const [history, setHistory] = useState([]);
    const [benchmarks, setBenchmarks] = useState({});
    const [wodPRs, setWodPRs] = useState({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [scope, setScope] = useState('mine'); // 'mine' = os meus treinos, 'box' = resultados da box
    const [range, setRange] = useState(90);
    const scopedHistory = history.filter(h => scope === 'box' ? isBoxResult(h) : !isBoxResult(h));
    const weekStartKey = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localKey(d); };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'history') {
                const res = await apiFetch('history');
                const data = await res.json();
                setHistory(Array.isArray(data) ? data : []);
            } else {
                const res = await apiFetch('profile/benchmarks');
                const data = await res.json();
                setBenchmarks(data.liftBenchmarks || {});
                setWodPRs(data.wodBenchmarks || {});
            }
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await apiFetch('profile/benchmarks', {
                method: 'POST',
                body: JSON.stringify({ benchmarks: { liftBenchmarks: benchmarks, wodBenchmarks: wodPRs } })
            });
            if (res.ok) {
                alert("Progresso guardado com sucesso! 🦾");
            }
        } catch (err) {
            console.error("Error saving data:", err);
            alert("Erro ao guardar progresso.");
        } finally {
            setIsSaving(false);
        }
    };

    const updateBenchmark = (id, val) => {
        setBenchmarks({ ...benchmarks, [id]: val });
    };

    const updateWodPR = (id, val) => {
        setWodPRs({ ...wodPRs, [id]: val });
    };

    return (
        <div className="history-view animate-fade">
            <header style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button onClick={onBack} className="chip" style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Progressão</h1>
                </div>

                <div style={{
                    display: 'flex',
                    background: 'var(--surface-color)',
                    padding: '4px',
                    borderRadius: '1rem',
                    gap: '4px'
                }}>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    >
                        <History size={18} /> Histórico
                    </button>
                    <button
                        onClick={() => setActiveTab('benchmarks')}
                        className={`tab-btn ${activeTab === 'benchmarks' ? 'active' : ''}`}
                    >
                        <Trophy size={18} /> Cargas
                    </button>
                    <button
                        onClick={() => setActiveTab('wods')}
                        className={`tab-btn ${activeTab === 'wods' ? 'active' : ''}`}
                    >
                        <Award size={18} /> Recordes WOD
                    </button>
                </div>
            </header>

            <div className="content-area">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <div className="spinner" />
                    </div>
                ) : activeTab === 'history' ? (
                    <div className="history-timeline animate-fade">
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            {[{ k: 'mine', label: 'Os meus treinos' }, { k: 'box', label: 'Box' }].map(o => (
                                <button key={o.k} onClick={() => setScope(o.k)} className={`scope-chip ${scope === o.k ? 'active' : ''}`}>{o.label}</button>
                            ))}
                        </div>
                        {(() => {
                            const mine = history.filter(h => !isBoxResult(h));
                            const series = performanceSeries(mine, range);
                            const last = series[series.length - 1];
                            const weekAgo = series[series.length - 8];
                            const trend = last && weekAgo ? last.ctl - weekAgo.ctl : 0;
                            const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
                            const thisWeek = mine.filter(h => new Date(h.createdAt) >= monday);
                            const weekMin = thisWeek.reduce((s, h) => s + resultLoad(h).minutes, 0);
                            const weekLoad = thisWeek.reduce((s, h) => s + resultLoad(h).load, 0);
                            const anyEstimated = mine.some(h => resultLoad(h).estimated);
                            const ramps = rampRates(performanceSeries(mine, 91));
                            const peaks = peakPerformances(mine);
                            const weeks = weeklySummaries(mine, 8);
                            const maxWeekLoad = Math.max(1, ...weeks.map(w => w.load));
                            const checkins = profile?.checkins || {};
                            const wellnessDays = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); const k = localKey(d); return { d, k, c: checkins[k] }; });
                            const hasWellness = wellnessDays.some(w => w.c);

                            return scope === 'mine' && (
                                <>
                                    <div className="premium-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>A tua forma</h3>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: trend >= 0 ? '#16a34a' : '#dc2626' }}>
                                                Forma {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)} pts em 7 dias
                                            </span>
                                        </div>
                                        <FormPills point={last} size="lg" />
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.75rem 0 0', fontWeight: 600 }}>{formAdvice(last?.tsb)}</p>
                                        {ramps.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ramps.length}, 1fr)`, gap: '0.5rem', marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: '1px solid var(--surface-color)' }}>
                                                {ramps.map(rr => (
                                                    <div key={rr.days} style={{ textAlign: 'center' }}>
                                                        <div style={{ fontWeight: 900, fontSize: '1.05rem', color: rr.delta >= 0 ? '#16a34a' : '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{rr.delta >= 0 ? '+' : ''}{rr.delta.toFixed(1)}<span style={{ fontSize: '0.65rem', opacity: 0.7, marginLeft: '2px' }}>pts</span></div>
                                                        <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Forma {rr.days} dias</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="premium-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>Gestão de performance</h3>
                                            <div style={{ display: 'flex', background: 'var(--surface-color)', borderRadius: '0.7rem', padding: '3px' }}>
                                                {RANGES.map(r => (
                                                    <button key={r.days} onClick={() => setRange(r.days)} className={`range-btn ${range === r.days ? 'active' : ''}`}>{r.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <PerformanceChart series={series} />
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.6rem 0 0', lineHeight: 1.5 }}>
                                            Carga (pts) = minutos × esforço (RPE). <b style={{ color: METRIC_COLORS.ctl }}>Forma</b> é a média de 42 dias, <b style={{ color: METRIC_COLORS.atl }}>Fadiga</b> a de 7 dias e <b style={{ color: METRIC_COLORS.tsb }}>Frescura</b> a diferença entre as duas.
                                            {anyEstimated && ' Treinos sem RPE contam como esforço 6 e 45 min.'}
                                        </p>
                                    </div>

                                    <div className="premium-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                        <h3 style={{ margin: '0 0 0.9rem', fontSize: '1rem', fontWeight: 900 }}>
                                            Tempo por tipo de treino <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>· {RANGES.find(r => r.days === range)?.label}</span>
                                        </h3>
                                        <CategoryDonut items={timeByCategory(mine, range)} />
                                    </div>

                                    {peaks.length > 0 && (
                                        <div className="premium-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 900 }}>🏆 Recordes pessoais</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {peaks.slice(0, 6).map(pk => {
                                                    const recent = (Date.now() - pk.date) / 86400000 <= 14;
                                                    return (
                                                        <div key={pk.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: '0.9rem', background: recent ? 'rgba(245, 158, 11, 0.10)' : 'var(--surface-color)' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pk.name}{recent && <span style={{ marginLeft: '6px', fontSize: '0.6rem', fontWeight: 900, color: '#d97706', background: 'rgba(245,158,11,0.18)', padding: '1px 6px', borderRadius: '999px' }}>NOVO</span>}</div>
                                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{pk.kg} kg × {pk.reps} · {pk.date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontWeight: 900, fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums' }}>{pk.e1rm}<span style={{ fontSize: '0.65rem', opacity: 0.6 }}> kg</span></div>
                                                                <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>1RM est.</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="premium-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 900 }}>Resumo semanal</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            {weeks.map((w, i) => (
                                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '3rem minmax(2rem, 1fr) 11.5rem', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>{i === 0 ? 'Esta' : w.start.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>
                                                    <div style={{ height: '14px', borderRadius: '4px', background: 'var(--surface-color)', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${w.load / maxWeekLoad * 100}%`, background: METRIC_COLORS.load, opacity: i === 0 ? 0.55 : 0.8, borderRadius: '4px' }} />
                                                    </div>
                                                    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }}>{w.workouts} {w.workouts === 1 ? 'treino' : 'treinos'} · {w.minutes} min · {w.load} pts{w.prs > 0 && <span style={{ color: '#d97706' }}> · {w.prs} PR</span>}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {hasWellness && (
                                        <div className="premium-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 900 }}>Bem-estar (14 dias)</h3>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: '3px', alignItems: 'end', height: '70px' }}>
                                                {wellnessDays.map(w => {
                                                    const score = readinessScore(w.c, null);
                                                    return (
                                                        <div key={w.k} title={w.c ? `${w.d.toLocaleDateString('pt-PT')}: prontidão ${score}, sono ${w.c.sleep ?? '—'}h` : 'Sem check-in'} style={{
                                                            height: w.c ? `${Math.max(8, score || 0)}%` : '6%', borderRadius: '3px',
                                                            background: w.c ? `hsl(${Math.round((score || 0) * 1.3)} 70% 45%)` : 'var(--surface-color)'
                                                        }} />
                                                    );
                                                })}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '4px' }}>
                                                <span>{wellnessDays[0].d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span><span>Hoje</span>
                                            </div>
                                            {(() => {
                                                const withSleep = wellnessDays.filter(w => w.c?.sleep != null);
                                                const avgSleep = withSleep.length ? withSleep.reduce((s, w) => s + w.c.sleep, 0) / withSleep.length : null;
                                                const withHr = wellnessDays.filter(w => w.c?.restingHr != null);
                                                const avgHr = withHr.length ? Math.round(withHr.reduce((s, w) => s + w.c.restingHr, 0) / withHr.length) : null;
                                                const withHrv = wellnessDays.filter(w => w.c?.hrv != null);
                                                const avgHrv = withHrv.length ? Math.round(withHrv.reduce((s, w) => s + w.c.hrv, 0) / withHrv.length) : null;
                                                return (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.9rem' }}>
                                                        <MetricStat label="Sono médio" value={avgSleep != null ? avgSleep.toFixed(1) : null} unit="h" />
                                                        <MetricStat label="FC repouso" value={avgHr} unit="bpm" />
                                                        <MetricStat label="VFC média" value={avgHrv} unit="ms" />
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    <div className="premium-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
                                        <MetricStat label="Esta semana" value={thisWeek.length} unit={thisWeek.length === 1 ? 'treino' : 'treinos'} />
                                        <MetricStat label="Tempo" value={weekMin} unit="min" />
                                        <MetricStat label="Carga" value={weekLoad} unit="pts" color={METRIC_COLORS.load} />
                                    </div>
                                </>
                            );
                        })()}

                        {scopedHistory.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.5 }}>
                                <Calendar size={48} style={{ marginBottom: '1rem' }} />
                                <p>{scope === 'box' ? 'Ainda não tens resultados na box.' : 'Ainda não tens treinos registados.'}</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {scopedHistory.map((item, idx) => {
                                     let parsedFeedback = null;
                                     if (item.type === 'plan_feedback') {
                                         try {
                                             parsedFeedback = JSON.parse(item.notes);
                                         } catch (e) {}
                                     }

                                     // Os resultados vindos da TV não têm WOD associado: as notas
                                     // trazem "Nome do WOD · MODO · detalhe", por isso o primeiro
                                     // segmento é o nome e o resto é a linha de detalhe (sem repetir
                                     // o nome já mostrado no título).
                                     const tvParts = item.type === 'tv_timer' && item.notes
                                         ? item.notes.split(' · ')
                                         : null;
                                     const tvTitle = tvParts ? tvParts[0] : null;
                                     const detail = tvParts ? tvParts.slice(1).join(' · ') : item.notes;

                                     const wk = weekStartKey(item.createdAt);
                                     const newWeek = idx === 0 || weekStartKey(scopedHistory[idx - 1].createdAt) !== wk;
                                     const weekItems = newWeek ? scopedHistory.filter(h => weekStartKey(h.createdAt) === wk) : null;
                                     const itemLoad = scope === 'mine' ? resultLoad(item) : null;

                                     return (
                                         <React.Fragment key={item.id}>
                                         {newWeek && (
                                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: idx === 0 ? '0 0 0.25rem' : '1rem 0 0.25rem', padding: '0 0.25rem' }}>
                                                 <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                                                     Semana de {new Date(wk + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                                                 </span>
                                                 <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                                     {weekItems.length} {weekItems.length === 1 ? 'treino' : 'treinos'}
                                                     {scope === 'mine' && <> · <span style={{ color: METRIC_COLORS.load }}>carga {weekItems.reduce((s, h) => s + resultLoad(h).load, 0)} pts</span></>}
                                                 </span>
                                             </div>
                                         )}
                                         <div className="premium-card history-item" style={{ 
                                             padding: '0.9rem 1rem', 
                                             borderRadius: '1.25rem',
                                             borderLeft: `4px solid ${parsedFeedback ? '#4f46e5' : 'var(--primary-color)'}`
                                         }}>
                                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: parsedFeedback && (parsedFeedback.comment || parsedFeedback.aiProcessed?.adjustments_for_next) ? '0.75rem' : '0' }}>
                                                 <div style={{ width: '42px', flexShrink: 0, textAlign: 'center', lineHeight: 1.1 }}>
                                                     <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{new Date(item.createdAt).getDate()}</div>
                                                     <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                                         {new Date(item.createdAt).toLocaleDateString('pt-PT', { weekday: 'short' }).slice(0, 3)}
                                                     </div>
                                                 </div>
                                                 <div style={{ flex: 1, minWidth: 0 }}>
                                                     <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800, fontSize: '0.95rem' }}>
                                                         {item.boxWod?.title || item.globalWod?.name || item.scheduledWorkout?.focus || tvTitle || 'Treino'}
                                                     </div>
                                                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                         {itemLoad && (
                                                             <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{itemLoad.minutes} min</span>
                                                         )}
                                                         {parsedFeedback?.sets && (() => { const sm = setLogSummary(parsedFeedback.sets); return (
                                                             <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{sm.done}/{sm.planned} séries{sm.volume ? ` · ${sm.volume.toLocaleString('pt-PT')} kg` : ''}</span>
                                                         ); })()}
                                                         {parsedFeedback?.feel && (
                                                             <span title="Como te sentiste" style={{ fontSize: '0.85rem' }}>{['😫', '😕', '😐', '🙂', '💪'][parsedFeedback.feel - 1]}</span>
                                                         )}
                                                         {itemLoad && (
                                                             <span title={itemLoad.estimated ? 'Carga estimada' : 'Carga = minutos × RPE'} style={{ fontSize: '0.68rem', fontWeight: 800, color: METRIC_COLORS.load, background: 'rgba(220, 38, 38, 0.08)', padding: '1px 7px', borderRadius: '999px', fontVariantNumeric: 'tabular-nums' }}>
                                                                 carga {itemLoad.estimated ? '~' : ''}{itemLoad.load} pts
                                                             </span>
                                                         )}
                                                         <span style={{ fontSize: '0.58rem', fontWeight: 800, opacity: 0.55, textTransform: 'uppercase', background: 'var(--surface-color)', padding: '2px 6px', borderRadius: '4px' }}>
                                                             {item.type === 'plan_feedback' ? 'Plano' : item.type === 'tv_timer' ? 'TV' : item.type}
                                                         </span>
                                                     </div>
                                                 </div>
                                                 {parsedFeedback ? (
                                                     <div title="Esforço percebido (RPE)" style={{
                                                         width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                                                         display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                         background: `hsl(${Math.max(0, 140 - parsedFeedback.rpe * 14)} 75% 45%)`, color: 'white', lineHeight: 1
                                                     }}>
                                                         <span style={{ fontSize: '1.05rem', fontWeight: 900 }}>{parsedFeedback.rpe}</span>
                                                         <span style={{ fontSize: '0.5rem', fontWeight: 800, opacity: 0.9 }}>RPE /10</span>
                                                     </div>
                                                 ) : (
                                                     (() => {
                                                         const sc = formatScore(item.score);
                                                         return (
                                                             <div style={{ textAlign: 'right', flexShrink: 0, lineHeight: 1.1 }}>
                                                                 <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>{sc.value}</div>
                                                                 <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{sc.label}</div>
                                                             </div>
                                                         );
                                                     })()
                                                 )}
                                             </div>

                                             {parsedFeedback ? (
                                                 <div style={{ fontSize: '0.85rem' }}>
                                                     {parsedFeedback.comment && (
                                                         <div style={{ marginBottom: '0.5rem', fontStyle: 'italic', opacity: 0.8 }}>
                                                             "{parsedFeedback.comment}"
                                                         </div>
                                                     )}
                                                     {parsedFeedback.aiProcessed?.adjustments_for_next && (
                                                         <div style={{ 
                                                             background: '#f8fafc', 
                                                             padding: '0.75rem', 
                                                             borderRadius: '0.75rem', 
                                                             border: '1px solid var(--surface-color)',
                                                             fontSize: '0.8rem'
                                                         }}>
                                                             <div style={{ fontWeight: 800, color: '#4f46e5', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                                                 Ajuste p/ Próximo Treino: {parsedFeedback.aiProcessed.adjustments_for_next.intensity_recommendation}
                                                             </div>
                                                             <div style={{ opacity: 0.7 }}>
                                                                 {parsedFeedback.aiProcessed.adjustments_for_next.intensity_note}
                                                             </div>
                                                         </div>
                                                     )}
                                                 </div>
                                             ) : detail && (
                                                 <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                                                     {detail}
                                                 </div>
                                             )}
                                         </div>
                                         </React.Fragment>
                                     );
                                 })}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'benchmarks' ? (
                    <div className="benchmarks-list">
                        <div className="premium-card" style={{ marginBottom: '2rem', padding: '1.5rem', background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <TrendingUp size={24} color="var(--accent-color)" />
                                <div>
                                    <h3 style={{ margin: 0, color: 'white' }}>As Tuas Cargas Máximas</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Regista aqui os teus 1RMs para a IA ajustar o esforço.</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            {DEFAULT_LIFTS.map(lift => (
                                <div key={lift.id} className="premium-card" style={{ padding: '1.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                        {lift.name}
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            value={benchmarks[lift.id] || ''}
                                            onChange={(e) => updateBenchmark(lift.id, e.target.value)}
                                            placeholder="--"
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                paddingRight: '2.5rem',
                                                borderRadius: '0.75rem',
                                                border: '2px solid var(--surface-color)',
                                                fontSize: '1.25rem',
                                                fontWeight: 900,
                                                textAlign: 'center',
                                                background: '#f8fafc'
                                            }}
                                        />
                                        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, opacity: 0.3 }}>kg</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{ height: '60px', fontSize: '1.1rem' }}
                        >
                            {isSaving ? 'A guardar...' : <><Save size={20} /> Guardar Progresso</>}
                        </button>
                    </div>
                ) : (
                    <div className="wod-prs-list animate-fade">
                        <div className="premium-card" style={{ marginBottom: '2rem', padding: '1.5rem', background: 'linear-gradient(135deg, #4f46e5, #312e81)', color: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Award size={24} color="#fbbf24" />
                                <div>
                                    <h3 style={{ margin: 0, color: 'white' }}>Melhores Resultados WOD</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>O teu "Personal Best" nos WODs de referência.</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            {WOD_BENCHMARKS.map(wod => (
                                <div key={wod.id} className="premium-card" style={{ padding: '1.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                        {wod.name}
                                    </label>
                                    <input
                                        type="text"
                                        value={wodPRs[wod.id] || ''}
                                        onChange={(e) => updateWodPR(wod.id, e.target.value)}
                                        placeholder="00:00 ou Rps"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: '0.75rem',
                                            border: '2px solid var(--surface-color)',
                                            fontSize: '1rem',
                                            fontWeight: 800,
                                            textAlign: 'center',
                                            background: '#f8fafc'
                                        }}
                                    />
                                </div>
                            ))}
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{ height: '60px', fontSize: '1.1rem' }}
                        >
                            {isSaving ? 'A guardar...' : <><Save size={20} /> Guardar Recordes</>}
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .tab-btn {
                    flex: 1;
                    padding: 0.75rem;
                    border: none;
                    background: transparent;
                    color: var(--text-muted);
                    font-weight: 800;
                    display: flex;
                    alignItems: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                    border-radius: 0.8rem;
                    transition: all 0.2s ease;
                }
                .tab-btn.active {
                    background: white;
                    color: var(--primary-color);
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                }
                .history-item {
                    border-left: 4px solid var(--primary-color);
                }
                .range-btn {
                    border: none; background: transparent; color: var(--text-muted);
                    font: inherit; font-size: 0.72rem; font-weight: 800; padding: 0.35rem 0.6rem;
                    border-radius: 0.55rem; cursor: pointer; transition: all 0.2s ease;
                }
                .range-btn.active { background: var(--bg-color); color: var(--primary-color); box-shadow: 0 2px 4px rgb(0 0 0 / 0.08); }
                .scope-chip {
                    border: 1.5px solid var(--surface-color); background: transparent; color: var(--text-muted);
                    font: inherit; font-size: 0.85rem; font-weight: 800; padding: 0.5rem 1rem;
                    border-radius: 999px; cursor: pointer; transition: all 0.2s ease;
                }
                .scope-chip.active { background: var(--text-main); border-color: var(--text-main); color: var(--bg-color); }
            `}</style>
        </div>
    );
}
