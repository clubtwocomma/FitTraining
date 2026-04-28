import { useState } from 'react'
import { Clock, Dumbbell, Zap, Sparkles, BrainCircuit, Shuffle } from 'lucide-react'

const MUSCLE_GROUPS = [
    'peito', 'costas', 'ombros', 'pernas', 'glúteos', 'core', 'corpo inteiro'
]

const EQUIPMENT = [
    { id: 'halteres', name: 'Halteres (Dumbbells)' },
    { id: 'barra olímpica', name: 'Barra Olímpica' },
    { id: 'barra de pull-ups', name: 'Barra de Pull-ups' },
    { id: 'kettlebells', name: 'Kettlebells' },
    { id: 'bicicleta estática', name: 'Bicicleta Estática' },
    { id: 'passadeira', name: 'Passadeira' },
    { id: 'banco', name: 'Banco de Bench' },
    { id: 'elásticos', name: 'Elásticos/Resistências' },
    { id: 'bola medicinal', name: 'Bola Medicinal (Wall-balls)' },
    { id: 'caixa', name: 'Caixa (Box Jumps)' }
]

const TIME_PRESETS = [15, 30, 45, 60]

export default function WorkoutForm({ onGenerate, profile, onBack }) {
    const [time, setTime] = useState(30)
    const [selectedMuscles, setSelectedMuscles] = useState(['corpo inteiro'])
    const [trainingType, setTrainingType] = useState('both')

    // Auto-select equipment based on User Profile Environment!
    const [selectedEquipment, setSelectedEquipment] = useState(() => {
        if (profile?.environment === 'casa') return profile?.homeEquipment || []
        return EQUIPMENT.map(eq => eq.id) // If Gym/Box, assume all equipment is available by default
    })

    // Auto-select the first configured AI provider from localStorage
    const [aiProvider, setAiProvider] = useState(() => {
        const saved = localStorage.getItem('ai_keys')
        const keys = saved ? JSON.parse(saved) : {}
        if (keys.openai && keys.openai.length > 4) return 'openai'
        if (keys.gemini && keys.gemini.length > 4) return 'gemini'
        if (keys.pollination && keys.pollination.length > 4) return 'pollination'
        return 'pollinations' // Default: server uses its own Pollinations key
    })

    // Read which keys are configured for UI labels
    const configuredKeys = (() => {
        const saved = localStorage.getItem('ai_keys')
        return saved ? JSON.parse(saved) : {}
    })()

    const isConfigured = (provider) => configuredKeys[provider] && configuredKeys[provider].length > 4

    const toggleMuscle = (muscle) => {
        setSelectedMuscles(prev =>
            prev.includes(muscle)
                ? prev.filter(m => m !== muscle)
                : [...prev, muscle]
        )
    }

    const toggleEquipment = (id) => {
        setSelectedEquipment(prev =>
            prev.includes(id)
                ? prev.filter(e => e !== id)
                : [...prev, id]
        )
    }

    const selectAllEquipment = () => {
        if (selectedEquipment.length === EQUIPMENT.length) {
            setSelectedEquipment([])
        } else {
            setSelectedEquipment(EQUIPMENT.map(eq => eq.id))
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        const clientApiKey = configuredKeys[aiProvider] || ''
        onGenerate({
            time,
            muscleGroups: selectedMuscles,
            type: trainingType,
            equipment: selectedEquipment,
            aiProvider,
            clientApiKey
        })
    }

    const feelingLucky = () => {
        const randomTime = [15, 20, 30, 45, 60][Math.floor(Math.random() * 5)]
        const allMuscles = ['peito', 'costas', 'ombros', 'pernas', 'glúteos', 'core', 'corpo inteiro']
        const randomMuscles = Math.random() > 0.4
            ? ['corpo inteiro']
            : [allMuscles[Math.floor(Math.random() * (allMuscles.length - 1))]]

        const hasBarbell = selectedEquipment.includes('barra olímpica')
        const hasKettlebell = selectedEquipment.includes('kettlebells')
        const hasDumbbells = selectedEquipment.includes('halteres')
        const hasAnyWeight = hasBarbell || hasKettlebell || hasDumbbells
        const hasCardioEquip = selectedEquipment.some(e => ['passadeira', 'bicicleta estática', 'remo'].includes(e))

        let allowedTypes = ['calistenia', 'built']
        if (hasAnyWeight) allowedTypes.push('força', 'crossfit', 'both')
        if (hasAnyWeight && hasCardioEquip) allowedTypes.push('hyrox')

        const randomType = allowedTypes[Math.floor(Math.random() * allowedTypes.length)]

        setTime(randomTime)
        setSelectedMuscles(randomMuscles)
        setTrainingType(randomType)

        const clientApiKey = configuredKeys[aiProvider] || ''
        onGenerate({
            time: randomTime,
            muscleGroups: randomMuscles,
            type: randomType,
            equipment: selectedEquipment,
            aiProvider,
            clientApiKey
        })
    }

    return (
        <form onSubmit={handleSubmit} className="workout-form animate-fade">
            <header style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button type="button" onClick={onBack} className="chip" style={{ borderRadius: '1rem', padding: '0.6rem' }}>
                    ←
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.2rem' }}>Novo Treino</h1>
                    <p style={{ margin: 0 }}>Geração inteligente via IA</p>
                </div>
            </header>

            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Time Selection */}
                <div className="form-group">
                    <label><Clock size={16} /> Tempo Disponível (minutos)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div className="chip-group" style={{ flex: 1 }}>
                            {TIME_PRESETS.map(t => (
                                <div
                                    key={t}
                                    className={`chip ${time === t ? 'active' : ''}`}
                                    onClick={() => setTime(t)}
                                >
                                    {t}m
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={feelingLucky}
                            className="btn btn-primary"
                            style={{ width: 'auto', padding: '0.6rem 1rem', background: 'linear-gradient(135deg, #7c3aed, #ec4899)', border: 'none' }}
                        >
                            <Shuffle size={16} /> Sinto-me com Sorte...
                        </button>
                    </div>
                    <input
                        type="number"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        placeholder="Tempo personalizado..."
                    />
                </div>

                {/* Muscle Groups */}
                <div className="form-group">
                    <label><Dumbbell size={16} /> Grupos Musculares</label>
                    <div className="chip-group">
                        {MUSCLE_GROUPS.map(mg => (
                            <div
                                key={mg}
                                className={`chip ${selectedMuscles.includes(mg) ? 'active' : ''}`}
                                onClick={() => toggleMuscle(mg)}
                            >
                                {mg}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Equipment Selection */}
                <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <label style={{ margin: 0 }}><Zap size={16} /> Material</label>
                        <span onClick={selectAllEquipment} style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 700, cursor: 'pointer' }}>
                            {selectedEquipment.length === EQUIPMENT.length ? 'Limpar Todos' : 'Selecionar Todos'}
                        </span>
                    </div>
                    <div className="chip-group">
                        {EQUIPMENT.map(eq => (
                            <div
                                key={eq.id}
                                className={`chip ${selectedEquipment.includes(eq.id) ? 'active' : ''}`}
                                onClick={() => toggleEquipment(eq.id)}
                            >
                                {eq.name.split(' (')[0]}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Training Type */}
                <div className="form-group">
                    <label><BrainCircuit size={16} /> Estilo de Treino</label>
                    <select value={trainingType} onChange={(e) => setTrainingType(e.target.value)}>
                        <option value="força">Força Clássica</option>
                        <option value="crossfit">Crossfit / Funcional</option>
                        <option value="calistenia">Calistenia (P. Corporal)</option>
                        <option value="hyrox">Hyrox Performance</option>
                        <option value="built">Built (Glúteo/Perna)</option>
                        <option value="both">Híbrido / Amplo</option>
                    </select>
                </div>

                {/* AI Engine - Nested Glass Box */}
                <div style={{ padding: '1.25rem', background: 'var(--surface-color)', borderRadius: '1.5rem', border: '1px solid var(--glass-border)' }}>
                    <label style={{ color: 'var(--primary-color)' }}>
                        <Sparkles size={16} /> Motor de Inteligência Artificial
                    </label>
                    <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '0.5rem 0' }}>
                        <option value="pollinations">🤖 Pollinations IA (Recomendado)</option>
                        {isConfigured('openai') && <option value="openai">✅ OpenAI ChatGPT</option>}
                        {isConfigured('gemini') && <option value="gemini">✅ Google Gemini</option>}
                        {isConfigured('pollination') && <option value="pollination">✅ Pollinations.ai</option>}
                        <option disabled>──────────────</option>
                        <option value="">⚙️ Algoritmo Padrão (Sem IA)</option>
                    </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ height: '64px', fontSize: '1.1rem' }}>
                    Gerar Treino <Sparkles size={20} />
                </button>
            </div>
        </form>
    )
}
