import React, { useState, useEffect } from 'react'
import { Medal, ChevronRight, Award } from 'lucide-react'
import { apiFetch } from '../lib/api'
import ShareMenu from './ShareMenu'

export default function HeroWods() {
    const [heroes, setHeroes] = useState([])
    const [selectedHero, setSelectedHero] = useState(null)
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [visibleCount, setVisibleCount] = useState(12)

    useEffect(() => {
        apiFetch('heroes')
            .then(res => res.json())
            .then(data => {
                setHeroes(Array.isArray(data) ? data : [])
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [])

    const filteredHeroes = heroes.filter(h => {
        const term = searchTerm.toLowerCase();
        const inName = h.name.toLowerCase().includes(term);
        const inHonor = (h.hero || h.honor || '').toLowerCase().includes(term);
        const inExercises = h.workout?.some(ex => ex.name.toLowerCase().includes(term));
        return inName || inHonor || inExercises;
    });
    const visibleHeroes = filteredHeroes.slice(0, visibleCount)

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
            <div className="loader"></div>
        </div>
    )

    return (
        <div className="hero-wods-view animate-fade">
            {/* Library Hero Header - Consistent with Girls/Pain */}
            {!selectedHero && (
                <header style={{
                    marginBottom: '3rem',
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    borderRadius: '2rem',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid #bfdbfe'
                }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, color: '#1e40af', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', letterSpacing: '-0.02em' }}>
                            <Medal size={48} color="#2563eb" /> Hero WODs
                        </h1>
                        <p style={{ fontSize: '1.2rem', color: '#1e3a8a', opacity: 0.8, maxWidth: '600px', margin: '0 auto', fontStyle: 'italic' }}>
                            "Honoring those who gave everything. Tested by the elite."
                        </p>
                    </div>
                    {/* Decorative Background element */}
                    <div style={{ position: 'absolute', bottom: '-50px', right: '-50px', fontSize: '15rem', opacity: 0.05, fontWeight: 900, color: '#1e40af' }}>HERO</div>
                </header>
            )}

            {!selectedHero ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="search-box premium-card" style={{ padding: '0.75rem 1.5rem', background: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ opacity: 0.3 }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Pesquisar WOD ou Herói..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                setVisibleCount(12)
                            }}
                            style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '1.2rem', padding: '0.75rem 0' }}
                        />
                    </div>

                    <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {visibleHeroes.map(hero => (
                            <div
                                key={hero.id || hero.name}
                                className="premium-card hover-lift"
                                onClick={() => setSelectedHero(hero)}
                                style={{
                                    padding: '2rem',
                                    cursor: 'pointer',
                                    background: 'white',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '0.75rem',
                                        background: '#eff6ff',
                                        color: '#2563eb',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase'
                                    }}>
                                        Hero WOD
                                    </div>
                                    <ChevronRight size={18} opacity={0.2} />
                                </div>
                                <h3 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800 }}>{hero.name}</h3>
                                <p style={{ fontSize: '0.9rem', opacity: 0.5, marginTop: '0.5rem' }}>
                                    Honor: {hero.hero || hero.honor}
                                </p>
                            </div>
                        ))}
                    </div>

                    {visibleHeroes.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '5rem', opacity: 0.3 }}>
                            <Medal size={48} style={{ marginBottom: '1rem' }} />
                            <p>Nenhum Herói encontrado.</p>
                        </div>
                    )}

                    {visibleCount < filteredHeroes.length && (
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
                    <button onClick={() => setSelectedHero(null)} className="chip" style={{ marginBottom: '2rem', borderRadius: '1rem' }}>
                        ← Voltar à Lista
                    </button>

                    <div className="premium-card" style={{ padding: '0', overflow: 'hidden', background: 'white' }}>
                        <div style={{
                            padding: '4rem 2rem',
                            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                            textAlign: 'center',
                            color: 'white'
                        }}>
                            <Award size={48} style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
                            <h2 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 900 }}>{selectedHero.name}</h2>
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
                                {selectedHero.stimulus || 'Endurance & Honor'}
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
                                border: '1px solid #bfdbfe',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {selectedHero.description}
                            </div>

                            {selectedHero.workout && selectedHero.workout.length > 0 ? (
                                <div className="workout-table-container">
                                    <table style={{ background: 'transparent', border: 'none' }}>
                                        <thead>
                                            <tr>
                                                <th>Exercício</th>
                                                <th style={{ textAlign: 'center' }}>Reps / Detalhes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedHero.workout.map((ex, idx) => (
                                                <tr key={idx}>
                                                    <td data-label="Exercício" style={{ fontWeight: 800 }}>{ex.name}</td>
                                                    <td data-label="Reps / Detalhes" style={{ textAlign: 'center' }}>
                                                        <span style={{
                                                            fontSize: '1.2rem',
                                                            fontWeight: 900,
                                                            color: '#2563eb'
                                                        }}>{ex.reps}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{
                                    padding: '2rem',
                                    background: '#f8fafc',
                                    borderRadius: '1.5rem',
                                    border: '1px dashed #cbd5e1',
                                    textAlign: 'center',
                                    color: '#64748b'
                                }}>
                                    Consulte a descrição acima para os detalhes deste WOD específico.
                                </div>
                            )}

                            {/* Additional Rules */}
                            {(selectedHero.rounds || selectedHero.amrap) && (
                                <div style={{
                                    marginTop: '2rem',
                                    padding: '1.5rem',
                                    textAlign: 'center',
                                    background: 'var(--surface-color)',
                                    borderRadius: '1.5rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 800,
                                    color: '#1e40af'
                                }}>
                                    {selectedHero.rounds ? `REPETE DURANTE ${selectedHero.rounds} ROUNDS` : `AMRAP ${selectedHero.amrap} MINUTOS`}
                                </div>
                            )}

                            <div style={{ marginTop: '3.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-primary" style={{ flex: 1, minWidth: '160px', background: '#2563eb' }} onClick={() => window.print()}>
                                    Exportar PDF
                                </button>
                                <ShareMenu wod={selectedHero} type="hero" accent="#2563eb" variant="light" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
