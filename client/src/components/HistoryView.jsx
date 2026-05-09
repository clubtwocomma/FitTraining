import React, { useState, useEffect } from 'react';
import { ChevronLeft, History, Trophy, TrendingUp, Calendar, Clock, Dumbbell, Save, Plus, Flame, Medal, Award } from 'lucide-react';
import { apiFetch } from '../lib/api';

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

export default function HistoryView({ onBack }) {
    const [activeTab, setActiveTab] = useState('history'); // 'history', 'benchmarks', or 'wods'
    const [history, setHistory] = useState([]);
    const [benchmarks, setBenchmarks] = useState({});
    const [wodPRs, setWodPRs] = useState({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

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
                        {history.length > 0 && (
                            <div className="premium-card" style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(3, 1fr)', 
                                gap: '10px', 
                                padding: '1.25rem', 
                                marginBottom: '2rem',
                                background: 'linear-gradient(135deg, var(--primary-color), #4f46e5)',
                                color: 'white',
                                textAlign: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{history.length}</div>
                                </div>
                                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 700 }}>Mês</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>
                                        {history.filter(h => new Date(h.createdAt).getMonth() === new Date().getMonth()).length}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 700 }}>Recordes</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>
                                        {Object.keys(wodPRs).length + Object.keys(benchmarks).length}
                                    </div>
                                </div>
                            </div>
                        )}

                        {history.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.5 }}>
                                <Calendar size={48} style={{ marginBottom: '1rem' }} />
                                <p>Ainda não tens treinos registados.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {history.map(item => {
                                     let parsedFeedback = null;
                                     if (item.type === 'plan_feedback') {
                                         try {
                                             parsedFeedback = JSON.parse(item.notes);
                                         } catch (e) {}
                                     }

                                     return (
                                         <div key={item.id} className="premium-card history-item" style={{ 
                                             padding: '1.25rem', 
                                             marginBottom: '0.5rem',
                                             borderLeft: `4px solid ${parsedFeedback ? '#4f46e5' : 'var(--primary-color)'}`
                                         }}>
                                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: parsedFeedback ? '0.75rem' : '0' }}>
                                                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                     <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)', opacity: 0.6, whiteSpace: 'nowrap' }}>
                                                         {new Date(item.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                                                     </span>
                                                     <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800, fontSize: '0.95rem' }}>
                                                         {item.boxWod?.title || item.globalWod?.name || item.scheduledWorkout?.focus || 'Treino'}
                                                     </div>
                                                 </div>
                                                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                                     <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--primary-color)' }}>
                                                         {parsedFeedback ? `RPE ${parsedFeedback.rpe}` : item.score}
                                                     </span>
                                                     <span style={{ 
                                                         fontSize: '0.6rem', 
                                                         fontWeight: 800, 
                                                         opacity: 0.5, 
                                                         textTransform: 'uppercase', 
                                                         background: 'var(--surface-color)', 
                                                         padding: '2px 6px', 
                                                         borderRadius: '4px' 
                                                     }}>
                                                         {item.type === 'plan_feedback' ? 'TREINADOR' : item.type}
                                                     </span>
                                                 </div>
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
                                             ) : item.notes && (
                                                 <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                                                     {item.notes}
                                                 </div>
                                             )}
                                         </div>
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
            `}</style>
        </div>
    );
}
