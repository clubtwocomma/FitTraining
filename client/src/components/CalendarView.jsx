import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Play, CheckCircle2, Trophy, Clock, Dumbbell, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { localKey, workoutDayKey, workoutStatus, workoutTotals, isRestDay, parseMinutes, resultRpe, resultFeedback, setLogSummary, isBoxResult, performanceSeries, STATUS, METRIC_COLORS } from '../lib/training';
import { StructureBar, MetricStat, WeekStrip, StatusBadge } from './training/TrainingUI';
import PlanCalendar from './training/PlanCalendar';

export default function CalendarView({ onBack, onStartWorkout, onNewPlan, planId }) {
    const [activePlan, setActivePlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [movingId, setMovingId] = useState(null);
    const [mode, setMode] = useState(() => { try { return localStorage.getItem('ft_plan_view') || 'weeks'; } catch { return 'weeks'; } });
    const [series, setSeries] = useState([]);

    useEffect(() => {
        try { localStorage.setItem('ft_plan_view', mode); } catch { /* sem armazenamento */ }
    }, [mode]);

    // Forma/Frescura por dia para o resumo de cada semana (só os meus treinos).
    useEffect(() => {
        apiFetch('history').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setSeries(performanceSeries(d.filter(h => !isBoxResult(h)), 180));
        }).catch(() => {});
    }, []);

    // Mover um treino planeado para outro dia (no TrainingPeaks é uma função Premium).
    const moveWorkout = async (workout, date) => {
        if (!date) return;
        try {
            const res = await apiFetch(`workouts/${workout.id}/date`, { method: 'PATCH', body: JSON.stringify({ date }) });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao mover');
            setActivePlan(prev => ({ ...prev, workouts: prev.workouts.map(w => w.id === workout.id ? { ...w, date: `${date}T00:00:00.000Z` } : w) }));
            setMovingId(null);
            setSelectedDate(new Date(`${date}T00:00:00`));
        } catch (err) {
            alert(`Não foi possível mover o treino: ${err.message}`);
        }
    };

    useEffect(() => {
        fetchActivePlan();
    }, []);

    const fetchActivePlan = async () => {
        try {
            // If planId is provided, fetch all and filter or add endpoint for single plan.
            // For now, fetching plans/active and finding the one with planId.
            const res = await apiFetch('plans/active');
            const data = await res.json();
            if (Array.isArray(data)) {
                if (planId) {
                    const target = data.find(p => p.id === planId);
                    setActivePlan(target || data[0]);
                    console.log('[Calendar] Active Plan Loaded:', target || data[0]);
                } else {
                    setActivePlan(data[0]);
                    console.log('[Calendar] Active Plan Loaded:', data[0]);
                }
            } else if (!data.error) {
                setActivePlan(data);
            }
        } catch (err) {
            console.error("Error fetching active plan:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAbandon = async () => {
        if (!window.confirm("Tens a certeza que queres desistir deste plano? 😢")) return;
        try {
            const res = await apiFetch(`plans/${activePlan.id}`, { method: 'DELETE' });
            if (res.ok) {
                onBack();
            } else {
                const errData = await res.json();
                throw new Error(errData.error || "Erro desconhecido ao apagar.");
            }
        } catch (err) {
            console.error("Error abandoning plan:", err);
            alert("Falha ao desistir do plano: " + err.message);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!activePlan) {
        return (
            <div className="animate-fade" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <div style={{
                    width: '100px', height: '100px', background: 'var(--primary-glow)',
                    borderRadius: '2rem', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 2rem', color: 'var(--primary-color)'
                }}>
                    <CalendarIcon size={48} />
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>Calendário Vazio</h2>
                <p style={{ opacity: 0.6, maxWidth: '400px', margin: '0 auto 2.5rem' }}>
                    Ainda não tens um plano ativo. Gera um plano personalizado para começares a tua jornada.
                </p>
                <button className="btn btn-primary" onClick={onNewPlan} style={{ width: 'auto', padding: '0 2rem' }}>
                    Gerar Plano Agora
                </button>
            </div>
        );
    }

    return (
        <div className="calendar-view animate-fade">
            <header style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={onBack} className="chip" style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Calendário</h1>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="chip" onClick={onNewPlan} style={{ background: 'var(--surface-color)' }}>
                        Novo Plano
                    </button>
                    <button 
                        onClick={handleAbandon} 
                        style={{ 
                            background: '#ef4444', 
                            color: 'white', 
                            border: 'none', 
                            padding: '0.5rem 1rem', 
                            borderRadius: '0.75rem', 
                            fontSize: '0.8rem', 
                            fontWeight: 800,
                            cursor: 'pointer'
                        }}
                    >
                        Desistir do Plano
                    </button>
                </div>
            </header>

            {/* Coach Insights (Phase 2) */}
            {activePlan.coachingInsights?.coach_insight && (
                <div className="premium-card animate-slide-up" style={{
                    marginBottom: '2rem',
                    padding: '1.5rem',
                    background: 'var(--surface-color)',
                    borderLeft: '4px solid var(--primary-color)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
                        <div style={{ background: 'var(--primary-color)', color: 'white', padding: '6px', borderRadius: '50%', display: 'flex' }}>
                            <Sparkles size={16} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Feedback do Teu Treinador</h3>
                    </div>
                    <p style={{ fontSize: '0.95rem', lineHeight: '1.5', margin: 0, opacity: 0.8, fontStyle: 'italic' }}>
                        "{activePlan.coachingInsights.coach_insight}"
                    </p>
                </div>
            )}

            <div style={{ display: 'flex', background: 'var(--surface-color)', borderRadius: '0.9rem', padding: '4px', marginBottom: '1rem', width: 'fit-content' }}>
                {[{ k: 'weeks', label: 'Semanas' }, { k: 'month', label: 'Mês' }].map(o => (
                    <button key={o.k} onClick={() => setMode(o.k)} aria-pressed={mode === o.k} style={{
                        border: 'none', borderRadius: '0.7rem', padding: '0.45rem 1.1rem', cursor: 'pointer', font: 'inherit', fontWeight: 800, fontSize: '0.85rem',
                        background: mode === o.k ? 'var(--bg-color)' : 'transparent', color: mode === o.k ? 'var(--primary-color)' : 'var(--text-muted)',
                        boxShadow: mode === o.k ? '0 2px 6px rgb(0 0 0 / 0.08)' : 'none'
                    }}>{o.label}</button>
                ))}
            </div>

            {mode === 'weeks' ? (
                <PlanCalendar
                    plan={activePlan}
                    series={series}
                    onOpen={(w) => onStartWorkout(w)}
                    onMove={(w, key) => moveWorkout(w, key)}
                />
            ) : (<>
            {/* Resumo da semana (coluna "Summary" do TrainingPeaks) */}
            {(() => {
                const monday = new Date(selectedDate);
                monday.setHours(0, 0, 0, 0);
                monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
                const weekKeys = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(monday);
                    d.setDate(monday.getDate() + i);
                    return { d, key: localKey(d) };
                });
                const weekWorkouts = activePlan.workouts.filter(w => !isRestDay(w) && weekKeys.some(k => k.key === workoutDayKey(w, activePlan)));
                const done = weekWorkouts.filter(w => workoutStatus(w, activePlan) === 'done');
                const due = weekWorkouts.filter(w => ['done', 'missed'].includes(workoutStatus(w, activePlan)));
                const plannedMin = weekWorkouts.reduce((s, w) => s + (parseMinutes(w.content?.duration) || 0), 0);
                const doneMin = done.reduce((s, w) => s + (parseMinutes(w.content?.duration) || 0), 0);
                const compliance = due.length ? Math.round(done.length / due.length * 100) : null;
                const days = weekKeys.map(({ d, key }) => {
                    const w = activePlan.workouts.find(x => workoutDayKey(x, activePlan) === key);
                    return {
                        key, d, num: d.getDate(), isToday: key === localKey(new Date()),
                        label: d.toLocaleDateString('pt-PT', { weekday: 'short' }).slice(0, 3),
                        status: w ? workoutStatus(w, activePlan) : null
                    };
                });
                return (
                    <div className="premium-card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                                Semana de {monday.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                            </h3>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="chip" aria-label="Semana anterior" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 7))} style={{ padding: '4px' }}><ChevronLeft size={16} /></button>
                                <button className="chip" aria-label="Semana seguinte" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 7))} style={{ padding: '4px' }}><ChevronRight size={16} /></button>
                            </div>
                        </div>
                        <WeekStrip days={days} selectedKey={localKey(selectedDate)} onSelect={(d) => setSelectedDate(d.d)} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--surface-color)' }}>
                            <MetricStat label="Treinos" value={`${done.length}/${weekWorkouts.length}`} />
                            <MetricStat label="Minutos" value={doneMin} unit={`/ ${plannedMin}`} />
                            <MetricStat label="Cumprimento" value={compliance} unit="%" color={compliance == null ? undefined : compliance >= 80 ? STATUS.done.color : compliance >= 50 ? '#d97706' : STATUS.missed.color} />
                        </div>
                    </div>
                );
            })()}

            {/* Calendário do mês */}
            <div className="premium-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                {(() => {
                    const today = new Date();
                    const viewYear = selectedDate.getFullYear();
                    const viewMonth = selectedDate.getMonth();
                    const currentMonthStr = selectedDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }).toUpperCase();

                    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
                    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
                    const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

                    const days = [];
                    for (let i = 0; i < startDay; i++) days.push(null);
                    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(viewYear, viewMonth, i));

                    return (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <button className="chip" aria-label="Mês anterior" onClick={() => setSelectedDate(new Date(viewYear, viewMonth - 1, 1))} style={{ padding: '4px' }}>
                                    <ChevronLeft size={16} />
                                </button>
                                <div style={{ fontWeight: 800, color: 'var(--primary-color)' }}>
                                    {currentMonthStr}
                                </div>
                                <button className="chip" aria-label="Mês seguinte" onClick={() => setSelectedDate(new Date(viewYear, viewMonth + 1, 1))} style={{ padding: '4px' }}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            <div className="calendar-grid" style={{ marginBottom: '0.75rem' }}>
                                {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
                                    <div key={i} className="calendar-day-header">{d}</div>
                                ))}
                                {days.map((dateObj, idx) => {
                                    if (!dateObj) return <div key={idx} />;

                                    const key = localKey(dateObj);
                                    const isSelected = key === localKey(selectedDate);
                                    const isToday = key === localKey(today);
                                    const dayWorkout = activePlan.workouts.find(w => workoutDayKey(w, activePlan) === key);
                                    const status = dayWorkout ? workoutStatus(dayWorkout, activePlan) : null;

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedDate(dateObj)}
                                            className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''} ${status && status !== 'rest' ? 'has-workout' : ''}`}
                                            style={{ cursor: 'pointer', '--dot': status ? STATUS[status].color : undefined }}
                                        >
                                            {dateObj.getDate()}
                                        </div>
                                    )
                                })}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                {['done', 'missed', 'planned'].map(k => (
                                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: STATUS[k].color }} /> {STATUS[k].label}
                                    </span>
                                ))}
                            </div>
                        </>
                    )
                })()}
            </div>

            {/* Treinos do dia selecionado */}
            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', textTransform: 'capitalize' }}>
                    {selectedDate.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(() => {
                        const key = localKey(selectedDate);
                        const dayWorkouts = activePlan.workouts.filter(w => workoutDayKey(w, activePlan) === key);

                        if (dayWorkouts.length === 0) {
                            return (
                                <div className="premium-card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                                    <p>Sem treinos agendados para este dia.</p>
                                </div>
                            );
                        }

                        return dayWorkouts.map((workout) => {
                            const status = workoutStatus(workout, activePlan);
                            const st = STATUS[status];
                            const totals = workoutTotals(workout.content);
                            const rpe = workout.results?.map(resultRpe).find(v => v != null);
                            const fb = workout.results?.map(resultFeedback).find(Boolean);
                            const logged = fb?.sets ? setLogSummary(fb.sets) : null;

                            if (status === 'rest') {
                                return (
                                    <div key={workout.id} className="premium-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: 0.75 }}>
                                        <div style={{ fontSize: '1.4rem' }}>🧘</div>
                                        <div>
                                            <div style={{ fontWeight: 800 }}>{workout.focus}</div>
                                            {workout.content?.rest_justification && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{workout.content.rest_justification}</div>}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={workout.id}
                                    className="premium-card workout-day-card"
                                    onClick={() => onStartWorkout(workout)}
                                    style={{ padding: '1.25rem', borderLeft: `5px solid ${st.color}`, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <StatusBadge status={status} />
                                            <h4 style={{ margin: '0.5rem 0 0', fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.01em' }}>{workout.focus}</h4>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            aria-label="Abrir treino"
                                            onClick={(e) => { e.stopPropagation(); onStartWorkout(workout); }}
                                            style={{ width: '44px', height: '44px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: status === 'done' ? STATUS.done.color : undefined }}
                                        >
                                            {status === 'done' ? <CheckCircle2 size={20} /> : <Play size={18} fill="currentColor" style={{ marginLeft: '3px' }} />}
                                        </button>
                                    </div>

                                    <StructureBar data={workout.content} height={34} />

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '0.9rem' }}>
                                        <MetricStat label="Duração" value={fb?.durationMin ?? totals.minutes} unit="min" />
                                        <MetricStat label="Exerc." value={totals.exercises} />
                                        <MetricStat label="Séries" value={logged ? `${logged.done}/${logged.planned}` : totals.sets} color={logged ? (logged.compliance >= 80 ? STATUS.done.color : '#d97706') : undefined} />
                                        <MetricStat label="RPE" value={rpe} unit="/10" color={rpe ? METRIC_COLORS.atl : undefined} />
                                    </div>

                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {workout.content?.exercises?.map(e => e.name).join(' · ')}
                                    </div>

                                    {status !== 'done' && (
                                        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {movingId === workout.id ? (
                                                <>
                                                    <input
                                                        type="date"
                                                        aria-label="Nova data do treino"
                                                        defaultValue={workoutDayKey(workout, activePlan)}
                                                        onChange={(e) => moveWorkout(workout, e.target.value)}
                                                        style={{ padding: '0.45rem 0.6rem', borderRadius: '0.6rem', border: '2px solid var(--primary-color)', background: 'var(--surface-color)', color: 'var(--text-main)', fontWeight: 700 }}
                                                    />
                                                    <button className="chip" onClick={() => setMovingId(null)} style={{ fontSize: '0.75rem' }}>Cancelar</button>
                                                </>
                                            ) : (
                                                <button className="chip" onClick={() => setMovingId(workout.id)} style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <CalendarIcon size={14} /> Mover para outro dia
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            </>)}

            <style>{`
                .workout-day-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .workout-day-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-premium); }
                .workout-day-card:active { transform: scale(0.99); }
            `}</style>
        </div>
    );
}
