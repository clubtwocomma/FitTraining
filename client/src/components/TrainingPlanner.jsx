import { useState, useEffect } from 'react'
import { Calendar, ClipboardList, Target, ChevronLeft, ChevronRight, Sparkles, Download, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '../lib/api'

const QUESTIONS = [
    {
        id: 'goal',
        text: 'Qual é o teu objetivo principal?',
        options: [
            { id: 'f_loss', text: 'Perda de Gordura' },
            { id: 'm_gain', text: 'Hipertrofia Muscular' },
            { id: 'strength', text: 'Força Pura' },
            { id: 'endur', text: 'Resistência/Cardio' },
            { id: 'well', text: 'Manutenção / Bem-estar' }
        ]
    },
    {
        id: 'level',
        text: 'Qual é o teu nível de experiência?',
        options: [
            { id: 'iniciante', text: 'Iniciante (< 6 meses)' },
            { id: 'intermedio', text: 'Intermédio (6 meses - 2 anos)' },
            { id: 'avancado', text: 'Avançado (2 - 5 anos)' },
            { id: 'profissional', text: 'Profissional / Elite' }
        ]
    },
    {
        id: 'type',
        text: 'Tipo de Treino Preferido?',
        options: [
            { id: 'força', text: 'Força Clássica' },
            { id: 'crossfit', text: 'CrossFit' },
            { id: 'calistenia', text: 'Calistenia' },
            { id: 'hyrox', text: 'Hyrox' },
            { id: 'built', text: 'Built (Pernas)' },
            { id: 'both', text: 'Mistura' }
        ]
    },
    {
        id: 'exigency',
        text: 'Nível de Exigência / Intensidade?',
        options: [
            { id: 'normal', text: 'Normal (Rotina)' },
            { id: 'alta', text: 'Alta (Foco total)' },
            { id: 'extrema', text: 'Extrema (Elite/Bi-diário)' }
        ]
    },
    {
        id: 'freq',
        text: 'Quantas vezes queres treinar por semana?',
        options: [
            { id: '2', text: '2 vezes' },
            { id: '3', text: '3 vezes' },
            { id: '4', text: '4 vezes' },
            { id: '5', text: '5 vezes' },
            { id: '6', text: '6 vezes' }
        ]
    },
    {
        id: 'session_duration',
        text: 'Quanto tempo tens disponível por treino?',
        type: 'number',
        placeholder: 'Ex: 45',
        subtitle: 'Insere o valor exato em minutos. Menos de 45 min irá otimizar o treino removendo o arrefecimento.'
    },
    {
        id: 'period',
        text: 'Duração do plano?',
        options: [
            { id: 'week', text: 'Semanal (7 dias - Recomendado para Precisão)' }
        ]
    },
    {
        id: 'energy',
        text: 'Como te sentes hoje?',
        subtitle: 'O Treinador usa isto para ajustar a intensidade desta semana.',
        options: [
            { id: 'fresco', text: '🔋 Fresco — Pronto para tudo' },
            { id: 'normal', text: '😊 Normal — Bem disposto' },
            { id: 'cansado', text: '😴 Cansado — Noite difícil' },
            { id: 'muito cansado', text: '🪫 Muito Cansado — Preciso de recuperar' }
        ]
    },
    {
        id: 'sleep_hours',
        text: 'Quantas horas dormiste?',
        options: [
            { id: '8', text: '8+ horas 💪' },
            { id: '7', text: '7 horas 👍' },
            { id: '6', text: '6 horas 😐' },
            { id: '5', text: 'Menos de 5 horas 😓' }
        ]
    },
    {
        id: 'stress',
        text: 'Nível de stress hoje?',
        options: [
            { id: 'baixo', text: '🟢 Baixo — Tranquilo' },
            { id: 'normal', text: '🟡 Normal' },
            { id: 'alto', text: '🟠 Alto — Dia pesado' },
            { id: 'muito alto', text: '🔴 Muito Alto — Sobrecarregado' }
        ]
    },
    {
        id: 'limitations',
        text: 'Tens alguma limitação ou lesão? (Opcional)',
        type: 'textarea',
        placeholder: 'Ex: Dores no joelho esquerdo, pouco mobilidade nos ombros, sem impacto...'
    },
    {
        id: 'motive',
        text: 'Motivo / Prova Específica? (Opcional)',
        type: 'textarea',
        placeholder: 'Ex: Preparação para prova Hyrox, competições de CrossFit, maratona...'
    }
]

export default function TrainingPlanner({ onBack, profile }) {
    const [step, setStep] = useState(0)
    const [answers, setAnswers] = useState({})
    const [plan, setPlan] = useState(null)
    const [selectedSession, setSelectedSession] = useState(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [completedDays, setCompletedDays] = useState(new Set())

    // Scroll to top when loading overlay appears (fixes mobile off-screen issue)
    useEffect(() => {
        if (isGenerating) {
            window.scrollTo({ top: 0, behavior: 'instant' })
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [isGenerating])

    const handleNext = (val) => {
        const newAnswers = { ...answers, [QUESTIONS[step].id]: val }
        setAnswers(newAnswers)
        if (step < QUESTIONS.length - 1) {
            setStep(step + 1)
        } else {
            generatePlan(newAnswers)
        }
    }

    const handlePrevious = () => {
        if (step > 0) setStep(step - 1)
    }

    const resetPlanner = () => {
        setPlan(null)
        setStep(0)
        setAnswers({})
        setSaveSuccess(false)
    }

    const savePlan = async () => {
        if (!plan || !plan.sessions || plan.sessions.length === 0) {
            alert("O plano parece estar vazio. Tenta gerar novamente.");
            return;
        }

        setIsSaving(true)
        try {
            const res = await apiFetch('plans', {
                method: 'POST',
                body: JSON.stringify({
                    title: plan.title,
                    goal: plan.goal || answers.goal,
                    sessions: plan.sessions,
                    startDate: new Date().toISOString(),
                    coachingDecision: plan.coachingDecision
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const msg = typeof errorData.error === 'string' ? errorData.error : 'Erro ao guardar plano';
                throw new Error(msg);
            }

            setSaveSuccess(true);
            setTimeout(() => onBack(), 2000);
        } catch (err) {
            console.error('Erro ao salvar plano:', err);
            // Se for um erro do Zod (string JSON), tenta limpar
            let userMsg = err.message;
            if (userMsg.includes('[{"')) {
                userMsg = "Dados do plano inválidos. Por favor, gera o plano novamente.";
            }
            alert(`Não foi possível guardar o plano: ${userMsg}`);
        } finally {
            setIsSaving(false)
        }
    }

    const generatePlan = async (data) => {
        setIsGenerating(true)
        try {
            const res = await apiFetch('generate-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, profile })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro do servidor (${res.status})`);
            }
            const generatedPlan = await res.json();
            setPlan(generatedPlan);
        } catch (err) {
            console.error('Erro ao gerar plano multi-dia:', err);
            alert(`Erro ao ligar ao servidor de I.A: ${err.message}`);
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="planner-view animate-fade">
            {/* AI Loading Overlay */}
            {isGenerating && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 99999, gap: '1.5rem', padding: '2rem', color: 'white'
                }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-color)',
                        animation: 'spin 1s linear infinite', flexShrink: 0
                    }} />
                    <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                        <h2 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.6rem)', fontWeight: 800, marginBottom: '0.75rem' }}>🤖 Arquitetando a tua Evolução</h2>
                        <p style={{ opacity: 0.75, fontSize: 'clamp(0.85rem, 3vw, 1rem)', lineHeight: 1.5 }}>
                            A IA está a desenhar o teu plano personalizado. Aguarda...
                        </p>
                    </div>
                </div>
            )}

            <button onClick={() => !plan && step > 0 ? handlePrevious() : onBack()} className="chip" style={{ marginBottom: '1.5rem' }}>
                <ChevronLeft size={16} /> {(!plan && step > 0) ? 'Pergunta Anterior' : 'Voltar'}
            </button>

            {!plan ? (
                <div className="survey-container">
                    {/* Survey Header */}
                    <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
                        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', fontWeight: 800 }}>Plano de Elite</h1>
                        <p style={{ fontSize: '0.95rem', opacity: 0.7 }}>Personalização baseada em objetivos e limitações.</p>
                    </header>

                    <div className="premium-card animate-slide-up" style={{ maxWidth: '600px', margin: '0 auto', background: 'white', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '2rem' }}>
                            {QUESTIONS.map((_, i) => (
                                <div key={i} style={{
                                    height: '4px',
                                    flex: 1,
                                    borderRadius: '2px',
                                    background: i <= step ? 'var(--primary-color)' : 'var(--surface-color)',
                                    transition: 'all 0.4s ease'
                                }}></div>
                            ))}
                        </div>

                        <h2 style={{ fontSize: '1.4rem', marginBottom: QUESTIONS[step].subtitle ? '0.5rem' : '2rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>{QUESTIONS[step].text}</h2>
                        {QUESTIONS[step].subtitle && (
                            <p style={{ textAlign: 'center', opacity: 0.6, fontSize: '0.9rem', marginBottom: '1.5rem', fontStyle: 'normal' }}>
                                {QUESTIONS[step].subtitle}
                            </p>
                        )}

                        {QUESTIONS[step].type === 'textarea' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <textarea
                                    className="input-textarea"
                                    placeholder={QUESTIONS[step].placeholder}
                                    rows="4"
                                    style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: '0.75rem' }}
                                    onChange={(e) => setAnswers({ ...answers, [QUESTIONS[step].id]: e.target.value })}
                                    value={answers[QUESTIONS[step].id] || ''}
                                />
                                <button className="btn btn-primary" style={{ padding: '1rem', fontSize: '1rem', fontWeight: 600 }} onClick={() => handleNext(answers[QUESTIONS[step].id] || 'Nenhuma')}>
                                    {step === QUESTIONS.length - 1 ? (
                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Concluir e Gerar Plano <Sparkles size={18} /></span>
                                    ) : (
                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Avançar <ChevronRight size={18} /></span>
                                    )}
                                </button>
                            </div>
                        ) : QUESTIONS[step].type === 'number' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <input
                                    type="number"
                                    className="input-textarea"
                                    placeholder={QUESTIONS[step].placeholder}
                                    style={{ width: '100%', padding: '1.25rem', fontSize: '1.25rem', textAlign: 'center', borderRadius: '0.75rem', border: '2px solid var(--surface-color)', transition: 'border-color 0.2s ease' }}
                                    onChange={(e) => setAnswers({ ...answers, [QUESTIONS[step].id]: e.target.value })}
                                    value={answers[QUESTIONS[step].id] || ''}
                                    autoFocus
                                />
                                <button 
                                    className="btn btn-primary" 
                                    style={{ padding: '1rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
                                    onClick={() => handleNext(answers[QUESTIONS[step].id] || '60')}
                                    disabled={!answers[QUESTIONS[step].id]}
                                >
                                    Avançar <ChevronRight size={18} />
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                                {QUESTIONS[step].options.map(opt => (
                                    <button
                                        key={opt.id}
                                        className="btn btn-outline"
                                        style={{ height: 'auto', padding: '1rem 1.25rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem', borderRadius: '0.75rem' }}
                                        onClick={() => handleNext(opt.id)}
                                    >
                                        <span style={{ fontWeight: 600 }}>{opt.text}</span>
                                        <ChevronRight size={18} opacity={0.3} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="plan-results animate-fade" id="printable-plan">
                    {/* Plan Hero Header */}
                    <div className="premium-card no-print" style={{
                        marginBottom: '3rem',
                        padding: '3rem',
                        background: 'linear-gradient(rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95)), url("https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop")',
                        backgroundSize: 'cover',
                        color: 'white'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                            <div>
                                <h1 style={{ color: 'white', fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: '0.5rem' }}>{plan.title}</h1>
                                <p style={{ fontSize: '1.1rem', opacity: 0.8, marginBottom: '1rem' }}>O teu caminho para a performance começa aqui.</p>
                                {plan.limitationsConsidered && (
                                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
                                        <p style={{ margin: 0, fontSize: '0.95rem' }}><strong>Revisão de Saúde:</strong> {plan.limitationsConsidered}</p>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn" onClick={resetPlanner} style={{ width: 'auto', padding: '0 1.5rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                                    Reiniciar
                                </button>
                                <button className="btn" onClick={() => window.print()} style={{ width: 'auto', padding: '0 1.5rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                                    <Download size={20} /> PDF
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={savePlan}
                                    disabled={isSaving || saveSuccess}
                                    style={{ width: 'auto', padding: '0 2rem', background: saveSuccess ? '#22c55e' : 'var(--primary-color)' }}
                                >
                                    {isSaving ? 'A guardar...' : saveSuccess ? <><CheckCircle2 size={20} /> Guardado!</> : 'Guardar no Calendário'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Coach Insights (Phase 2) */}
                    {plan.coachingDecision?.coach_insight && (
                        <div className="premium-card animate-slide-up no-print" style={{
                            marginBottom: '3rem',
                            padding: '2rem',
                            background: 'var(--surface-color)',
                            borderLeft: '4px solid var(--primary-color)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                <div style={{ background: 'var(--primary-color)', color: 'white', padding: '8px', borderRadius: '50%' }}>
                                    <Sparkles size={20} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Feedback do Teu Treinador</h3>
                            </div>
                            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', margin: 0, opacity: 0.9, fontStyle: 'italic' }}>
                                "{plan.coachingDecision.coach_insight}"
                            </p>
                        </div>
                    )}

                    {selectedSession ? (
                        <div className="session-details animate-slide-up no-print">
                            <button onClick={() => setSelectedSession(null)} className="chip" style={{ marginBottom: '2rem' }}>
                                ← Voltar ao Calendário
                            </button>

                            <div className="premium-card" style={{ padding: '3rem', background: 'white' }}>
                                <header style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--surface-color)', paddingBottom: '2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div>
                                            <div style={{ color: 'var(--primary-color)', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Dia {selectedSession.day}</div>
                                            <h2 style={{ fontSize: '2.5rem', margin: 0 }}>{selectedSession.focus}</h2>
                                            <p style={{ fontSize: '1.1rem', opacity: 0.6, marginTop: '0.5rem' }}>Duração Estimada: {selectedSession.duration}</p>
                                        </div>
                                        {selectedSession.exercises?.length > 0 && (
                                            <div style={{ opacity: 0.5, fontSize: '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
                                                Guarda o plano para iniciar o acompanhamento.
                                            </div>
                                        )}
                                    </div>
                                </header>

                                {selectedSession.exercises && selectedSession.exercises.length > 0 ? (
                                    <div className="workout-phases-container">
                                        {['warmup', 'main', 'cooldown'].map(phase => {
                                            const phaseExercises = selectedSession.exercises.filter(ex => (ex.phase || 'main') === phase);
                                            
                                            const dayWarmupDesc = phase === 'warmup' ? selectedSession.warmup?.description : null;
                                            const dayCooldownDesc = phase === 'cooldown' ? selectedSession.cooldown?.description : null;
                                            const phaseDescription = dayWarmupDesc || dayCooldownDesc;

                                            if (phaseExercises.length === 0 && !phaseDescription) return null;

                                            const phaseTitle = phase === 'warmup' ? '🔥 Aquecimento Específico' : 
                                                             phase === 'cooldown' ? '🧊 Retorno à Calma' : 
                                                             '🏋️ Parte Principal';

                                            return (
                                                <div key={phase} style={{ marginBottom: '2rem' }}>
                                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: phase === 'main' ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                                                        {phaseTitle}
                                                    </h4>

                                                    {phaseDescription && (
                                                        <div style={{ padding: '1rem', background: phase === 'warmup' ? 'rgba(249, 115, 22, 0.05)' : 'rgba(59, 130, 246, 0.05)', borderLeft: `3px solid ${phase === 'warmup' ? '#f97316' : '#3b82f6'}`, borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                                            {phaseDescription}
                                                        </div>
                                                    )}

                                                    {phaseExercises.length > 0 && (
                                                        <div className="workout-table-container">
                                                        <table>
                                                            <thead>
                                                                <tr>
                                                                    <th>Exercício</th>
                                                                    <th style={{ textAlign: 'center' }}>Séries/Reps</th>
                                                                    <th style={{ textAlign: 'center' }}>Carga/RM</th>
                                                                    <th style={{ textAlign: 'center' }}>Descanso</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {phaseExercises.map((ex, i) => (
                                                                    <tr key={i}>
                                                                        <td style={{ padding: '1rem 0' }}>
                                                                            <div style={{ fontWeight: 800 }}>{ex.name}</div>
                                                                            {ex.adaptation && (
                                                                                <div style={{ 
                                                                                    fontSize: '0.75rem', 
                                                                                    color: 'var(--accent-color)', 
                                                                                    background: '#fff7ed', 
                                                                                    padding: '2px 6px', 
                                                                                    borderRadius: '4px', 
                                                                                    marginTop: '4px',
                                                                                    display: 'inline-block',
                                                                                    border: '1px solid #ffedd5'
                                                                                }}>
                                                                                    💡 {ex.adaptation}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ textAlign: 'center', fontSize: '1.1rem' }}>
                                                                            {ex.sets} <span style={{ opacity: 0.3 }}>×</span> <strong>{ex.reps}</strong>
                                                                        </td>
                                                                        <td style={{ textAlign: 'center' }}>
                                                                            <div className="chip ai-badge" style={{ margin: '0 auto' }}>{ex.rm_percent || ex.weight_h || 'P. Corpo'}</div>
                                                                        </td>
                                                                        <td style={{ textAlign: 'center', opacity: 0.7 }}>{ex.rest}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="premium-card" style={{ background: '#f8fafc', border: 'none', padding: '2rem' }}>
                                        <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>🧘 Descanso Ativo</h3>
                                        <p style={{ fontSize: '1.1rem', lineHeight: '1.8', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                            "{selectedSession.rest_justification || 'Foco na recuperação e mobilidade hoje.'}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="plan-grid-v2 no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {plan.sessions.map((s, i) => (
                                <div
                                    key={i}
                                    className="premium-card hover-lift"
                                    style={{ padding: '2rem', cursor: 'pointer', background: 'white' }}
                                    onClick={() => setSelectedSession(s)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                        <span style={{ fontWeight: 800, color: 'var(--primary-color)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Dia {s.day}</span>
                                        <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{s.rest_justification ? 'Rest' : s.duration}</span>
                                    </div>
                                    <h3 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>{s.focus}</h3>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <div className="chip" style={{ fontSize: '0.75rem' }}>Ver Detalhes →</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* PRINT LAYOUT (Legacy but clean) */}
                    <div className="print-only-details" style={{ display: 'none' }}>
                        <h1 style={{ fontSize: '2rem', borderBottom: '4px solid black', paddingBottom: '1rem', marginBottom: '2rem' }}>{plan.title}</h1>
                        {plan.sessions.map((s, idx) => (
                            <div key={`print-${idx}`} style={{ marginBottom: '3rem', pageBreakInside: 'avoid' }}>
                                <h2 style={{ background: '#f0f0f0', padding: '1rem', fontSize: '1.2rem' }}>DIA {s.day} : {s.focus} ({s.duration})</h2>
                                {s.exercises && s.exercises.length > 0 ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid black' }}>
                                                <th style={{ textAlign: 'left', padding: '10px' }}>Exercício</th>
                                                <th style={{ textAlign: 'center', padding: '10px' }}>Set/Reps</th>
                                                <th style={{ textAlign: 'center', padding: '10px' }}>Carga/RM</th>
                                                <th style={{ textAlign: 'center', padding: '10px' }}>Desc.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {s.exercises.map((ex, exIdx) => (
                                                <tr key={exIdx} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{ex.name}</td>
                                                    <td style={{ textAlign: 'center', padding: '10px' }}>{ex.sets}x{ex.reps}</td>
                                                    <td style={{ textAlign: 'center', padding: '10px' }}>{ex.rm_percent || '-'}</td>
                                                    <td style={{ textAlign: 'center', padding: '10px' }}>{ex.rest}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p style={{ padding: '1rem', borderLeft: '4px solid #ccc', fontStyle: 'italic' }}>Status: Descanso ({s.rest_justification})</p>
                                )}
                            </div>
                        ))}
                    </div>

                    <style>{`
                        @media print {
                            .no-print { display: none !important; }
                            .print-only-details { display: block !important; }
                            body { background: white !important; }
                        }
                    `}</style>
                </div>
            )}

        </div>
    )
}
