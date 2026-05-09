import React, { useState } from 'react'
import { Share2, Download, ChevronLeft, Trophy, Clock, Info, X, CheckSquare, TrendingUp, ChevronDown, ChevronUp, Pin } from 'lucide-react'
import { apiFetch } from '../lib/api'
import FeedbackModal from './FeedbackModal'

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
    'dip': { how: 'Começa em suporte alto (argolas, barras paralelas ou banco). Desce o corpo dobrando os cotovelos até que os ombros fiquem abaixo do cotovelo. Empurra de volta até à extensão total.', url: 'https://www.crossfit.com/essentials/the-ring-dip' },
    'dips estritos': { how: 'Sem usar balanço das pernas, desce o corpo nas barras paralelas até os ombros passarem a linha dos cotovelos. Empurra com força até esticar totalmente os braços.', url: 'https://www.youtube.com/watch?v=2z8JmcrW-As' },
    'db dip': { how: 'Dips feitos com apoio de halteres ou em banco com carga extra. Foco na amplitude e controlo na descida.', url: 'https://www.youtube.com/watch?v=2z8JmcrW-As' },
    'abdominal': { how: 'Deitado de costas, sola dos pés juntas (borboleta). Toca com as mãos atrás da cabeça e depois à frente dos pés.', url: 'https://www.crossfit.com/essentials/the-sit-up' },
    'sit-up': { how: 'Deitado de costas, sola dos pés juntas. Toca com as mãos atrás da cabeça e depois à frente dos pés usando o core para subir.', url: 'https://www.crossfit.com/essentials/the-sit-up' },
}

const findExerciseNote = (name) => {
    if (!name) return null
    const lower = name.toLowerCase()
    for (const [key, note] of Object.entries(EXERCISE_NOTES)) {
        if (lower.includes(key)) return note
    }
    return null
}

