import { useState, useEffect } from 'react'
import { Save, User, Key, ShieldCheck, ChevronLeft, Users, QrCode, Music } from 'lucide-react'
import { apiFetch } from '../lib/api'

export default function SettingsView({ onBack, onSave, onSwitchView, user }) {
    const [profile, setProfile] = useState(() => {
        const saved = localStorage.getItem('user_profile')
        return saved ? JSON.parse(saved) : { gender: 'homem', level: 'iniciante', environment: 'ginasio', homeEquipment: [] }
    })

    const EQUIPMENT_OPTIONS = [
        { id: 'halteres', name: 'Halteres' },
        { id: 'barra olímpica', name: 'Barra Olímpica' },
        { id: 'barra de pull-ups', name: 'Barra de Pull-ups' },
        { id: 'kettlebells', name: 'Kettlebells' },
        { id: 'bicicleta estática', name: 'Bicicleta Estática' },
        { id: 'passadeira', name: 'Passadeira' },
        { id: 'remo', name: 'Remo' },
        { id: 'caixa', name: 'Caixa (Box Jump)' },
        { id: 'elásticos', name: 'Elásticos' },
        { id: 'banco', name: 'Banco' },
        { id: 'bola medicinal', name: 'Bola Medicinal' }
    ]

    const toggleHomeEquipment = (eqId) => {
        const current = profile.homeEquipment || [];
        if (current.includes(eqId)) {
            setProfile({ ...profile, homeEquipment: current.filter(e => e !== eqId) });
        } else {
            setProfile({ ...profile, homeEquipment: [...current, eqId] });
        }
    }

    const [keys, setKeys] = useState(() => {
        const saved = localStorage.getItem('ai_keys')
        return saved ? JSON.parse(saved) : { openai: '', gemini: '', pollination: '' }
    })

    const [spotifyUrl, setSpotifyUrl] = useState(() => {
        // Prioridade: user_profile > fitUser.profile > chave antiga
        try {
            const p1 = JSON.parse(localStorage.getItem('user_profile') || '{}')
            if (p1.spotifyUrl) return p1.spotifyUrl
            const u = JSON.parse(localStorage.getItem('fitUser') || '{}')
            if (u.profile?.spotifyUrl) return u.profile.spotifyUrl
        } catch {}
        return localStorage.getItem('fittraining_spotify_url') || ''
    })
    const [profileLoading, setProfileLoading] = useState(true)

    // Buscar sempre o perfil fresco do servidor ao entrar nos Ajustes
    useEffect(() => {
        let cancelled = false
        setProfileLoading(true)
        apiFetch('/auth/profile')
            .then(async r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`)
                return r.json()
            })
            .then(data => {
                if (cancelled) return
                console.log('[SettingsView] profile loaded from server:', data?.profile)
                if (data?.profile) {
                    const p = data.profile
                    setProfile(prev => ({ ...prev, ...p }))
                    setSpotifyUrl(p.spotifyUrl || '')
                    localStorage.setItem('user_profile', JSON.stringify(p))
                    if (p.spotifyUrl) localStorage.setItem('fittraining_spotify_url', p.spotifyUrl)
                    else localStorage.removeItem('fittraining_spotify_url')
                    // Também atualizar fitUser para consistência
                    try {
                        const u = JSON.parse(localStorage.getItem('fitUser') || '{}')
                        u.profile = p
                        localStorage.setItem('fitUser', JSON.stringify(u))
                    } catch {}
                }
            })
            .catch(err => console.warn('[SettingsView] failed to fetch profile:', err))
            .finally(() => { if (!cancelled) setProfileLoading(false) })
        return () => { cancelled = true }
    }, [])

    const [testing, setTesting] = useState(null)

    const testKey = async (provider) => {
        const key = keys[provider]
        if (!key) return alert("Por favor insira a chave primeiro.")

        setTesting(provider)
        try {
            const response = await apiFetch('/test-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, apiKey: key })
            })
            const data = await response.json()
            if (response.ok) alert(data.message)
            else throw new Error(data.error)
        } catch (err) {
            alert("Erro no teste: " + err.message)
        } finally {
            setTesting(null)
        }
    }

    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            // 1. Save local Fallback
            const trimmedSpotify = spotifyUrl.trim()
            const profileWithSpotify = { ...profile, spotifyUrl: trimmedSpotify }

            localStorage.setItem('user_profile', JSON.stringify(profileWithSpotify))
            localStorage.setItem('ai_keys', JSON.stringify(keys))
            if (trimmedSpotify) localStorage.setItem('fittraining_spotify_url', trimmedSpotify)
            else localStorage.removeItem('fittraining_spotify_url')

            // 2. Sync Profile (incluindo Spotify URL) to DB
            const res = await apiFetch('/auth/profile', {
                method: 'PATCH',
                body: JSON.stringify({ profile: profileWithSpotify })
            })

            if (!res.ok) console.warn("Central sync failed, but local storage is updated.")

            onSave({ profile, keys })
            alert("Configurações guardadas e sincronizadas com sucesso!")
            onBack()
        } catch (err) {
            console.error("Save sync error:", err)
            onSave({ profile, keys })
            alert("Configurações guardadas localmente.")
            onBack()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="settings-view animate-fade">
            <header style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={onBack} className="chip" style={{ borderRadius: '1rem', padding: '0.6rem' }}>
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.2rem' }}>Definições</h1>
                    <p style={{ margin: 0 }}>Gere o seu perfil e chaves de IA</p>
                </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* User Profile Section */}
                <section className="premium-card" style={{ background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                        <div style={{ background: 'var(--primary-glow)', padding: '0.75rem', borderRadius: '1rem' }}>
                            <User size={24} color="var(--primary-color)" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Perfil Físico</h2>
                    </div>

                    <div className="form-group">
                        <label>Género</label>
                        <div className="chip-group" style={{ marginBottom: '1.5rem' }}>
                            <div className={`chip ${profile.gender === 'homem' ? 'active' : ''}`} style={{ padding: '0.8rem 1.5rem', flex: 1, textAlign: 'center' }} onClick={() => setProfile({ ...profile, gender: 'homem' })}>HOMEM</div>
                            <div className={`chip ${profile.gender === 'mulher' ? 'active' : ''}`} style={{ padding: '0.8rem 1.5rem', flex: 1, textAlign: 'center' }} onClick={() => setProfile({ ...profile, gender: 'mulher' })}>MULHER</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label>Nível</label>
                            <select value={profile.level} onChange={(e) => setProfile({ ...profile, level: e.target.value })}>
                                <option value="iniciante">Iniciante</option>
                                <option value="intermedio">Intermédio</option>
                                <option value="avancado">Avançado</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Ambiente</label>
                            <select value={profile.environment || 'ginasio'} onChange={(e) => setProfile({ ...profile, environment: e.target.value })}>
                                <option value="ginasio">Ginásio</option>
                                <option value="box">CrossFit Box</option>
                                <option value="casa">Home Gym</option>
                            </select>
                        </div>
                    </div>

                    {profile.environment === 'casa' && (
                        <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'var(--surface-color)', borderRadius: '1.5rem' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 800 }}>Material em Casa</label>
                            <div className="chip-group" style={{ marginTop: '1rem' }}>
                                {EQUIPMENT_OPTIONS.map(eq => (
                                    <div
                                        key={eq.id}
                                        className={`chip ${(profile.homeEquipment || []).includes(eq.id) ? 'active' : ''}`}
                                        onClick={() => toggleHomeEquipment(eq.id)}
                                    >
                                        {eq.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* Box Section */}
                <section className="premium-card" style={{ background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                        <div style={{ background: 'var(--primary-glow)', padding: '0.75rem', borderRadius: '1rem' }}>
                            <Users size={24} color="var(--primary-color)" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>A Minha Box</h2>
                    </div>

                    {!user?.boxId ? (
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                            <p style={{ opacity: 0.6, marginBottom: '1.5rem' }}>Ainda não estás associado a nenhuma Box ou Ginásio.</p>
                            <button onClick={() => onSwitchView('box')} className="btn btn-outline" style={{ borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
                                <QrCode size={18} /> Configurar Box
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: '#f8fafc', borderRadius: '1.25rem', border: '1px solid var(--primary-glow)' }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary-color)' }}>Estás Associado!</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Configurações e horários disponíveis no menu BOX.</div>
                            </div>
                            <button onClick={() => onSwitchView('box')} className="chip" style={{ background: 'var(--primary-color)', color: 'white', padding: '0.5rem 1rem' }}>
                                Ir para a Box
                            </button>
                        </div>
                    )}
                </section>

                {/* Música Section */}
                <section className="premium-card" style={{ background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(255,0,0,0.12), rgba(30,215,96,0.12))', padding: '0.75rem', borderRadius: '1rem' }}>
                            <Music size={24} color="#3b82f6" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Música para treino</h2>
                    </div>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', opacity: 0.65, lineHeight: 1.55 }}>
                        Cola o URL de uma playlist ou música do <strong>Spotify</strong>, <strong>YouTube</strong> ou <strong>SoundCloud</strong>. A app deteta automaticamente o serviço e mostra o leitor na TV durante o treino.
                    </p>
                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#9a3412', lineHeight: 1.5 }}>
                        💡 <strong>Dica:</strong> para música completa e gratuita, usa <strong>YouTube</strong> (playlists de treino de 1-2h) ou <strong>SoundCloud</strong> (mixes de DJ). O Spotify só reproduz 30 segundos sem sessão Premium.
                    </div>
                    <div className="form-group">
                        <label>
                            URL da playlist ou música
                            {profileLoading && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#3b82f6', fontWeight: 700 }}>a sincronizar…</span>}
                        </label>
                        <input
                            type="url"
                            value={spotifyUrl}
                            onChange={(e) => setSpotifyUrl(e.target.value)}
                            placeholder="https://www.youtube.com/playlist?list=... ou spotify.com/... ou soundcloud.com/..."
                            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
                        />
                    </div>
                </section>

                {/* AI Configuration Section */}
                <section className="premium-card" style={{ background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                        <div style={{ background: 'var(--surface-color)', padding: '0.75rem', borderRadius: '1rem' }}>
                            <Key size={24} color="var(--primary-color)" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Motores de IA</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {['openai', 'gemini', 'pollination'].map(provider => (
                            <div key={provider} className="form-group">
                                <label style={{ textTransform: 'capitalize' }}>{provider} Key</label>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input
                                        type="password"
                                        value={keys[provider]}
                                        onChange={(e) => setKeys({ ...keys, [provider]: e.target.value })}
                                        placeholder={provider === 'openai' ? 'sk-...' : provider === 'gemini' ? 'AIza...' : 'Chave Pollinations'}
                                        style={{ flex: 1 }}
                                    />
                                    <button className="btn btn-outline" style={{ width: 'auto', padding: '0 1rem' }} onClick={() => testKey(provider)} disabled={!!testing}>
                                        {testing === provider ? '...' : 'Testar'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <button onClick={handleSave} className="btn btn-primary" style={{ height: '64px', fontSize: '1.1rem' }}>
                    Guardar Alterações <Save size={20} />
                </button>

                <footer style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.85rem', padding: '1rem' }}>
                    <ShieldCheck size={16} /> Segurança: As suas chaves são armazenadas localmente no navegador.
                </footer>
            </div>
        </div>
    )
}
