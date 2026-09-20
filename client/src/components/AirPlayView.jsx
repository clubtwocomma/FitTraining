import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Tv2, Copy, Check, ExternalLink, Loader2 } from 'lucide-react'
import QRCode from 'qrcode'
import { apiFetch } from '../lib/api'

function tvPageUrl(code) {
    return `${location.origin}${location.pathname}?tv=${code}`
}

export default function AirPlayView({ data, onClose }) {
    const [code, setCode] = useState(null)
    const [qr, setQr] = useState(null)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    useEffect(() => {
        let cancelled = false
        const savedProfile = localStorage.getItem('user_profile')
        const profile = savedProfile ? JSON.parse(savedProfile) : {}
        const spotifyUrl = profile.spotifyUrl || localStorage.getItem('fittraining_spotify_url') || ''
        apiFetch('/tv-share', {
            method: 'POST',
            body: JSON.stringify({ workout: { ...data, spotifyUrl } })
        })
            .then(r => r.json())
            .then(res => {
                if (cancelled) return
                if (res.code) setCode(res.code)
                else setError(res.error || 'Erro ao criar sala')
            })
            .catch(err => !cancelled && setError(err.message))
        return () => { cancelled = true }
    }, [data])

    useEffect(() => {
        if (!code) return
        QRCode.toDataURL(tvPageUrl(code), { width: 260, margin: 2, color: { dark: '#0a0f1e', light: '#ffffff' } })
            .then(setQr).catch(() => {})
    }, [code])

    const copyUrl = () => {
        if (!code) return
        navigator.clipboard.writeText(tvPageUrl(code)).then(() => {
            setCopied(true); setTimeout(() => setCopied(false), 2000)
        })
    }

    const openInNewWindow = () => {
        if (!code) return
        window.open(tvPageUrl(code), '_blank')
    }

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
            zIndex: 99999, background: '#0a0f1e', color: 'white',
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            overflowY: 'scroll', WebkitOverflowScrolling: 'touch'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0, zIndex: 10 }}>
                {onClose && (
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.6rem', color: 'white', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <X size={18} />
                    </button>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', opacity: 0.35, textTransform: 'uppercase' }}>FitTraining · Abrir na TV</div>
                    <div style={{ fontWeight: 900, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {data?.boxWod ? data.title : (data?.summary?.structure || 'Treino')}
                    </div>
                </div>
            </div>

            <div style={{ padding: '1.5rem 1.25rem', paddingBottom: '4rem' }}>

                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem' }}>
                        Erro: {error}
                    </div>
                )}

                {!code && !error && (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />
                        <p style={{ marginTop: '1rem', opacity: 0.5 }}>A preparar URL...</p>
                    </div>
                )}

                {code && (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <Tv2 size={48} color="#3b82f6" style={{ margin: '0 auto 0.75rem' }} />
                            <h2 style={{ margin: '0 0 0.5rem', fontWeight: 900, fontSize: '1.4rem' }}>Abre este URL na TV</h2>
                            <p style={{ fontSize: '0.9rem', opacity: 0.6, lineHeight: 1.55, margin: 0 }}>
                                No browser da TV (Smart TV, Fire TV, Chromecast com Google TV, ou portátil ligado por HDMI), abre este URL. O treino e o timer aparecem em ecrã inteiro.
                            </p>
                        </div>

                        {/* QR Code */}
                        {qr && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'white', borderRadius: '1rem', padding: '0.75rem' }}>
                                    <img src={qr} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
                                </div>
                            </div>
                        )}

                        {/* Code */}
                        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.7rem', opacity: 0.4, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Código da sala</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '0.25em', fontFamily: 'monospace', color: '#3b82f6' }}>{code}</div>
                        </div>

                        {/* URL box */}
                        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '0.75rem', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ flex: 1, fontSize: '0.8rem', fontFamily: 'monospace', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tvPageUrl(code)}
                            </div>
                            <button onClick={copyUrl} style={{ background: copied ? '#22c55e' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.5rem', color: 'white', padding: '0.45rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>

                        {/* Open in new window */}
                        <button
                            onClick={openInNewWindow}
                            style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.9rem', padding: '1rem', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 6px 20px rgba(59,130,246,0.3)' }}
                        >
                            <ExternalLink size={18} /> Abrir agora numa nova janela
                        </button>

                        <p style={{ fontSize: '0.75rem', opacity: 0.4, textAlign: 'center', marginTop: '1.5rem', lineHeight: 1.55 }}>
                            O URL fica ativo durante 6 horas. O timer é controlado no dispositivo onde abrires o URL.
                        </p>
                    </>
                )}
            </div>
        </div>,
        document.body
    )
}
