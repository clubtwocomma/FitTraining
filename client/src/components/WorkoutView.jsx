import React, { useState } from 'react'
import { Share2, Download, ChevronLeft, Trophy, Clock, Info, X, CheckSquare, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { apiFetch } from '../lib/api'

// Execution notes database linked to crossfit.com movements
const EXERCISE_NOTES = {
    // Barbell - Olympic
    'thruster': { how: 'Começa com a barra nos ombros em rack position. Agacha até abaixo do paralelo e, na subida, usa o impulso das pernas para pressionar a barra acima da cabeça com os braços totalmente estendidos.', url: 'https://www.crossfit.com/essentials/the-thruster' },
    'clean': { how: 'Puxa a barra do chão com extensão explosiva das ancas e pernas. Chegando ao pico, mergulha sob a barra na posição de rack (cotovelos altos) para receber o peso nos ombros.', url: 'https://www.crossfit.com/essentials/the-clean-2' },
    'power clean': { how: 'Variante do Clean em que a receção é feita acima do paralelo das coxas. Extensão explosiva das ancas, pull dos cotovelos, receção em quarto de agachamento.', url: 'https://www.crossfit.com/essentials/the-power-clean' },
    'snatch': { how: 'Da posição de agachamento, estende as ancas de forma explosiva e puxa a barra diretamente acima da cabeça com um único movimento fluido. Braços totalmente estendidos na receção.', url: 'https://www.crossfit.com/essentials/the-snatch' },
    'power snatch': { how: 'Variante do Snatch em que a receção é feita acima do paralelo. Extensão forte das ancas e recepção direta overhead com cotovelos bloqueados.', url: 'https://www.crossfit.com/essentials/the-power-snatch' },
    'clean and jerk': { how: 'Dois movimentos: (1) Clean — barra dos chão até aos ombros; (2) Jerk — press explosivo da barra acima da cabeça com split ou power jerk. Extensão total dos braços no topo.', url: 'https://www.crossfit.com/essentials/the-clean-and-jerk' },
    'deadlift': { how: 'Barra por cima dos pés, costas neutras. Empurra o chão com os pés enquanto estende as ancas e os joelhos em simultâneo. Barra sempre perto do corpo.', url: 'https://www.crossfit.com/essentials/the-deadlift' },
    'overhead squat': { how: 'Barra overhead com agarre largo. Mantém a barra sobre a linha média (trapézios activos). Agacha to full depth com o tronco o mais vertical possível.', url: 'https://www.crossfit.com/essentials/the-overhead-squat' },
    'front squat': { how: 'Barra nos ombros em rack position com cotovelos altos. Agacha to full depth com o tronco o mais vertical possível. Joelhos alinhados com os pés.', url: 'https://www.crossfit.com/essentials/the-front-squat' },
    'back squat': { how: 'Barra nas trapézias. Agacha controlando o descimento até abaixo do paralelo. Empurra os joelhos para fora e mantém o core ativo.', url: 'https://www.crossfit.com/essentials/the-back-squat' },
    'push press': { how: 'Barra nos ombros. Faz um dip rápido nos joelhos e usa o impulso das pernas para pressionar a barra acima da cabeça. Cotovelos bloqueados no topo.', url: 'https://www.crossfit.com/essentials/the-push-press' },
    'push jerk': { how: 'Como o Push Press mas mergulhas sob a barra na receção, fazendo um quarto de agachamento. Cotovelos completamente estendidos e bloqueados no topo.', url: 'https://www.crossfit.com/essentials/the-push-jerk' },
    'sumo deadlift high pull': { how: 'Postura larga (sumo). Puxa a barra do chão com extensão explosiva das ancas e, no topo, continua a puxar os cotovelos bem alto acima dos ombros.', url: 'https://www.crossfit.com/essentials/the-sumo-deadlift-high-pull' },
    // Gymnastics
    'pull-up': { how: 'Agarra a barra com as palmas para a frente. Puxa o corpo até o queixo ficar acima da barra. Controla a descida. Em CrossFit pode ser feito com kipping (movimento de ancas para gerar impulso).', url: 'https://www.crossfit.com/essentials/the-kipping-pull-up' },
    'elevações': { how: 'Agarra a barra com as palmas para a frente. Puxa o corpo até o queixo ficar acima da barra. Em CrossFit pode ser feito com kipping (movimento de ancas para gerar impulso).', url: 'https://www.crossfit.com/essentials/the-kipping-pull-up' },
    'chest-to-bar': { how: 'Pull-up em que o peito toca na barra na fase superior. Usa kipping para gerar amplitude. O peito (não o queixo) deve contactar a barra.', url: 'https://www.crossfit.com/essentials/the-kipping-chest-to-bar-pull-up' },
    'toes-to-bar': { how: 'Pendurado na barra, usa kipping para gerar swing. No ponto alto, eleva as duas pernas simultaneamente até os pés tocarem a barra.', url: 'https://www.crossfit.com/essentials/the-kipping-toes-to-bar' },
    'handstand push-up': { how: 'Em posição invertida contra a parede, dobra os cotovelos até a cabeça tocar o chão (entre as mãos) e pressiona de volta até extensão total. Core ativo para não arquear.', url: 'https://www.crossfit.com/essentials/handstand-push-up-variations' },
    'hspu': { how: 'Em posição invertida contra a parede, dobra os cotovelos até a cabeça tocar o chão (entre as mãos) e pressiona de volta. Core ativo para não arquear em banana back.', url: 'https://www.crossfit.com/essentials/handstand-push-up-variations' },
    'muscle-up': { how: 'Pull-up explosivo passando da tração para a posição de suporte acima das argolas/barra. Requer kipping. A transição do pull para o dip é o momento crítico.', url: 'https://www.crossfit.com/essentials/the-kipping-muscle-up' },
    'ring dip': { how: 'Começa em suporte alto nas argolas. Desce até os ombros ficarem abaixo dos cotovelos e empurra de volta. Cotovelos para trás, não para fora.', url: 'https://www.crossfit.com/essentials/the-ring-dip' },
    'burpee': { how: 'Deita no chão com peito e coxas a tocar. Levanta-te e salta com palmas acima da cabeça. Movimento contínuo e fluido. Peito no chão é o standard CrossFit.', url: 'https://www.crossfit.com/essentials/the-burpee-2' },
    'double-under': { how: 'A corda passa por baixo dos pés DUAS vezes por cada salto. Salto de tornozelo (não de joelho), pés juntos. Os pulsos fazem a rotação rápida — não os braços.', url: 'https://www.crossfit.com/essentials/the-double-under' },
    'box jump': { how: 'Salta para a caixa com extensão total das ancas e joelhos no atteragem. Desce da caixa com controlo. Não esqueces a extensão total no topo.', url: 'https://www.crossfit.com/essentials/the-box-jump' },
    'wall-ball': { how: 'Agacha com a bola em medicine ball em frente ao peito até abaixo do paralelo. Na subida usa o impulso para lançar a bola ao alvo (3m). Boa receção e repete.', url: 'https://www.crossfit.com/essentials/the-wall-ball' },
    // Dumbbell & Bodybuilding
    'kettlebell swing': { how: 'Pernas abertas à largura dos ombros. A bola oscila entre as pernas (anca dobrada) e o movimento é de ANCA, não de braços. Extensão total das ancas no topo ao nível dos ombros (ou overhead).', url: 'https://www.crossfit.com/essentials/the-kettlebell-swing' },
    'bench press': { how: 'Deitado no banco, baixa a barra até ao peito e empurra com força total. Mantém os pés no chão.', url: 'https://www.youtube.com/watch?v=ptpmRrzRtWQ' },
    'supino': { how: 'Deitado no banco, baixa a barra até ao peito e empurra com força total. Mantém os pés no chão e as escápulas retraídas.', url: 'https://www.youtube.com/watch?v=ptpmRrzRtWQ' },
    'leg press': { how: 'Empurra a plataforma com os pés à largura dos ombros. Não trancques os joelhos no topo.', url: 'https://www.youtube.com/watch?v=0h68NclGjrw' },
    'lunge': { how: 'Passo em frente e desce o joelho de trás até quase tocar no chão. Mantém o tronco vertical.', url: 'https://www.youtube.com/watch?v=QOVaHwm-Q6U' },
    'romanian deadlift': { how: 'Dobradiça de anca com pernas quase esticadas. Desce a barra rente às pernas até sentir o estiramento nos isquiotibiais.', url: 'https://www.youtube.com/watch?v=_oyxCn2iSjU' },
    'bicep curl': { how: 'Mantém os cotovelos colados ao corpo. Sobe o peso isolando o bíceps.', url: 'https://www.youtube.com/watch?v=i1YgFZB6alI' },
    'tricep extension': { how: 'Extensão do braço isolando o tríceps. Mantém o braço fixo junto à cabeça.', url: 'https://www.youtube.com/watch?v=D-UvK7hNIsY' },
    'extensão tricep': { how: 'Extensão do braço isolando o tríceps. Mantém o braço fixo junto à cabeça ou usa a polia.', url: 'https://www.youtube.com/watch?v=D-UvK7hNIsY' },
    'plank': { how: 'Mantém o corpo em linha reta apoiado nos antebraços. Core bem ativo.', url: 'https://www.youtube.com/watch?v=pSHjTRCQxIw' },
    'shoulder press': { how: 'Empurra o peso acima da cabeça até estender totalmente os braços.', url: 'https://www.youtube.com/watch?v=qa0S69-3fU0' },
    'press militar': { how: 'Empurra a barra ou halteres verticalmente acima da cabeça. Mantém o core firme para não arquear a lombar.', url: 'https://www.youtube.com/watch?v=_RlRDWO2jfg' },
    'crucifixo': { how: 'Deitado no banco, abre os braços com halteres mantendo ligeira flexão no cotovelo até sentir o peito alongar. Sobe apertando o peito.', url: 'https://www.youtube.com/watch?v=Z57CtFmRMxA' },
    // Warmup & Mobility
    'passagens c/ elástico': { how: 'Braços esticados, passa o elástico da frente para trás das costas e volta. Mantém os ombros baixos e braços bloqueados.', url: 'https://www.youtube.com/watch?v=AT_8Zr67Gzw' },
    'floor slides': { how: 'Deitado de costas, braços a 90º tocando o chão. Desliza os braços para cima da cabeça sem tirar os cotovelos do chão.', url: 'https://www.youtube.com/watch?v=egQf99YWbF4' },
    'spiderman stretch': { how: 'Lunge profundo. Coloca o cotovelo do mesmo lado do pé da frente no chão e depois roda o braço para o teto.', url: 'https://www.youtube.com/watch?v=-CiWQ2IvY34' },
    'cossack squat': { how: 'Postura larga. Desce para um lado mantendo a perna oposta esticada e o calcanhar no chão.', url: 'https://www.youtube.com/watch?v=tpczTeSkHz0' },
    'cat-cow': { how: 'Apoio de quatro. Arqueia as costas para cima (gato) e depois para baixo (vaca), sincronizando com a respiração.', url: 'https://www.youtube.com/watch?v=K9bK0SntjY0' },
    'inchworm': { how: 'Caminha com as mãos até à posição de prancha e depois com os pés até às mãos.', url: 'https://www.youtube.com/watch?v=0_u6rM2P_e0' },
    // Default
    'flexão': { how: 'Mãos à largura dos ombros, corpo em prancha. Dobra os cotovelos até ao peito quase tocar o chão. Estende de volta com core ativo.', url: 'https://www.crossfit.com/essentials/the-push-up' },
    'agachamento': { how: 'Pés à largura dos ombros. Empurra as ancas para trás e dobra os joelhos até abaixo do paralelo. Tronco erecto.', url: 'https://www.crossfit.com/essentials/the-air-squat' },
    'remada': { how: 'Puxa o peso para junto do abdómen com o cotovelo colado ao corpo. Aperta as omoplatas no topo.', url: 'https://www.youtube.com/watch?v=6KA7V6zW2o8' },
    'corrida': { how: 'Aterragem no médio-pé, ligeira inclinação à frente, braços a 90º com swing eficiente.', url: 'https://www.youtube.com/watch?v=_kH5v_V6S00' },
    'alongamentos': { how: 'Série de alongamentos passivos. Segura cada posição por 20-30 segundos para relaxar o músculo.', url: 'https://www.youtube.com/watch?v=zZ879i26-K0' },
}

const findExerciseNote = (name) => {
    if (!name) return null
    const lower = name.toLowerCase()
    for (const [key, note] of Object.entries(EXERCISE_NOTES)) {
        if (lower.includes(key)) return note
    }
    return null
}

export default function WorkoutView({ data, onBack }) {
    const {
        exercises = [],
        totalTime = data.duration || 0,
        summary = { structure: data.focus, type: 'Plano Semanal' },
        scheduledWorkoutId
    } = data || {}
    const [infoModal, setInfoModal] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [score, setScore] = useState('')
    const [notes, setNotes] = useState('')
    const [completed, setCompleted] = useState(false)
    const [expandedEvolution, setExpandedEvolution] = useState({})

    const toggleEvolution = (key) => {
        setExpandedEvolution(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }

    const handleExportPDF = () => {
        window.print()
    }

    const handleShare = () => {
        // Build full workout text
        let text = `💪 TREINO FITTRAINING — ${totalTime} min\n`
        if (summary.structure) text += `📋 ${summary.structure}\n`
        if (summary.type) text += `🏷️ Tipo: ${summary.type}\n`
        if (summary.muscleGroups) text += `🎯 Músculos: ${summary.muscleGroups.join(', ')}\n`
        if (summary.intent) text += `💡 Intuito: ${summary.intent}\n`
        text += `\n`

        let currentPhase = ''
        exercises.forEach(ex => {
            if (ex.phase && ex.phase !== currentPhase) {
                currentPhase = ex.phase
                const phaseLabel = currentPhase === 'warmup' ? '🔥 AQUECIMENTO' : currentPhase === 'cooldown' ? '🧊 RETORNO À CALMA' : '🏋️ PARTE PRINCIPAL'
                text += `\n${phaseLabel}\n${'─'.repeat(20)}\n`
            }
            const setsReps = `${ex.sets || 1}× ${ex.reps}`
            const load = ex.weight_h && ex.weight_h !== '—' ? ` | ♂ ${ex.weight_h}` : ''
            const loadF = ex.weight_m && ex.weight_m !== '—' ? ` | ♀ ${ex.weight_m}` : ''
            const rest = ex.rest && ex.rest !== '-' ? ` | Desc: ${ex.rest}` : ''
            text += `• ${ex.name} — ${setsReps}${load}${loadF}${rest}\n`
        })

        text += `\n📱 Gerado por FitTraining`

        if (navigator.share) {
            navigator.share({
                title: `Treino FitTraining ${totalTime}min`,
                text
            }).catch(console.error)
        } else {
            navigator.clipboard.writeText(text).then(() => {
                alert('Treino copiado para a área de transferência! 📋')
            }).catch(() => {
                const ta = document.createElement('textarea')
                ta.value = text
                document.body.appendChild(ta)
                ta.select()
                document.execCommand('copy')
                document.body.removeChild(ta)
                alert('Treino copiado para a área de transferência! 📋')
            })
        }
    }

    const handleFinish = async () => {
        if (!score && scheduledWorkoutId) {
            alert('Por favor, insere o teu resultado (tempo ou carga total).');
            return;
        }

        setIsSubmitting(true)
        try {
            const res = await apiFetch('box/results', {
                method: 'POST',
                body: JSON.stringify({
                    scheduledWorkoutId,
                    score,
                    notes,
                    type: 'RX' // Default
                })
            });

            if (!res.ok) throw new Error('Erro ao submeter resultado');
            setCompleted(true);
            setTimeout(() => onBack(), 2000);
        } catch (err) {
            console.error("Error submitting result:", err);
            alert("Falha ao guardar resultado.");
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="workout-view animate-fade">
            {/* Info Modal */}
            {infoModal && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
                    onClick={() => setInfoModal(null)}
                >
                    <div
                        className="premium-card animate-fade"
                        style={{ maxWidth: '500px', width: '100%', position: 'relative', background: 'white' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setInfoModal(null)}
                            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--surface-color)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                            <div style={{ background: 'var(--primary-glow)', padding: '0.75rem', borderRadius: '1rem' }}>
                                <Info size={24} color="var(--primary-color)" />
                            </div>
                            <h3 style={{ margin: 0 }}>{infoModal.name}</h3>
                        </div>
                        <p style={{ lineHeight: '1.8', fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '1.5rem' }}>{infoModal.note.how}</p>
                        {infoModal.note.url && (
                            <a
                                href={infoModal.note.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline"
                                style={{ width: 'auto' }}
                            >
                                📹 Ver vídeo tutorial
                            </a>
                        )}
                    </div>
                </div>
            )}

            <button onClick={onBack} className="chip" style={{ marginBottom: '1.5rem' }}>
                <ChevronLeft size={16} /> Voltar
            </button>

            {/* Hero Header Card */}
            <div className="premium-card" style={{
                marginBottom: '2rem',
                padding: '2.5rem',
                background: 'linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.95)), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'white'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                            <Trophy size={20} color="var(--accent-color)" />
                            <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem', color: 'var(--accent-color)' }}>Sessão de Hoje</span>
                        </div>
                        <h1 style={{ color: 'white', margin: 0, fontSize: '2.5rem' }}>{summary.structure || 'Treino Personalizado'}</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={handleShare} className="chip" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}><Share2 size={24} /></button>
                        <button onClick={handleExportPDF} className="chip" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}><Download size={24} /></button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>Duração</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{totalTime} min</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>Foco</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{summary.type || 'Híbrido'}</div>
                    </div>
                </div>
            </div>

            {/* Intent & Stimulus Box */}
            {summary.intent && (
                <div className="premium-card" style={{ marginBottom: '2rem', background: '#f8fafc', border: 'none' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                        🎯 <span style={{ fontWeight: 800 }}>Intuito do Treino</span>
                    </h4>
                    <p style={{ color: 'var(--text-main)', fontStyle: 'italic', lineHeight: '1.7', borderLeft: '4px solid var(--primary-color)', paddingLeft: '1.5rem', margin: 0 }}>
                        {summary.intent}
                    </p>
                </div>
            )}

            {/* Phase-based Tabular View */}
            <div className="workout-phases-container">
                {['warmup', 'main', 'cooldown'].map(phase => {
                    const phaseExercises = exercises.filter(ex => (ex.phase || 'main') === phase);
                    if (phaseExercises.length === 0) return null;

                    const phaseTitle = phase === 'warmup' ? '🔥 Aquecimento (Sugestão)' : 
                                     phase === 'cooldown' ? '🧊 Retorno à Calma' : 
                                     '🏋️ Parte Principal';

                    return (
                        <div key={phase} style={{ marginBottom: '2.5rem' }}>
                            <h3 style={{ 
                                fontSize: '1.25rem', 
                                fontWeight: 800, 
                                marginBottom: '1rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                color: phase === 'main' ? 'var(--primary-color)' : 'var(--text-muted)'
                            }}>
                                {phaseTitle}
                                {phase !== 'main' && <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6 }}>(Não conta para o tempo)</span>}
                            </h3>

                            <div className="workout-table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Exercício</th>
                                            <th style={{ textAlign: 'center' }}>Evolução</th>
                                            <th style={{ textAlign: 'center' }}>Séries/Reps</th>
                                            <th style={{ textAlign: 'center' }}>Carga Sugerida</th>
                                            <th style={{ textAlign: 'center' }}>Descanso</th>
                                            <th style={{ textAlign: 'center' }}>Info</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {phaseExercises.map((ex, idx) => {
                                            const note = findExerciseNote(ex.name);
                                            return (
                                                <tr key={idx}>
                                                    <td data-label="Exercício">
                                                        <div style={{ fontWeight: 800 }}>{ex.name}</div>
                                                        {ex.adaptation && ex.adaptation.trim() !== '' && (
                                                            <div style={{ 
                                                                fontSize: '0.8rem', 
                                                                color: 'var(--accent-color)', 
                                                                background: '#fff7ed', 
                                                                padding: '4px 8px', 
                                                                borderRadius: '6px', 
                                                                marginTop: '4px',
                                                                display: 'inline-block',
                                                                border: '1px solid #ffedd5'
                                                            }}>
                                                                💡 <strong>Adapt:</strong> {ex.adaptation}
                                                            </div>
                                                        )}
                                                        {ex.safety_notes && <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>{ex.safety_notes}</div>}
                                                    </td>
                                                    <td data-label="Evolução" style={{ textAlign: 'center' }}>
                                                        <button 
                                                            onClick={() => toggleEvolution(ex.name)}
                                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                                            title="Ver histórico"
                                                        >
                                                            {expandedEvolution[ex.name] ? <TrendingUp size={18} color="var(--primary-color)" /> : <TrendingUp size={18} opacity={0.4} />}
                                                        </button>
                                                        {expandedEvolution[ex.name] && (
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 600, marginTop: '4px', color: 'var(--accent-color)', animation: 'fadeIn 0.3s ease' }}>
                                                                {(ex.weight_h || ex.rm_percent) && (ex.weight_h !== '—' && ex.rm_percent !== '—') ? (ex.weight_h || ex.rm_percent) : ex.reps} (Estável)
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td data-label="Séries/Reps" style={{ textAlign: 'center' }}>
                                                        <strong>{ex.sets}</strong> <span style={{ opacity: 0.3 }}>×</span> <strong>{ex.reps}</strong>
                                                    </td>
                                                    <td data-label="Carga" style={{ textAlign: 'center' }}>
                                                        <div className="chip ai-badge" style={{ margin: '0 auto' }}>
                                                            {ex.weight_h && ex.weight_h !== '—' ? ex.weight_h : (ex.rm_percent && ex.rm_percent !== '—' ? ex.rm_percent : 'P. Corporal')}
                                                        </div>
                                                    </td>
                                                    <td data-label="Descanso" style={{ textAlign: 'center', opacity: 0.7 }}>
                                                        {ex.rest && ex.rest !== '-' ? ex.rest : '—'}
                                                    </td>
                                                    <td data-label="Info" style={{ textAlign: 'center' }}>
                                                        {note ? (
                                                            <button 
                                                                onClick={() => setInfoModal({ name: ex.name, note })}
                                                                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer' }}
                                                            >
                                                                <Info size={20} />
                                                            </button>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Results Logging Section */}
            {scheduledWorkoutId && !completed && (
                <div className="premium-card animate-slide-up" style={{ marginTop: '3rem', background: 'white', padding: '2.5rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', fontWeight: 900 }}>
                        <CheckSquare size={24} color="var(--primary-color)" /> Registar Resultado
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="input-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 700, opacity: 0.6 }}>Resultado Final (Ex: 12:45 ou 85kg)</label>
                            <input
                                type="text"
                                placeholder="Insere o teu tempo ou carga..."
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                                style={{ width: '100%', padding: '1rem', borderRadius: '1rem', border: '2px solid var(--surface-color)', background: '#f8fafc', fontSize: '1.1rem' }}
                            />
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 700, opacity: 0.6 }}>Notas / Cargas do Set</label>
                            <input
                                type="text"
                                placeholder="Notas extras..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                style={{ width: '100%', padding: '1rem', borderRadius: '1rem', border: '2px solid var(--surface-color)', background: '#f8fafc', fontSize: '1.1rem' }}
                            />
                        </div>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleFinish}
                        disabled={isSubmitting}
                        style={{ height: '60px', fontSize: '1.1rem' }}
                    >
                        {isSubmitting ? 'A guardar...' : 'Concluir Treino'}
                    </button>
                </div>
            )}

            {completed && (
                <div className="premium-card animate-fade" style={{ marginTop: '3rem', background: '#f0fdf4', border: '2px solid #22c55e', padding: '3rem', textAlign: 'center' }}>
                    <div style={{ color: '#22c55e', marginBottom: '1rem' }}><Trophy size={64} style={{ margin: '0 auto' }} /></div>
                    <h2 style={{ color: '#166534', fontWeight: 900 }}>Treino Concluído!</h2>
                    <p style={{ color: '#166534', opacity: 0.8 }}>O teu resultado foi guardado no teu histórico.</p>
                </div>
            )}

            <footer style={{ marginTop: '3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.85rem' }}>
                <p>Otimizado pela FitTraining IA para {summary.muscleGroups?.join(', ')}.</p>
                <p style={{ marginTop: '0.5rem' }}>Ajusta sempre a intensidade ao teu nível atual.</p>
            </footer>
        </div>
    )
}
