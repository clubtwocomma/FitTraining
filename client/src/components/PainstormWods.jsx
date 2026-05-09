import React, { useState, useEffect } from 'react'
import { Zap, ChevronRight } from 'lucide-react'
import { apiFetch } from '../lib/api'
import ShareMenu from './ShareMenu'

export default function PainstormWods({ onStartWorkout }) {
    const [wods, setWods] = useState([])
    const [selectedWod, setSelectedWod] = useState(null)
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [visibleCount, setVisibleCount] = useState(12)

    useEffect(() => {
        apiFetch('painstorms')
            .then(res => res.json())
            .then(data => {
                setWods(Array.isArray(data) ? data : [])
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [])

    const filteredWods = wods.filter(w => {
        const term = searchTerm.toLowerCase();
        const inName = w.name.toLowerCase().includes(term);
        const inExercises = w.workout?.some(ex => ex.name.toLowerCase().includes(term));
        return inName || inExercises;
    });
    const visibleWods = filteredWods.slice(0, visibleCount)

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
            <div className="loader"></div>
        </div>
    )

    return (
        <div className="painstorm-view animate-fade">
            {!selectedWod && (
                <header style={{
                    marginBottom: '3rem',
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    borderRadius: '2rem',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, color: '#1e40af', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                            <Zap size={48} /> Painstorms
                        </h1>
                        <p style={{ fontSize: '1.2rem', color: '#1e3a8a', opacity: 0.8, maxWidth: '600px', margin: '0 auto' }}>
                            Sessões brutais de volume elevado e resistência mental. Só para os mais resilientes.
                        </p>
                    </div>
                    <div style={{ position: 'absolute', bottom: '-50px', right: '-50px', fontSize: '15rem', opacity: 0.05, fontWeight: 900, color: '#1d4ed8' }}>PAIN</div>
                </header>
            )}

            {!selectedWod ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="search-box premium-card" style={{ padding: '0.75rem 1.5rem', background: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ opacity: 0.3 }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Encontra a tua Painstorm..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                setVisibleCount(12)
                            }}
                            style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '1.2rem', padding: '0.75rem 0' }}
                        />
                    </div>

                    <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {visibleWods.map(wod => (
                            <div
                                key={wod.id}
                                className="premium-card hover-lift"
                                onClick={() => setSelectedWod(wod)}
                                style={{ padding: '2rem', cursor: 'pointer', background: 'white', position: 'relative' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '0.75rem',
                                        background: '#dbeafe',
                                        color: '#1e40af',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase'
                                    }}>
                                        Painstorm
                                    </div>
                                    <ChevronRight size={18} opacity={0.2} />
                                </div>
                                <h3 style={{ fontSize: '1.8rem', margin: 0 }}>{wod.name}</h3>
                                <p style={{ fontSize: '0.9rem', opacity: 0.5, marginTop: '0.5rem' }}>Trial of Pain</p>
                            </div>
                        ))}
                    </div>

                    {visibleCount < filteredWods.length && (
                        <button
                            className="btn btn-outline"
                            style={{ alignSelf: 'center', marginTop: '1rem', background: 'white' }}
                            onClick={() => setVisibleCount(prev => prev + 12)}
                        >
                            Ver Mais +
                        </button>
                    )}
                </div>
            ) : (
                <div className="hero-details animate-slide-up">
                    <button onClick={() => setSelectedWod(null)} className="chip" style={{ marginBottom: '2rem', borderRadius: '1rem' }}>
                        ← Voltar à Lista
                    </button>

                    <div className="premium-card" style={{ padding: '0', overflow: 'hidden', background: 'white' }}>
                        <div style={{
                            padding: '4rem 2rem',
                            background: 'linear-gradient(135deg, #1e40af 0%, #172554 100%)',
                            textAlign: 'center',
                            color: 'white'
                        }}>
                            <Zap size={48} style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
                            <h2 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 900 }}>{selectedWod.name}</h2>
                            <div style={{
                                display: 'inline-block',
                                marginTop: '1.5rem',
                                padding: '0.5rem 1.5rem',
                                borderRadius: '2rem',
                                background: 'rgba(255,255,255,0.2)',
                                backdropFilter: 'blur(10px)',
                                fontSize: '0.9rem',
                                fontWeight: 700
                            }}>
                                {selectedWod.stimulus}
                            </div>
                        </div>

                        <div style={{ padding: '3rem' }}>
                            <div className="wod-description" style={{
                                padding: '2rem',
                                background: '#eff6ff',
                                borderRadius: '1.5rem',
                                color: '#1e40af',
                                fontSize: '1.3rem',
                                fontWeight: 700,
                                marginBottom: '2.5rem',
                                textAlign: 'center',
                                border: '1px solid #bfdbfe'
                            }}>
                                {selectedWod.description}
                            </div>

                            <div className="workout-table-container">
                                <table style={{ background: 'transparent', border: 'none' }}>
                                    <thead>
                                        <tr>
                                            <th>Exercício / Estágio</th>
                                            <th style={{ textAlign: 'center' }}>Detalhes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedWod.workout?.map((ex, idx) => (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: 800 }}>{ex.name}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{
                                                        fontSize: '1.2rem',
                                                        fontWeight: 900,
                                                        color: '#1e40af'
                                                    }}>{ex.reps}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                             <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ flex: 2, minWidth: '200px', background: '#1e40af', height: '60px', fontSize: '1.1rem' }} 
                                    onClick={() => onStartWorkout({
                                        globalWodId: selectedWod.id,
                                        exercises: selectedWod.workout,
                                        duration: 30, // Default for Painstorms
                                        focus: selectedWod.name,
                                        summary: {
                                            structure: selectedWod.rounds ? `${selectedWod.rounds} Rounds` : 'For Time',
                                            type: 'Painstorm'
                                        }
                                    })}
                                >
                                    Fazer Treino
                                </button>
                                <button className="btn btn-primary" style={{ flex: 1, minWidth: '160px', background: '#172554', height: '60px' }} onClick={() => window.print()}>
                                    Exportar PDF
                                </button>
                                <ShareMenu wod={selectedWod} type="painstorm" accent="#1e40af" variant="light" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
