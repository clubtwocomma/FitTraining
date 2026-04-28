import React, { useState, useRef, useEffect } from 'react'
import { Share2, Copy, CheckCheck, X } from 'lucide-react'
import { shareWod } from '../lib/shareWod'

/**
 * ShareMenu — Botão de partilha com dropdown para WhatsApp, Telegram, Copiar e Partilha Nativa.
 *
 * Props:
 *   wod     — Objeto WOD completo
 *   type    — 'girl' | 'hero' | 'painstorm'
 *   accent  — Cor principal (hex ou var CSS)
 *   variant — 'light' | 'dark' (para adaptar ao fundo do card)
 */
export default function ShareMenu({ wod, type, accent = 'var(--primary-color)', variant = 'light' }) {
    const [open, setOpen] = useState(false)
    const [feedback, setFeedback] = useState(null) // null | 'copied' | 'shared' | 'error'
    const ref = useRef(null)

    // Fecha ao clicar fora
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleShare = async (method) => {
        setOpen(false)
        try {
            await shareWod(wod, type, method)
            if (method === 'copy') {
                setFeedback('copied')
                setTimeout(() => setFeedback(null), 2500)
            } else if (method === 'native') {
                setFeedback('shared')
                setTimeout(() => setFeedback(null), 2500)
            }
        } catch (err) {
            if (err.message === 'copy_fallback') {
                setFeedback('copied')
                setTimeout(() => setFeedback(null), 2500)
            }
        }
    }

    const isDark = variant === 'dark'
    const btnBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'
    const btnColor = isDark ? 'white' : accent
    const menuBg = isDark ? '#1e293b' : 'white'
    const menuBorder = isDark ? '#334155' : '#e2e8f0'
    const menuColor = isDark ? 'white' : '#1e293b'
    const menuHover = isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc'

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
            {/* Trigger button */}
            <button
                onClick={() => setOpen(o => !o)}
                title="Partilhar WOD"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.7rem 1.2rem',
                    borderRadius: '1rem',
                    border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : accent}`,
                    background: btnBg,
                    color: btnColor,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    transition: 'all 0.18s',
                    backdropFilter: 'blur(8px)',
                    whiteSpace: 'nowrap',
                }}
            >
                {feedback === 'copied' ? (
                    <><CheckCheck size={18} style={{ color: '#22c55e' }} /> Copiado!</>
                ) : feedback === 'shared' ? (
                    <><CheckCheck size={18} style={{ color: '#22c55e' }} /> Partilhado!</>
                ) : (
                    <><Share2 size={18} /> Partilhar</>
                )}
            </button>

            {/* Dropdown menu */}
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        right: 0,
                        background: menuBg,
                        border: `1px solid ${menuBorder}`,
                        borderRadius: '1.25rem',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
                        minWidth: '210px',
                        zIndex: 9000,
                        overflow: 'hidden',
                        animation: 'slideUp 0.18s ease',
                    }}
                >
                    <div style={{ padding: '0.75rem 1rem 0.5rem', borderBottom: `1px solid ${menuBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: menuColor, opacity: 0.5 }}>
                            Partilhar WOD
                        </span>
                        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: menuColor, opacity: 0.4, padding: 0 }}>
                            <X size={16} />
                        </button>
                    </div>

                    {/* WhatsApp */}
                    <MenuItem
                        icon="📲"
                        label="WhatsApp"
                        sublabel="Enviar via WhatsApp"
                        accentColor="#25D366"
                        menuColor={menuColor}
                        hoverBg={menuHover}
                        onClick={() => handleShare('whatsapp')}
                    />

                    {/* Telegram */}
                    <MenuItem
                        icon="✈️"
                        label="Telegram"
                        sublabel="Enviar via Telegram"
                        accentColor="#229ED9"
                        menuColor={menuColor}
                        hoverBg={menuHover}
                        onClick={() => handleShare('telegram')}
                    />

                    {/* Web Share (nativo — só aparece se suportado) */}
                    {typeof navigator !== 'undefined' && !!navigator.share && (
                        <MenuItem
                            icon="📤"
                            label="Outras Apps"
                            sublabel="WhatsApp, Instagram, Mail..."
                            accentColor={accent}
                            menuColor={menuColor}
                            hoverBg={menuHover}
                            onClick={() => handleShare('native')}
                        />
                    )}

                    {/* Copiar */}
                    <MenuItem
                        icon="📋"
                        label="Copiar Texto"
                        sublabel="Copia para a área de transferência"
                        accentColor="#6366f1"
                        menuColor={menuColor}
                        hoverBg={menuHover}
                        onClick={() => handleShare('copy')}
                        isLast
                    />
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}

function MenuItem({ icon, label, sublabel, accentColor, menuColor, hoverBg, onClick, isLast }) {
    const [hovered, setHovered] = useState(false)
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '0.8rem 1rem',
                background: hovered ? hoverBg : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
                borderBottom: isLast ? 'none' : `1px solid ${hoverBg}`,
            }}
        >
            <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: `${accentColor}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: menuColor }}>{label}</div>
                <div style={{ fontSize: '0.72rem', color: menuColor, opacity: 0.5 }}>{sublabel}</div>
            </div>
        </button>
    )
}