export default function WorkoutView({ data, onBack, onPin }) {
    const {
        exercises = [],
        totalTime = data.duration || 0,
        summary = { structure: data.focus, type: 'Plano Semanal' },
        scheduledWorkoutId,
        boxWodId,
        globalWodId
    } = data || {}
    const [infoExpanded, setInfoExpanded] = useState(null)
    const [phaseInfoExpanded, setPhaseInfoExpanded] = useState({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [score, setScore] = useState('')
    const [notes, setNotes] = useState('')
    const [completed, setCompleted] = useState(false)
    const [expandedEvolution, setExpandedEvolution] = useState({})
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)

    const toggleEvolution = (key) => {
        setExpandedEvolution(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }

    const toggleInfo = (key) => {
        if (infoExpanded === key) setInfoExpanded(null);
        else setInfoExpanded(key);
    }

    const togglePhaseInfo = (phase) => {
        setPhaseInfoExpanded(prev => ({ ...prev, [phase]: !prev[phase] }))
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
        if (scheduledWorkoutId) {
            setShowFeedbackModal(true);
            return;
        }

        if (!score) {
            alert('Por favor, insere o teu resultado (tempo ou carga total).');
            return;
        }

        setIsSubmitting(true)
        try {
            const res = await apiFetch('box/results', {
                method: 'POST',
                body: JSON.stringify({
                    scheduledWorkoutId,
                    boxWodId,
                    globalWodId,
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

            <button onClick={onBack} className="chip" style={{ marginBottom: '1.5rem' }}>
                <ChevronLeft size={16} /> Voltar
            </button>

            {/* Hero Header Card */}
        <div className="premium-card" style={{
                marginBottom: '1.5rem',
                padding: '1.5rem',
                background: 'linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.95)), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'white'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                            <Trophy size={14} color="var(--accent-color)" />
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'var(--accent-color)' }}>Sessão de Hoje</span>
                        </div>
                        <h1 style={{ color: 'white', margin: 0, fontSize: 'clamp(1.2rem, 4vw, 1.75rem)', lineHeight: 1.25, wordBreak: 'break-word' }}>{summary.structure || 'Treino Personalizado'}</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '0.75rem', flexShrink: 0 }}>
                        <button onClick={() => onPin(data)} className="chip" style={{ background: 'var(--primary-color)', color: 'white', border: 'none', boxShadow: '0 4px 12px var(--primary-glow)', padding: '0.5rem' }}>
                            <Pin size={18} />
                        </button>
                        <button onClick={handleShare} className="chip" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem' }}><Share2 size={18} /></button>
                        <button onClick={handleExportPDF} className="chip" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem' }}><Download size={18} /></button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duração</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800 }}>{totalTime} min</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Foco</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800 }}>{summary.type || 'Híbrido'}</div>
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
                    
                    // New logic: check for day-level descriptions (from the new PLANO schema)
                    const dayWarmupDesc = phase === 'warmup' ? data.warmup?.description : null;
                    const dayCooldownDesc = phase === 'cooldown' ? data.cooldown?.description : null;
                    const phaseDescription = dayWarmupDesc || dayCooldownDesc;

                    if (phaseExercises.length === 0 && !phaseDescription) return null;

                    const phaseTitle = phase === 'warmup' ? '🔥 Aquecimento Específico' : 
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
                                {phase !== 'main' && <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6 }}>(Preparação e Recuperação)</span>}
                            </h3>

                            {phaseDescription && (
                                <div>
                                    <div className="premium-card" style={{ 
                                        padding: '1.25rem', 
                                        marginBottom: phaseInfoExpanded[phase] ? '0' : '1rem', 
                                        background: phase === 'warmup' ? 'rgba(249, 115, 22, 0.05)' : 'rgba(59, 130, 246, 0.05)',
                                        border: 'none',
                                        borderLeft: `3px solid ${phase === 'warmup' ? '#f97316' : '#3b82f6'}`,
                                        borderRadius: phaseInfoExpanded[phase] ? '0.75rem 0.75rem 0 0' : '0.75rem',
                                        fontSize: '0.95rem',
                                        lineHeight: '1.6',
                                        color: 'var(--text-main)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: '1rem'
                                    }}>
                                        <span>{phaseDescription}</span>
                                        {(phase === 'warmup' ? data.warmup?.steps : data.cooldown?.steps)?.length > 0 && (
                                            <button
                                                onClick={() => togglePhaseInfo(phase)}
                                                title="Ver protocolo detalhado"
                                                style={{
                                                    flexShrink: 0,
                                                    background: phase === 'warmup' ? 'rgba(249,115,22,0.12)' : 'rgba(59,130,246,0.12)',
                                                    border: 'none',
                                                    borderRadius: '0.5rem',
                                                    padding: '0.4rem 0.7rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    color: phase === 'warmup' ? '#f97316' : '#3b82f6',
                                                    transition: 'background 0.2s'
                                                }}
                                            >
                                                <Info size={14} />
                                                {phaseInfoExpanded[phase] ? 'Fechar' : 'Protocolo'}
                                            </button>
                                        )}
                                    </div>
                                    {phaseInfoExpanded[phase] && (
                                        <div style={{
                                            background: phase === 'warmup' ? 'rgba(249,115,22,0.04)' : 'rgba(59,130,246,0.04)',
                                            borderLeft: `3px solid ${phase === 'warmup' ? '#f97316' : '#3b82f6'}`,
                                            borderTop: `1px solid ${phase === 'warmup' ? 'rgba(249,115,22,0.15)' : 'rgba(59,130,246,0.15)'}`,
                                            borderRadius: '0 0 0.75rem 0.75rem',
                                            padding: '1rem 1.25rem',
                                            marginBottom: '1rem'
                                        }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, marginBottom: '0.75rem' }}>
                                                {phase === 'warmup' ? '🔥 Protocolo de Aquecimento' : '🧊 Protocolo de Arrefecimento'}
                                            </p>
                                            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                {(phase === 'warmup' ? data.warmup?.steps : data.cooldown?.steps).map((step, i) => (
                                                    <li key={i} style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="workout-exercises-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {phaseExercises.map((ex, idx) => {
                                    const note = findExerciseNote(ex.name);
                                    const isExpanded = infoExpanded === (idx + ex.name);
                                    return (
                                        <div key={idx} className="premium-card exercise-card" style={{ padding: '1.25rem', background: 'white', position: 'relative', overflow: 'hidden' }}>
                                            {/* Decorative side bar */}
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--primary-color)', opacity: 0.8 }}></div>
                                            
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div style={{ flex: 1 }}>
                                                    <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{ex.name}</h4>
                                                </div>
                                                <div style={{ textAlign: 'right', marginLeft: '1rem', background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary-color)' }}>{ex.sets} <span style={{ opacity: 0.4, fontSize: '0.9rem' }}>×</span> {ex.reps}</div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                                <div className="chip ai-badge" style={{ margin: 0, padding: '4px 10px', fontSize: '0.85rem' }}>
                                                    🏋️ {ex.weight_h && ex.weight_h !== '—' ? ex.weight_h : (ex.rm_percent && ex.rm_percent !== '—' ? ex.rm_percent : 'P. Corporal')}
                                                </div>
                                                {ex.rest && ex.rest !== '-' && (
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-color)', padding: '4px 10px', borderRadius: '1rem' }}>
                                                        ⏱️ {ex.rest}
                                                    </div>
                                                )}
                                                
                                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                                                    <button 
                                                        onClick={() => toggleEvolution(ex.name)}
                                                        className="chip"
                                                        style={{ padding: '6px', margin: 0, background: expandedEvolution[ex.name] ? '#eff6ff' : 'transparent', border: '1px solid var(--surface-color)', transition: 'all 0.2s ease' }}
                                                    >
                                                        {expandedEvolution[ex.name] ? <TrendingUp size={16} color="var(--primary-color)" /> : <TrendingUp size={16} opacity={0.4} />}
                                                    </button>
                                                    <button 
                                                        onClick={() => toggleInfo(idx + ex.name)}
                                                        className="chip"
                                                        style={{ padding: '6px', margin: 0, background: isExpanded ? 'var(--primary-glow)' : 'transparent', border: '1px solid var(--surface-color)', transition: 'all 0.2s ease' }}
                                                    >
                                                        <Info size={16} color={isExpanded ? 'var(--primary-color)' : 'var(--text-muted)'} />
                                                    </button>
                                                </div>
                                            </div>

                                            {expandedEvolution[ex.name] && (
                                                <div className="animate-fade" style={{ fontSize: '0.8rem', fontWeight: 600, padding: '10px 12px', background: '#f0fdf4', color: '#166534', borderRadius: '0.5rem', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <TrendingUp size={14} /> Carga Base: {(ex.weight_h || ex.rm_percent) && (ex.weight_h !== '—' && ex.rm_percent !== '—') ? (ex.weight_h || ex.rm_percent) : ex.reps} (Estável)
                                                </div>
                                            )}

                                            {ex.adaptation && ex.adaptation.trim() !== '' && (
                                                <div style={{ 
                                                    fontSize: '0.85rem', 
                                                    color: '#9a3412', 
                                                    background: '#ffedd5', 
                                                    padding: '10px 12px', 
                                                    borderRadius: '0.5rem', 
                                                    marginTop: '12px',
                                                    border: '1px solid #fed7aa',
                                                    lineHeight: 1.4
                                                }}>
                                                    💡 <strong>Adapt:</strong> {ex.adaptation}
                                                </div>
                                            )}

                                            {isExpanded && (
                                                <div className="animate-slide-up" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--surface-color)' }}>
                                                    {note ? (
                                                        <div style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-main)' }}>
                                                            <strong>Como executar:</strong> {note.how}
                                                            {note.url && (
                                                                <a href={note.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '0.75rem', color: 'var(--primary-color)', fontWeight: 700, textDecoration: 'none', padding: '6px 12px', background: 'var(--primary-glow)', borderRadius: '0.5rem' }}>
                                                                    ▶️ Ver Vídeo Tutorial
                                                                </a>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.9rem', opacity: 0.6, fontStyle: 'italic' }}>
                                                            Garante que realizas o movimento com amplitude total e controlo. Em caso de dúvida, consulta o teu coach.
                                                        </div>
                                                    )}
                                                    {ex.safety_notes && (
                                                         <div style={{ fontSize: '0.85rem', marginTop: '1rem', padding: '10px 12px', background: '#eff6ff', color: '#1e40af', borderRadius: '0.5rem', borderLeft: '3px solid #3b82f6' }}>
                                                            ⚠️ <strong>Atenção:</strong> {ex.safety_notes}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Results Logging Section */}
            {!completed && (
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

            {showFeedbackModal && (
                <FeedbackModal
                    workoutId={scheduledWorkoutId}
                    workoutFocus={summary.structure}
                    onClose={() => setShowFeedbackModal(false)}
                    onSuccess={() => {
                        setCompleted(true);
                        setTimeout(() => onBack(), 2000);
                    }}
                />
            )}
        </div>
    )
}
