import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, X, Flame, MessageSquare } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { setLogSummary } from '../lib/training'

// "Como te sentiste?" — escala de 5 níveis, separada do esforço (RPE).
const FEELINGS = [
  { v: 1, emoji: '😫', label: 'Muito fraco' },
  { v: 2, emoji: '😕', label: 'Fraco' },
  { v: 3, emoji: '😐', label: 'Normal' },
  { v: 4, emoji: '🙂', label: 'Forte' },
  { v: 5, emoji: '💪', label: 'Muito forte' }
]

const RPE_LABELS = {
  1: 'Muito fácil 😴',
  2: 'Fácil 🙂',
  3: 'Leve 👌',
  4: 'Moderado 💪',
  5: 'Esforço médio 😤',
  6: 'Exigente 🔥',
  7: 'Muito exigente 🥵',
  8: 'Quase ao limite 😰',
  9: 'Máximo esforço 🚨',
  10: 'Destruído 💀'
}

const RPE_COLORS = {
  1: '#22c55e', 2: '#22c55e', 3: '#84cc16',
  4: '#eab308', 5: '#f97316', 6: '#f97316',
  7: '#ef4444', 8: '#ef4444', 9: '#dc2626', 10: '#7f1d1d'
}

export default function FeedbackModal({ workoutId, workoutFocus, onClose, onSuccess, setLog = [], defaultDuration }) {
  const summary = setLogSummary(setLog)
  const [rpe, setRpe] = useState(6)
  const [completed, setCompleted] = useState(!(summary.done > 0 && summary.compliance < 100))
  const [feel, setFeel] = useState(null)
  const [duration, setDuration] = useState(defaultDuration || '')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setIsSaving(true)
    try {
      const res = await apiFetch(`workouts/${workoutId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          rpe, completed, notes, feel,
          durationMin: duration ? Number(duration) : null,
          sets: summary.done > 0 ? setLog : null
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao guardar feedback')
      }

      setDone(true)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1500)
    } catch (err) {
      alert(`Não foi possível guardar: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Portal para o body: dentro da vista do treino (que tem transform na animação de
  // entrada) o position: fixed ficava preso ao contentor e por baixo da barra inferior.
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10, 15, 30, 0.75)',
      backdropFilter: 'blur(12px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div className="premium-card animate-scale-up" style={{
        width: '100%', maxWidth: '480px',
        maxHeight: '92vh', overflowY: 'auto',
        background: 'var(--bg-color)',
        padding: 'clamp(1.25rem, 5vw, 2.5rem)',
        position: 'relative'
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: '4px'
        }}>
          <X size={20} />
        </button>

        {done ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <CheckCircle2 size={56} color="#22c55e" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Treino Registado! 🎉</h3>
            <p style={{ opacity: 0.6, marginTop: '0.5rem' }}>
              O Treinador vai usar este feedback para a próxima semana.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                padding: '4px 12px', borderRadius: '2rem',
                fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem'
              }}>
                <Flame size={14} /> Feedback do Treino
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                Como correu?
              </h2>
              {workoutFocus && (
                <p style={{ opacity: 0.55, fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {workoutFocus}
                </p>
              )}
            </div>

            {summary.planned > 0 && summary.done > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.5rem', padding: '0.9rem', background: 'var(--surface-color)', borderRadius: '1rem', textAlign: 'center' }}>
                {[
                  { label: 'Séries', value: `${summary.done}/${summary.planned}` },
                  { label: 'Volume', value: summary.volume ? `${summary.volume.toLocaleString('pt-PT')} kg` : '—' },
                  { label: 'Cumprimento', value: `${summary.compliance}%` }
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{m.label}</div>
                    <div style={{ fontWeight: 900, fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Como te sentiste? */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block', marginBottom: '0.75rem' }}>
                Como te sentiste?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
                {FEELINGS.map(f => (
                  <button
                    key={f.v}
                    onClick={() => setFeel(feel === f.v ? null : f.v)}
                    aria-pressed={feel === f.v}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      padding: '0.55rem 0.2rem', borderRadius: '0.85rem', cursor: 'pointer',
                      border: `2px solid ${feel === f.v ? 'var(--primary-color)' : 'var(--surface-color)'}`,
                      background: feel === f.v ? 'var(--primary-glow)' : 'transparent',
                      transition: 'all 0.15s ease', font: 'inherit'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem', lineHeight: 1, filter: feel && feel !== f.v ? 'grayscale(1)' : 'none', opacity: feel && feel !== f.v ? 0.5 : 1 }}>{f.emoji}</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: feel === f.v ? 'var(--primary-color)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.1 }}>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* RPE Slider */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '0.75rem'
              }}>
                <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  Esforço Percebido (RPE)
                </label>
                <span style={{
                  fontSize: '1.4rem', fontWeight: 900,
                  color: RPE_COLORS[rpe]
                }}>
                  {rpe}
                </span>
              </div>

              {/* Visual RPE bar */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)',
                gap: '4px', marginBottom: '0.75rem'
              }}>
                {[1,2,3,4,5,6,7,8,9,10].map(val => (
                  <button
                    key={val}
                    onClick={() => setRpe(val)}
                    style={{
                      height: '32px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: val <= rpe ? RPE_COLORS[rpe] : 'var(--surface-color)',
                      opacity: val <= rpe ? 1 : 0.3,
                      transition: 'all 0.15s ease',
                      transform: val === rpe ? 'scaleY(1.15)' : 'scaleY(1)'
                    }}
                  />
                ))}
              </div>

              <p style={{
                textAlign: 'center', fontSize: '0.9rem', fontWeight: 600,
                color: RPE_COLORS[rpe]
              }}>
                {RPE_LABELS[rpe]}
              </p>
            </div>

            {/* Completou */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block', marginBottom: '0.75rem' }}>
                Completaste tudo?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { val: true, label: '✅ Sim, tudo!', color: '#22c55e' },
                  { val: false, label: '⚡ Parcialmente', color: '#f97316' }
                ].map(opt => (
                  <button
                    key={String(opt.val)}
                    onClick={() => setCompleted(opt.val)}
                    style={{
                      padding: '0.875rem',
                      borderRadius: '0.75rem',
                      border: `2px solid ${completed === opt.val ? opt.color : 'var(--surface-color)'}`,
                      background: completed === opt.val ? opt.color + '15' : 'transparent',
                      color: completed === opt.val ? opt.color : 'var(--text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '0.9rem'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duração real */}
            <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <label htmlFor="fb-duration" style={{ fontWeight: 700, fontSize: '0.95rem' }}>Duração real</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  id="fb-duration" type="number" inputMode="numeric" min="1" max="600"
                  value={duration} onChange={e => setDuration(e.target.value)}
                  style={{ width: '90px', padding: '0.6rem', borderRadius: '0.75rem', border: '2px solid var(--surface-color)', background: 'var(--surface-color)', color: 'var(--text-main)', fontWeight: 900, fontSize: '1.1rem', textAlign: 'center' }}
                />
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>min</span>
              </div>
            </div>

            {/* Notas */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                fontWeight: 700, fontSize: '0.95rem',
                display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem'
              }}>
                <MessageSquare size={16} /> Notas <span style={{ opacity: 0.45, fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                className="input-textarea"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Aumentei o peso no hip thrust, joelho ok, faltou energia no final..."
                style={{ width: '100%', padding: '1rem', fontSize: '0.9rem', resize: 'vertical' }}
              />
            </div>

            {/* Submit */}
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSaving}
              style={{ height: '56px', fontSize: '1rem' }}
            >
              {isSaving ? 'A guardar...' : '💾 Guardar Feedback'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
