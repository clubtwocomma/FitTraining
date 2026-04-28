import { useState, useEffect } from 'react'
import { BookOpen, Plus, Trash2, BrainCircuit, CheckCircle2, ChevronLeft, Upload, RefreshCw, Sparkles, Info } from 'lucide-react'
import { apiFetch } from '../lib/api'

const TRAINING_TYPES = [
    { id: 'crossfit', label: 'CrossFit' },
    { id: 'força', label: 'Força' },
    { id: 'hyrox', label: 'Hyrox' },
    { id: 'calistenia', label: 'Calistenia' },
    { id: 'built', label: 'Built / Hipertrofia' },
    { id: 'powerlifting', label: 'Powerlifting' },
    { id: 'atletismo', label: 'Atletismo / Corrida' },
    { id: 'yoga', label: 'Yoga / Mobilidade' },
    { id: 'outro', label: 'Outro' },
]

export default function CustomLibrary({ onBack }) {
    const [workouts, setWorkouts] = useState([])
    const [name, setName] = useState('')
    const [type, setType] = useState('crossfit')
    const [source, setSource] = useState('')
    const [rawText, setRawText] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingList, setLoadingList] = useState(true)
    const [success, setSuccess] = useState(null)
    const [error, setError] = useState(null)
    const [expandedId, setExpandedId] = useState(null)
    const [tab, setTab] = useState('add') // 'add' | 'library'

    useEffect(() => {
        fetchWorkouts()
    }, [])

    const fetchWorkouts = () => {
        setLoadingList(true)
        apiFetch('/custom-workouts')
            .then(r => r.json())
            .then(data => {
                setWorkouts(Array.isArray(data) ? data : [])
                setLoadingList(false)
            })
            .catch(() => setLoadingList(false))
    }

    const handleParseAndSave = async () => {
        if (!rawText.trim()) {
            setError('Escreve ou cola o treino primeiro.')
            return
        }
        if (!name.trim()) {
            setError('Dá um nome a este treino.')
            return
        }
        setLoading(true)
        setError(null)
        setSuccess(null)
        try {
            const res = await apiFetch('/custom-workouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, source, rawText })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao guardar')
            setSuccess(`✅ "${name}" guardado com sucesso! A IA interpretou ${data.exercises?.length || 0} exercícios.`)
            setName('')
            setSource('')
            setRawText('')
            setTab('library')
            fetchWorkouts()
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id, wName) => {
        if (!confirm(`Apagar "${wName}"?`)) return
        await apiFetch(`/custom-workouts/${id}`, { method: 'DELETE' })
        fetchWorkouts()
    }

    return (
        <div className="animate-fade" style={{ maxWidth: '720px', margin: '0 auto' }}>
            {/* Fullscreen AI Loading Overlay for Custom Library */}
            {loading && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, gap: '1.5rem', padding: '2rem'
                }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-color)',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.3rem' }}>🤖 A interpretar o teu treino...</h2>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', maxWidth: '320px' }}>
                            A IA está a analisar o teu texto para extrair exercícios, séries, repetições e estrutura.
                        </p>
                    </div>
                </div>
            )}

            <button onClick={onBack} className="chip" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ChevronLeft size={16} /> Voltar
            </button>

            <header style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BookOpen size={30} color="var(--primary-color)" /> Biblioteca Personalizada
                </h1>
                <p style={{ opacity: 0.7 }}>
                    Adiciona treinos de qualquer modalidade em texto livre. A IA interpreta a estrutura e injeta-os na app.
                </p>
            </header>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button
                    className={`chip ${tab === 'add' ? 'active' : ''}`}
                    onClick={() => setTab('add')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <Plus size={16} /> Adicionar Treino
                </button>
                <button
                    className={`chip ${tab === 'library' ? 'active' : ''}`}
                    onClick={() => { setTab('library'); fetchWorkouts() }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <BookOpen size={16} /> Biblioteca ({workouts.length})
                </button>
            </div>

            {/* === ADD TAB === */}
            {tab === 'add' && (
                <div className="glass" style={{ padding: '1.5rem', borderRadius: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'var(--primary-glow)', borderRadius: '0.75rem', border: '1px dashed var(--primary-color)', fontSize: '0.85rem' }}>
                        <BrainCircuit size={18} color="var(--primary-color)" />
                        <span>A IA vai interpretar o texto, identificar exercícios, séries, reps e estrutura, e guardar no formato da app.</span>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>Nome do Treino *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: Murph Variante, Leg Day Pesado, Hyrox Simulação..."
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="form-group">
                            <label>Tipo de Treino *</label>
                            <select value={type} onChange={e => setType(e.target.value)}>
                                {TRAINING_TYPES.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Fonte / Autor (opcional)</label>
                            <input
                                type="text"
                                value={source}
                                onChange={e => setSource(e.target.value)}
                                placeholder="crossfit.com, coach João, etc."
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Upload size={14} /> Descrição do Treino *
                        </label>
                        <textarea
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            rows={10}
                            placeholder={`Cola ou escreve o treino aqui em qualquer formato. Exemplos:\n\nAMRAP 20 min:\n10 Thrusters (43/29 kg)\n10 Pull-ups\n200m Corrida\n\n---\n\nOU:\n\n5x5 Back Squat @ 80% 1RM\n3x10 Romanian Deadlift\n4x12 Leg Press\n2x failure Wall Sits\n\n---\n\nOU texto descritivo:\n"Hoje fizemos um circuito de 4 rounds de 20 Wall Balls, 15 Box Jumps e 10 Clean and Jerks a 60kg..."`}
                            style={{ width: '100%', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.75rem', color: 'var(--text-color)', fontSize: '0.85rem', lineHeight: '1.6', resize: 'vertical', fontFamily: 'monospace' }}
                        />
                        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
                            {rawText.length} caracteres — A IA aceita qualquer formato de texto
                        </div>
                    </div>

                    {error && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '0.75rem', padding: '0.75rem 1rem', color: '#ef4444', marginBottom: '1rem', fontSize: '0.85rem' }}>
                            ⚠️ {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid #34d399', borderRadius: '0.75rem', padding: '0.75rem 1rem', color: '#34d399', marginBottom: '1rem', fontSize: '0.85rem' }}>
                            {success}
                        </div>
                    )}

                    <button
                        onClick={handleParseAndSave}
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        {loading ? <><RefreshCw size={18} className="spin" /> A interpretar com IA...</> : <><Sparkles size={18} /> Interpretar e Guardar na Biblioteca</>}
                    </button>
                </div>
            )}

            {/* === LIBRARY TAB === */}
            {tab === 'library' && (
                <div>
                    {loadingList ? (
                        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>A carregar biblioteca...</div>
                    ) : workouts.length === 0 ? (
                        <div className="glass" style={{ padding: '3rem', textAlign: 'center', borderRadius: '1.25rem' }}>
                            <BookOpen size={48} opacity={0.3} style={{ marginBottom: '1rem' }} />
                            <p style={{ opacity: 0.6 }}>Ainda não tens treinos na biblioteca.</p>
                            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setTab('add')}>
                                <Plus size={16} /> Adicionar Primeiro Treino
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {workouts.map(w => (
                                <div key={w.id} className="glass" style={{ borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                                    <div
                                        style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                        onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{w.name}</div>
                                            <div style={{ fontSize: '0.78rem', opacity: 0.6, marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)', padding: '1px 8px', borderRadius: '10px', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>{w.type}</span>
                                                {w.source && <span>📎 {w.source}</span>}
                                                <span>{w.exercises?.length || 0} exercícios</span>
                                                <span>{new Date(w.createdAt).toLocaleDateString('pt-PT')}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDelete(w.id, w.name) }}
                                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {expandedId === w.id && (
                                        <div style={{ borderTop: '1px solid var(--glass-border)', padding: '1rem 1.25rem' }}>
                                            {w.aiNotes && (
                                                <div style={{ background: 'var(--primary-glow)', padding: '0.75rem', borderRadius: '0.5rem', borderLeft: '3px solid var(--primary-color)', marginBottom: '1rem', fontSize: '0.82rem', opacity: 0.9 }}>
                                                    <strong>💡 IA:</strong> {w.aiNotes}
                                                </div>
                                            )}
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', opacity: 0.6 }}>
                                                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Exercício</th>
                                                        <th style={{ padding: '4px 8px', textAlign: 'center' }}>Séries × Reps</th>
                                                        <th style={{ padding: '4px 8px', textAlign: 'center' }}>Carga</th>
                                                        <th style={{ padding: '4px 8px', textAlign: 'center' }}>Descanso</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(w.exercises || []).map((ex, i) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{ex.name}</td>
                                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{ex.sets || 1}× {ex.reps || '?'}</td>
                                                            <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 700 }}>{ex.load || '—'}</td>
                                                            <td style={{ padding: '6px 8px', textAlign: 'center', opacity: 0.7 }}>{ex.rest || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {w.rawText && (
                                                <details style={{ marginTop: '1rem' }}>
                                                    <summary style={{ cursor: 'pointer', opacity: 0.5, fontSize: '0.78rem' }}>Ver texto original</summary>
                                                    <pre style={{ marginTop: '0.5rem', background: 'var(--card-bg)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap', opacity: 0.7 }}>{w.rawText}</pre>
                                                </details>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
