import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Play, CheckCircle2, Trophy, Clock, Dumbbell, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function CalendarView({ onBack, onStartWorkout, onNewPlan, planId }) {
    const [activePlan, setActivePlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());

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
                } else {
                    setActivePlan(data[0]);
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

            {/* Calendar Widget */}
            <div className="premium-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
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
                                <button className="chip" onClick={() => setSelectedDate(new Date(viewYear, viewMonth - 1, 1))} style={{ padding: '4px' }}>
                                    <ChevronLeft size={16} />
                                </button>
                                <div style={{ fontWeight: 800, color: 'var(--primary-color)' }}>
                                    {currentMonthStr}
                                </div>
                                <button className="chip" onClick={() => setSelectedDate(new Date(viewYear, viewMonth + 1, 1))} style={{ padding: '4px' }}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            <div className="calendar-grid">
                                {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(d => (
                                    <div key={d} className="calendar-day-header">{d}</div>
                                ))}
                                {days.map((dateObj, idx) => {
                                    if (!dateObj) return <div key={idx} />;
                                    
                                    const dateStr = dateObj.toISOString().split('T')[0];
                                    const isSelected = dateObj.getDate() === selectedDate.getDate() && 
                                                     dateObj.getMonth() === selectedDate.getMonth() &&
                                                     dateObj.getFullYear() === selectedDate.getFullYear();
                                    const isToday = dateObj.getDate() === today.getDate() && 
                                                   dateObj.getMonth() === today.getMonth() &&
                                                   dateObj.getFullYear() === today.getFullYear();
                                    
                                    const hasWorkout = activePlan.workouts.some(w => {
                                        if (w.date) return w.date.split('T')[0] === dateStr;
                                        // For plans without explicit dates, we use the 'day' relative to plan start
                                        const planStart = new Date(activePlan.startDate);
                                        const diffTime = Math.abs(dateObj - planStart);
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                        return w.day === diffDays;
                                    });

                                    return (
                                        <div 
                                            key={idx} 
                                            onClick={() => setSelectedDate(dateObj)}
                                            className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''} ${hasWorkout ? 'has-workout' : ''}`}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {dateObj.getDate()}
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )
                })()}
            </div>

            {/* Today's Workouts Detail */}
            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>
                    {selectedDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(() => {
                        const dateStr = selectedDate.toISOString().split('T')[0];
                        const dayWorkouts = activePlan.workouts.filter(w => {
                            if (w.date) return w.date.split('T')[0] === dateStr;
                            const planStart = new Date(activePlan.startDate);
                            const diffTime = Math.abs(selectedDate - planStart);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                            return w.day === diffDays;
                        });

                        if (dayWorkouts.length === 0) {
                            return (
                                <div className="premium-card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                                    <p>Sem treinos agendados para este dia.</p>
                                </div>
                            );
                        }

                        return dayWorkouts.map((workout) => (
                            <div
                                key={workout.id}
                                className={`premium-card ${workout.completed ? 'completed' : ''}`}
                                style={{
                                    padding: '1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'white'
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <span style={{
                                        fontSize: '0.75rem', fontWeight: 800,
                                        textTransform: 'uppercase', color: workout.completed ? '#22c55e' : 'var(--text-muted)'
                                    }}>
                                        {workout.focus}
                                    </span>
                                </div>
                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{workout.content.duration || 60}m • {workout.content.exercises?.length || 0} Exercícios</h4>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {workout.content.exercises?.map(e => e.name).join(', ')}
                                </div>
                            </div>

                            <button
                                className="btn btn-primary"
                                onClick={() => onStartWorkout(workout)}
                                style={{ width: '48px', height: '48px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Play size={20} fill="currentColor" style={{ marginLeft: '4px' }} />
                            </button>
                        </div>
                        ));
                    })()}
                </div>
            </div>

            <style>{`
                .premium-card.completed {
                    background: #f8fafc;
                }
            `}</style>
        </div>
    );
}
