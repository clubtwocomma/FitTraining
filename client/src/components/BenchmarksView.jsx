import React, { useState } from 'react';
import { ChevronLeft, Medal, Flame, Zap } from 'lucide-react';
import HeroWods from './HeroWods';
import GirlsWods from './GirlsWods';
import PainstormWods from './PainstormWods';

export default function BenchmarksView({ onBack }) {
    const [activeTab, setActiveTab] = useState('heroes'); // 'heroes', 'girls', or 'painstorms'

    return (
        <div className="benchmarks-view animate-fade">
            <header style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button onClick={onBack} className="chip" style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Benchmarks</h1>
                </div>

                <div style={{
                    display: 'flex',
                    background: 'var(--surface-color)',
                    padding: '4px',
                    borderRadius: '1rem',
                    gap: '4px'
                }}>
                    <button
                        onClick={() => setActiveTab('heroes')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '0.8rem',
                            border: 'none',
                            background: activeTab === 'heroes' ? 'white' : 'transparent',
                            color: activeTab === 'heroes' ? 'var(--primary-color)' : 'var(--text-muted)',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: activeTab === 'heroes' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none'
                        }}
                    >
                        <Medal size={18} /> Heroes
                    </button>
                    <button
                        onClick={() => setActiveTab('girls')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '0.8rem',
                            border: 'none',
                            background: activeTab === 'girls' ? 'white' : 'transparent',
                            color: activeTab === 'girls' ? '#db2777' : 'var(--text-muted)',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: activeTab === 'girls' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none'
                        }}
                    >
                        <Flame size={18} /> Girls
                    </button>
                    <button
                        onClick={() => setActiveTab('painstorms')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '0.8rem',
                            border: 'none',
                            background: activeTab === 'painstorms' ? 'white' : 'transparent',
                            color: activeTab === 'painstorms' ? '#2563eb' : 'var(--text-muted)',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: activeTab === 'painstorms' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none'
                        }}
                    >
                        <Zap size={18} /> Pain
                    </button>
                </div>
            </header>

            <div className="benchmarks-content">
                {activeTab === 'heroes' && <HeroWods />}
                {activeTab === 'girls' && <GirlsWods />}
                {activeTab === 'painstorms' && <PainstormWods />}
            </div>

            <style>{`
                .benchmarks-view .hero-wods-view header,
                .benchmarks-view .girls-view header,
                .benchmarks-view .painstorm-view header {
                    display: none !important;
                }
                .benchmarks-content {
                    margin-top: 1.5rem;
                }
            `}</style>
        </div>
    );
}
