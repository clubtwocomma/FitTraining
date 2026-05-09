import React, { useState, useEffect } from 'react'
import { Flame, ChevronRight } from 'lucide-react'
import { apiFetch } from '../lib/api'
import ShareMenu from './ShareMenu'

export default function GirlsWods({ onStartWorkout }) {
    const [girls, setGirls] = useState([])
    const [selectedGirl, setSelectedGirl] = useState(null)
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [visibleCount, setVisibleCount] = useState(12)

    useEffect(() => {
        apiFetch('girls')
            .then(res => res.json())
            .then(data => {
                setGirls(Array.isArray(data) ? data : [])
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [])

    const filteredGirls = girls.filter(g => {
        const term = searchTerm.toLowerCase();
        const inName = g.name.toLowerCase().includes(term);
        const inExercises = g.workout?.some(ex => ex.name.toLowerCase().includes(term));
        return inName || inExercises;
    });
    const visibleGirls = filteredGirls.slice(0, visibleCount)

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
            <div className="loader"></div>
        </div>
    )

    return (
        <div className="girls-view animate-fade">
            {/* Library Hero Header */}
            {!selectedGirl && (
                <header style={{
                    marginBottom: '3rem',
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
                    borderRadius: '2rem',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, color: '#be185d', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                            <Flame size={48} /> The Girls
                        </h1>
                        <p style={{ fontSize: '1.2rem', color: '#9d174d', opacity: 0.8, maxWidth: '600px', margin: '0 auto' }}>
                            Os treinos Benchmark originais que definiram o CrossFit. Curto, Intenso e Memorável.
                        </p>
                    </div>
                    {/* Decorative Background element */}
                    <div style={{ position: 'absolute', bottom: '-50px', right: '-50px', fontSize: '15rem', opacity: 0.05, fontWeight: 900, color: '#db2777' }}>GIRLS</div>
                </header>
            )}

            {!selectedGirl ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="search-box premium-card" style={{ padding: '0.75rem 1.5rem', background: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ opacity: 0.3 }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Encontra o teu desafio (ex: Fran, Cindy)..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                setVisibleCount(12)
                            }}
                            style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '1.2rem', padding: '0.75rem 0' }}
                        />
                    </div>

                    <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {visibleGirls.map(girl => (
                            <div
                                key={girl.id || girl.name}
                                className="premium-card hover-lift"
                                onClick={() => setSelectedGirl(girl)}
                                style={{ padding: '2rem', cursor: 'pointer', background: 'white', position: 'relative' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '0.75rem',
                                        background: '#fdf2f8',
                                        color: '#db2777',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase'
                                    }}>
                                        Benchmark
                                    </div>
                                    <ChevronRight size={18} opacity={0.2} />
                                </div>
                                <h3 style={{ fontSize: '1.8rem', margin: 0 }}>{girl.name}</h3>
                                <p style={{ fontSize: '0.9rem', opacity: 0.5, marginTop: '0.5rem' }}>WOD Clássico</p>
                            </div>
                        ))}
                    </div>

                    {visibleGirls.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '5rem', opacity: 0.3 }}>
                            <Flame size={48} style={{ marginBottom: '1rem' }} />
                            <p>Nenhuma "Girl" encontrada com esse nome.</p>
                        </div>
                    )}

                    {visibleCount < filteredGirls.length && (
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
                    <button onClick={() => setSelectedGirl(null)} className="chip" style={{ marginBottom: '2rem', borderRadius: '1rem' }}>
                        ← Voltar à Lista
                    </button>

                    <div className="premium-card" style={{ padding: '0', overflow: 'hidden', background: 'white' }}>
                        <div style={{
                            padding: '4rem 2rem',
                            background: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
                            textAlign: 'center',
                            color: 'white'
                        }}>
                            <Flame size={48} style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
                            <h2 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 900 }}>{selectedGirl.name}</h2>
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
                                {selectedGirl.stimulus}
                            </div>
                        </div>

                        <div style={{ padding: '3rem' }}>
                            <div className="wod-description" style={{
                                padding: '2rem',
                                background: '#fdf2f8',
                                borderRadius: '1.5rem',
                                color: '#be185d',
                                fontSize: '1.3rem',
                                fontWeight: 700,
                                marginBottom: '2.5rem',
                                textAlign: 'center',
                                border: '1px solid #f9a8d4'
                            }}>
                                {selectedGirl.description}
                            </div>

                            <div className="workout-table-container">
                                <table style={{ background: 'transparent', border: 'none' }}>
                                    <thead>
                                        <tr>
                                            <th>Exercício</th>
                                            <th style={{ textAlign: 'center' }}>Reps / Carga</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedGirl.workout?.map((ex, idx) => (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: 800 }}>{ex.name}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{
                                                        fontSize: '1.2rem',
                                                        fontWeight: 900,
                                                        color: '#db2777'
                                                    }}>{ex.reps}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Additional Rules */}
                            {(selectedGirl.rounds || selectedGirl.amrap) && (
                                <div style={{
                                    marginTop: '2rem',
                                    padding: '1.5rem',
                                    textAlign: 'center',
                                    background: 'var(--surface-color)',
                                    borderRadius: '1.5rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 800,
                                    color: '#db2777'
                                }}>
                                    {selectedGirl.rounds ? `REPETE DURANTE ${selectedGirl.rounds} ROUNDS` : `AMRAP ${selectedGirl.amrap} MINUTOS`}
                                </div>
                            )}

                            <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ flex: 2, minWidth: '200px', background: '#db2777', height: '60px', fontSize: '1.1rem' }} 
                                    onClick={() => onStartWorkout({
                                        globalWodId: selectedGirl.id,
                                        exercises: selectedGirl.workout,
                                        duration: selectedGirl.amrap || 20,
                                        focus: selectedGirl.name,
                                        summary: {
                                            structure: selectedGirl.rounds ? `${selectedGirl.rounds} Rounds` : (selectedGirl.amrap ? `AMRAP ${selectedGirl.amrap}min` : 'For Time'),
                                            type: 'Girl WOD'
                                        }
                                    })}
                                >
                                    Fazer Treino
                                </button>
                                <button className="btn btn-primary" style={{ flex: 1, minWidth: '160px', background: '#9d174d', height: '60px' }} onClick={() => window.print()}>
                                    Exportar PDF
                                </button>
                                <ShareMenu wod={selectedGirl} type="girl" accent="#db2777" variant="light" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
