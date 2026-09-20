import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, Loader2, AlertCircle, Zap, Clock, Flag, Save, X, Plus, Minus, CheckCircle2, Repeat, Settings, ChevronDown, ChevronRight, Music } from 'lucide-react'
import { apiFetch } from '../lib/api'

/* ═══════════════════════════════════════════════════════════════
   AUDIO — beeps altos e ricos (dois osciladores em uníssono/oitava,
   ondas quadradas, envelopes com attack rápido para máximo punch).
   ═══════════════════════════════════════════════════════════════ */
function createBeeper() {
    let ctx = null
    let master = null
    const ensure = () => {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext
            if (!AC) return null
            ctx = new AC()
            master = ctx.createGain()
            master.gain.value = 1.0
            master.connect(ctx.destination)
        }
        if (ctx.state === 'suspended') ctx.resume()
        return ctx
    }

    const tone = (freq, duration, type = 'square', volume = 0.55, offsetSec = 0) => {
        const c = ensure()
        if (!c) return
        const start = c.currentTime + offsetSec
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, start)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.008)
        gain.gain.setValueAtTime(volume, start + Math.max(duration - 0.04, 0.02))
        gain.gain.exponentialRampToValueAtTime(0.0005, start + duration)
        osc.connect(gain).connect(master)
        osc.start(start)
        osc.stop(start + duration + 0.05)
    }

    const layered = (freqs, duration, type = 'square', vol = 0.5, offset = 0) => {
        freqs.forEach((f, i) => tone(f, duration, type, vol * (i === 0 ? 1 : 0.7), offset))
    }

    return {
        unlock: ensure,
        // Tick agudo e cortante nos últimos 3s
        countdownTick: () => {
            layered([1200, 2400], 0.14, 'square', 0.7)
        },
        // Gongo forte no arranque do trabalho
        goSound: () => {
            layered([440, 880], 0.35, 'square', 0.75)
            layered([660, 1320], 0.55, 'square', 0.65, 0.12)
        },
        // Apito de mudança de minuto (EMOM)
        minuteMark: () => {
            layered([1000, 2000], 0.22, 'square', 0.75)
            layered([1500, 3000], 0.28, 'square', 0.6, 0.13)
        },
        // Início de descanso (grave)
        restStart: () => {
            layered([300, 600], 0.4, 'triangle', 0.75)
            tone(200, 0.5, 'triangle', 0.55, 0.08)
        },
        // Início do trabalho (agudo, urgente)
        workStart: () => {
            layered([880, 1760], 0.3, 'square', 0.8)
            layered([1320, 2640], 0.28, 'square', 0.6, 0.08)
        },
        // Pausa entre sets (Tabata)
        setBreak: () => {
            tone(500, 0.35, 'triangle', 0.7)
            tone(400, 0.35, 'triangle', 0.7, 0.2)
            tone(300, 0.4, 'triangle', 0.7, 0.4)
        },
        // Fanfarra final
        finish: () => {
            layered([523, 1046], 0.22, 'square', 0.7)
            layered([659, 1318], 0.22, 'square', 0.7, 0.18)
            layered([784, 1568], 0.5, 'square', 0.8, 0.36)
        },
    }
}

/* ═══════════════════════════════════════════════════════════════
   WAKE LOCK — mantém o ecrã ligado, com re-aquisição no visibilitychange
   ═══════════════════════════════════════════════════════════════ */
function useWakeLock(active) {
    const sentinelRef = useRef(null)

    useEffect(() => {
        if (!active) return
        if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

        let cancelled = false

        const acquire = async () => {
            try {
                if (sentinelRef.current) return
                sentinelRef.current = await navigator.wakeLock.request('screen')
                sentinelRef.current.addEventListener('release', () => {
                    sentinelRef.current = null
                })
            } catch { /* silent fallback */ }
        }

        const onVisibility = () => {
            if (document.visibilityState === 'visible' && !cancelled) acquire()
        }

        acquire()
        document.addEventListener('visibilitychange', onVisibility)

        return () => {
            cancelled = true
            document.removeEventListener('visibilitychange', onVisibility)
            if (sentinelRef.current) {
                sentinelRef.current.release().catch(() => { })
                sentinelRef.current = null
            }
        }
    }, [active])
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function formatMs(ms) {
    if (ms < 0) ms = 0
    const total = Math.floor(ms / 1000)
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function vibrate(pattern) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(pattern) } catch { /* fallback silencioso */ }
    }
}

// Playlists que o YouTube nunca deixa embeber (Ver mais tarde, Gostos, mixes
// automáticos "RD..."). Se as mandarmos para o iframe, o player devolve erro 153/150.
function isPrivateYtList(listId) {
    return /^(WL|LL|TL)/.test(listId) || /^RD/.test(listId)
}

// O player embebido do YouTube exige um Referer válido e, quando presente, um
// `origin` coerente — sem isso rebenta com "Erro 153: erro de configuração do
// leitor de vídeo". Ver também o referrerPolicy no helmet (server/server.js).
function ytEmbedUrl(path, params = {}) {
    const origin = typeof location !== 'undefined' ? location.origin : ''
    const query = new URLSearchParams({
        rel: '0',
        playsinline: '1',
        ...(origin ? { origin, widget_referrer: origin } : {}),
        ...params,
    })
    return `https://www.youtube.com/embed/${path}?${query}`
}

function detectMusicEmbed(url) {
    if (!url) return null
    const trimmed = url.trim()
    const spotify = trimmed.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|track|album|show|episode|artist)\/([A-Za-z0-9]+)/)
    if (spotify) return { provider: 'Spotify', color: '#1ed760', embedUrl: `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}?utm_source=fittraining`, height: 80, pageUrl: trimmed }
    const listMatch = trimmed.match(/[?&]list=([A-Za-z0-9_-]+)/)
    const listId = listMatch && !isPrivateYtList(listMatch[1]) ? listMatch[1] : null
    // Com playlist pedimos shuffle e a JS API, para arrancar numa faixa ao acaso
    // em vez de repetir sempre a primeira (ver useShuffledPlaylist).
    const listParams = listId ? { list: listId, shuffle: '1', enablejsapi: '1' } : {}
    if (/youtube\.com\/playlist/.test(trimmed) && listMatch) {
        const yt = { provider: 'YouTube', color: '#ff0000', height: 220, pageUrl: trimmed }
        // listType=playlist em vez do antigo /embed/videoseries, que o YouTube
        // já não serve de forma fiável em browsers de TV.
        return listId ? { ...yt, shuffle: true, embedUrl: ytEmbedUrl('', { listType: 'playlist', ...listParams }) } : yt
    }
    const ytVideo = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/)
    if (ytVideo) {
        return {
            provider: 'YouTube', color: '#ff0000', height: 220, pageUrl: trimmed, shuffle: !!listId,
            embedUrl: ytEmbedUrl(ytVideo[1], listParams),
        }
    }
    if (/soundcloud\.com\//.test(trimmed) && !trimmed.includes('/embed/')) {
        return { provider: 'SoundCloud', color: '#ff5500', embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`, height: 120, pageUrl: trimmed }
    }
    return null
}

/* ═══════════════════════════════════════════════════════════════
   YOUTUBE — arranque aleatório da playlist
   O parâmetro `shuffle=1` do embed só baralha a ordem *a seguir* à
   primeira faixa, por isso usamos a IFrame API para saltar logo para
   uma posição ao acaso. Se a API não carregar, o embed continua a
   funcionar — apenas sem o salto inicial.
   ═══════════════════════════════════════════════════════════════ */
let ytApiPromise = null
function loadYouTubeApi() {
    if (typeof window === 'undefined') return Promise.reject(new Error('sem window'))
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
    if (!ytApiPromise) {
        ytApiPromise = new Promise((resolve, reject) => {
            const previous = window.onYouTubeIframeAPIReady
            window.onYouTubeIframeAPIReady = () => {
                if (typeof previous === 'function') previous()
                resolve(window.YT)
            }
            const script = document.createElement('script')
            script.src = 'https://www.youtube.com/iframe_api'
            script.async = true
            script.onerror = () => { ytApiPromise = null; reject(new Error('IFrame API indisponível')) }
            document.head.appendChild(script)
        })
    }
    return ytApiPromise
}

function useShuffledPlaylist(enabled) {
    const frameRef = useRef(null)
    useEffect(() => {
        const iframe = frameRef.current
        if (!enabled || !iframe) return
        let cancelled = false
        let jumped = false
        // A playlist nem sempre está carregada no onReady; tentamos outra vez
        // na primeira mudança de estado do player.
        const jumpToRandom = target => {
            if (jumped) return
            try {
                target.setShuffle(true)
                const list = target.getPlaylist()
                if (!list || list.length < 2) return
                jumped = true
                target.playVideoAt(Math.floor(Math.random() * list.length))
            } catch { /* player ainda não pronto — tenta no próximo evento */ }
        }
        loadYouTubeApi().then(YT => {
            if (cancelled || !frameRef.current) return
            // Não guardamos o player para destruir: o destroy() da API remove o
            // iframe à revelia do React. Basta desistir dos callbacks.
            new YT.Player(iframe, {
                events: {
                    onReady: e => !cancelled && jumpToRandom(e.target),
                    onStateChange: e => !cancelled && jumpToRandom(e.target),
                },
            })
        }).catch(() => { /* fica só com o shuffle=1 do URL */ })
        return () => { cancelled = true }
    }, [enabled])
    return frameRef
}

/* ═══════════════════════════════════════════════════════════════
   TIMER — modos, presets, cores
   ═══════════════════════════════════════════════════════════════ */
const MODES = { AMRAP: 'AMRAP', FOR_TIME: 'FOR_TIME', EMOM: 'EMOM', TABATA: 'TABATA' }

const MODE_META = {
    AMRAP: { label: 'AMRAP', icon: Repeat, color: '#22c55e' },
    FOR_TIME: { label: 'FOR TIME', icon: Flag, color: '#f97316' },
    EMOM: { label: 'EMOM', icon: Clock, color: '#3b82f6' },
    TABATA: { label: 'TABATA', icon: Zap, color: '#a855f7' },
}

const DEFAULT_CONFIGS = {
    AMRAP: { mode: MODES.AMRAP, countdownSec: 10, totalMinutes: 12 },
    FOR_TIME: { mode: MODES.FOR_TIME, countdownSec: 10, useCap: false, capMinutes: 15 },
    EMOM: { mode: MODES.EMOM, countdownSec: 10, intervalSec: 60, rounds: 10, alternated: false, labelA: 'Exercício A', labelB: 'Exercício B' },
    TABATA: { mode: MODES.TABATA, countdownSec: 10, workSec: 20, restSec: 10, roundsPerSet: 8, sets: 1, setRestSec: 60 },
}

const BUILT_IN_PRESETS = [
    { id: 'tabata_classic', name: 'Tabata Clássico', config: { ...DEFAULT_CONFIGS.TABATA } },
    { id: 'emom_10', name: 'EMOM 10', config: { ...DEFAULT_CONFIGS.EMOM, rounds: 10, alternated: false } },
    { id: 'emom_20_alt', name: 'EMOM 20 alternado', config: { ...DEFAULT_CONFIGS.EMOM, rounds: 20, alternated: true, labelA: 'Exercício A', labelB: 'Exercício B' } },
    { id: 'amrap_12', name: 'AMRAP 12', config: { ...DEFAULT_CONFIGS.AMRAP, totalMinutes: 12 } },
    { id: 'amrap_20', name: 'AMRAP 20', config: { ...DEFAULT_CONFIGS.AMRAP, totalMinutes: 20 } },
    { id: 'ft_15', name: 'For Time cap 15', config: { ...DEFAULT_CONFIGS.FOR_TIME, useCap: true, capMinutes: 15 } },
]

const PHASE_COLORS = {
    idle: '#0a0f1e',
    countdown: '#facc15',
    work: '#22c55e',
    rest: '#ef4444',
    setRest: '#a855f7',
    done: '#3b82f6',
}

const PHASE_LABELS = {
    idle: 'PRONTO',
    countdown: 'PREPARAÇÃO',
    work: 'TRABALHO',
    rest: 'DESCANSO',
    setRest: 'INTERVALO DE SET',
    done: 'CONCLUÍDO',
}

/* ═══════════════════════════════════════════════════════════════
   TVVIEW
   ═══════════════════════════════════════════════════════════════ */
export default function TvView({ code }) {
    const [workout, setWorkout] = useState(null)
    const [canSaveResult, setCanSaveResult] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        apiFetch(`/tv-share/${code}`)
            .then(async r => {
                if (r.status === 410) throw new Error('Este treino já foi registado e a sala foi fechada')
                if (!r.ok) throw new Error(r.status === 404 ? `Sala ${code} não encontrada ou expirada` : 'Erro ao carregar treino')
                return r.json()
            })
            .then(res => { setWorkout(res.workout); setCanSaveResult(!!res.canSaveResult) })
            .catch(err => setError(err.message))
    }, [code])

    if (error) return <FullScreenMessage><AlertCircle size={64} color="#ef4444" /><h2 style={h2Style}>{error}</h2><p style={{ opacity: 0.5 }}>Gera um novo código no telemóvel.</p></FullScreenMessage>
    if (!workout) return <FullScreenMessage><Loader2 size={64} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} /><p style={{ marginTop: '1rem', fontSize: '1.2rem', opacity: 0.5 }}>A carregar treino...</p></FullScreenMessage>

    return <TvViewInner workout={workout} shareCode={code} canSaveResult={canSaveResult} />
}

// O nome do WOD vive num campo diferente conforme a origem do treino: `title`
// no WOD da box, `focus` nos benchmarks (Murph, Fran, ...), `name` na biblioteca
// pessoal e `summary.title` no que a IA gera. A `summary.structure` ("For Time",
// "10 Rounds") é o formato, não o nome — só serve de último recurso.
function wodNameOf(workout) {
    if (!workout) return 'Treino'
    if (workout.boxWod) return workout.title || 'WOD da Box'
    return workout.focus
        || workout.name
        || workout.summary?.title
        || workout.title
        || workout.summary?.structure
        || 'Treino'
}

function TvViewInner({ workout, shareCode, canSaveResult }) {
    const isBoxWod = workout.boxWod
    const wodName = wodNameOf(workout)
    // O nome manda no título; o formato ("For Time", "AMRAP 12min") e o tipo
    // descem para o subtítulo. O filtro evita repetir o nome quando não havia
    // nome nenhum e o wodNameOf caiu na própria estrutura.
    const subtitle = isBoxWod
        ? workout.stimulus
        : [workout.summary?.structure, workout.summary?.type]
            .filter(v => v && v !== wodName)
            .join(' · ') || null
    const musicEmbed = detectMusicEmbed(workout.spotifyUrl)

    return (
        <SmartTimerHost title={wodName} subtitle={subtitle} wodName={wodName} musicEmbed={musicEmbed} shareCode={shareCode} canSaveResult={canSaveResult}>
            {isBoxWod ? <BoxWodLayout data={workout} /> : <StructuredLayout data={workout} />}
        </SmartTimerHost>
    )
}

/* ═══════════════════════════════════════════════════════════════
   SMART TIMER HOST — gere estado, motor RAF, layout + fundo por fase
   ═══════════════════════════════════════════════════════════════ */
function SmartTimerHost({ title, subtitle, wodName, musicEmbed, shareCode, canSaveResult, children }) {
    // Config + refs — arranca em FOR TIME sem cap
    const [config, setConfig] = useState(DEFAULT_CONFIGS.FOR_TIME)
    const configRef = useRef(config)
    useEffect(() => { configRef.current = config }, [config])

    // Presets custom (memória de sessão)
    const [customPresets, setCustomPresets] = useState([])

    // Estado do motor
    const [running, setRunning] = useState(false)
    const runningRef = useRef(false)
    const [phase, setPhase] = useState('idle')
    const phaseRef = useRef('idle')

    const [currentRound, setCurrentRound] = useState(0)
    const currentRoundRef = useRef(0)
    const [currentSet, setCurrentSet] = useState(0)
    const currentSetRef = useRef(0)

    const [msInPhase, setMsInPhase] = useState(0)
    const [workoutMs, setWorkoutMs] = useState(0)

    const phaseStartAtRef = useRef(0)
    const phaseAccumRef = useRef(0)
    const workoutStartAtRef = useRef(0)
    const workoutAccumRef = useRef(0)

    const [manualRounds, setManualRounds] = useState(0)
    const [finalTime, setFinalTime] = useState(null)

    // Sumário no fim
    const [summary, setSummary] = useState(null)

    // Áudio + wake lock
    const beeperRef = useRef(null)
    if (!beeperRef.current) beeperRef.current = createBeeper()
    const beepsRef = useRef({})
    useWakeLock(running)

    const rafRef = useRef(null)

    // UI: opções e música colapsáveis
    const [optionsOpen, setOptionsOpen] = useState(true)
    const [musicOpen, setMusicOpen] = useState(false)
    const musicFrameRef = useShuffledPlaylist(!!(musicEmbed && musicEmbed.shuffle && musicOpen))

    // Sync helpers
    const applyPhase = useCallback((p, now) => {
        phaseRef.current = p
        setPhase(p)
        phaseStartAtRef.current = now
        phaseAccumRef.current = 0
    }, [])

    const applyRound = useCallback((r) => {
        currentRoundRef.current = r
        setCurrentRound(r)
    }, [])

    const applySet = useCallback((s) => {
        currentSetRef.current = s
        setCurrentSet(s)
    }, [])

    const manualRoundsRef = useRef(0)
    useEffect(() => { manualRoundsRef.current = manualRounds }, [manualRounds])

    // Sumário: capturar estado quando entra em 'done'
    const emitSummary = useCallback((finalMs) => {
        const conf = configRef.current
        setSummary({
            mode: conf.mode,
            durationMs: finalMs,
            round: currentRoundRef.current,
            set: currentSetRef.current,
            manualRounds: manualRoundsRef.current,
            config: conf,
        })
    }, [])

    // Terminar workout: entra em 'done', pára o RAF, dispara som/vibração/sumário
    const finalize = useCallback((finalMs, now) => {
        beeperRef.current.finish()
        vibrate([200, 100, 200, 100, 400])
        applyPhase('done', now)
        emitSummary(finalMs)
        runningRef.current = false
        setRunning(false)
    }, [applyPhase, emitSummary])

    /* ─── Motor tick — SOURCE OF TRUTH via performance.now() ─── */
    const tick = useCallback(() => {
        const now = performance.now()
        if (!runningRef.current) return
        const currentPhase = phaseRef.current
        if (currentPhase === 'idle' || currentPhase === 'done') {
            rafRef.current = requestAnimationFrame(tick)
            return
        }

        const msInPhaseNow = (now - phaseStartAtRef.current) + phaseAccumRef.current
        setMsInPhase(msInPhaseNow)

        const conf = configRef.current

        if (currentPhase === 'countdown') {
            const totalMs = conf.countdownSec * 1000
            const remSec = Math.max(0, Math.ceil((totalMs - msInPhaseNow) / 1000))
            if (remSec > 0 && remSec <= 3 && !beepsRef.current[`cd_${remSec}`]) {
                beepsRef.current[`cd_${remSec}`] = true
                beeperRef.current.countdownTick()
            }
            if (msInPhaseNow >= totalMs) {
                beeperRef.current.goSound()
                vibrate(200)
                workoutStartAtRef.current = now
                workoutAccumRef.current = 0
                setWorkoutMs(0)
                applyRound(1)
                if (conf.mode === MODES.TABATA) applySet(1)
                beepsRef.current = {}
                applyPhase('work', now)
            }
            rafRef.current = requestAnimationFrame(tick)
            return
        }

        const wMs = (now - workoutStartAtRef.current) + workoutAccumRef.current
        setWorkoutMs(wMs)

        if (conf.mode === MODES.AMRAP && currentPhase === 'work') {
            const totalMs = conf.totalMinutes * 60 * 1000
            const remSec = Math.max(0, Math.ceil((totalMs - wMs) / 1000))
            if (remSec > 0 && remSec <= 3 && !beepsRef.current[`amrap_${remSec}`]) {
                beepsRef.current[`amrap_${remSec}`] = true
                beeperRef.current.countdownTick()
            }
            if (wMs >= totalMs) {
                finalize(totalMs, now)
            }
        }
        else if (conf.mode === MODES.FOR_TIME && currentPhase === 'work') {
            if (conf.useCap && conf.capMinutes) {
                const capMs = conf.capMinutes * 60 * 1000
                const remSec = Math.max(0, Math.ceil((capMs - wMs) / 1000))
                if (remSec > 0 && remSec <= 3 && !beepsRef.current[`ft_${remSec}`]) {
                    beepsRef.current[`ft_${remSec}`] = true
                    beeperRef.current.countdownTick()
                }
                if (wMs >= capMs) {
                    setFinalTime(capMs)
                    finalize(capMs, now)
                }
            }
        }
        else if (conf.mode === MODES.EMOM && currentPhase === 'work') {
            const intervalMs = conf.intervalSec * 1000
            const totalMs = conf.rounds * intervalMs
            const curRound = Math.floor(wMs / intervalMs) + 1
            const msInInterval = wMs % intervalMs
            const remSec = Math.max(0, Math.ceil((intervalMs - msInInterval) / 1000))

            if (curRound !== currentRoundRef.current && curRound <= conf.rounds) {
                applyRound(curRound)
                beeperRef.current.minuteMark()
                vibrate(150)
                beepsRef.current = {}
            }
            if (remSec > 0 && remSec <= 3 && curRound <= conf.rounds && !beepsRef.current[`emom_${curRound}_${remSec}`]) {
                beepsRef.current[`emom_${curRound}_${remSec}`] = true
                beeperRef.current.countdownTick()
            }
            if (wMs >= totalMs) {
                finalize(totalMs, now)
            }
        }
        else if (conf.mode === MODES.TABATA) {
            const workMs = conf.workSec * 1000
            const restMs = conf.restSec * 1000
            const setRestMs = conf.setRestSec * 1000
            const target = currentPhase === 'work' ? workMs
                : currentPhase === 'rest' ? restMs
                    : currentPhase === 'setRest' ? setRestMs : 0
            const remSec = Math.max(0, Math.ceil((target - msInPhaseNow) / 1000))
            const beepKey = `tab_${currentPhase}_${currentSetRef.current}_${currentRoundRef.current}_${remSec}`
            if (remSec > 0 && remSec <= 3 && !beepsRef.current[beepKey]) {
                beepsRef.current[beepKey] = true
                beeperRef.current.countdownTick()
            }
            if (msInPhaseNow >= target) {
                beepsRef.current = {}
                if (currentPhase === 'work') {
                    const isLastRound = currentRoundRef.current >= conf.roundsPerSet
                    const isLastSet = currentSetRef.current >= conf.sets
                    if (isLastRound && isLastSet) {
                        finalize(wMs, now)
                    } else if (isLastRound && !isLastSet) {
                        if (setRestMs > 0) {
                            beeperRef.current.setBreak()
                            vibrate(200)
                            applyPhase('setRest', now)
                        } else {
                            applySet(currentSetRef.current + 1)
                            applyRound(1)
                            beeperRef.current.workStart()
                            applyPhase('work', now)
                        }
                    } else {
                        beeperRef.current.restStart()
                        applyPhase('rest', now)
                    }
                } else if (currentPhase === 'rest') {
                    applyRound(currentRoundRef.current + 1)
                    beeperRef.current.workStart()
                    vibrate(120)
                    applyPhase('work', now)
                } else if (currentPhase === 'setRest') {
                    applySet(currentSetRef.current + 1)
                    applyRound(1)
                    beeperRef.current.workStart()
                    vibrate(120)
                    applyPhase('work', now)
                }
            }
        }

        rafRef.current = requestAnimationFrame(tick)
    }, [applyPhase, applyRound, applySet, finalize])

    /* ─── Controlos ─── */
    const start = useCallback(() => {
        beeperRef.current.unlock()
        const now = performance.now()
        if (phaseRef.current === 'idle' || phaseRef.current === 'done') {
            phaseAccumRef.current = 0
            workoutAccumRef.current = 0
            phaseStartAtRef.current = now
            workoutStartAtRef.current = now
            setMsInPhase(0)
            setWorkoutMs(0)
            applyRound(0)
            applySet(0)
            setManualRounds(0)
            setFinalTime(null)
            setSummary(null)
            beepsRef.current = {}
            phaseRef.current = 'countdown'
            setPhase('countdown')
        } else {
            phaseStartAtRef.current = now
            workoutStartAtRef.current = now
        }
        runningRef.current = true
        setRunning(true)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)
    }, [tick, applyRound, applySet])

    const pause = useCallback(() => {
        if (!runningRef.current) return
        const now = performance.now()
        phaseAccumRef.current += (now - phaseStartAtRef.current)
        workoutAccumRef.current += (now - workoutStartAtRef.current)
        runningRef.current = false
        setRunning(false)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }, [])

    const reset = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        runningRef.current = false
        setRunning(false)
        phaseRef.current = 'idle'
        setPhase('idle')
        setMsInPhase(0)
        setWorkoutMs(0)
        applyRound(0)
        applySet(0)
        setManualRounds(0)
        setFinalTime(null)
        setSummary(null)
        beepsRef.current = {}
        phaseStartAtRef.current = 0
        phaseAccumRef.current = 0
        workoutStartAtRef.current = 0
        workoutAccumRef.current = 0
    }, [applyRound, applySet])

    // Repetir WOD: limpa o sumário, rearma o motor com a mesma configuração e
    // arranca outra vez (contagem decrescente incluída).
    const repeatWod = useCallback(() => {
        reset()
        start()
    }, [reset, start])

    // Fechar tudo: se a página foi aberta pela app (window.open) fecha-se a si
    // própria; caso contrário volta ao endereço da app, sem o ?tv=.
    const exitToApp = useCallback(() => {
        reset()
        if (window.opener) {
            window.close()
            // Se o browser recusar o close (política de popups), seguimos para a app.
            setTimeout(() => { window.location.href = `${location.origin}${location.pathname}` }, 200)
            return
        }
        window.location.href = `${location.origin}${location.pathname}`
    }, [reset])

    const finishForTime = useCallback(() => {
        if (configRef.current.mode !== MODES.FOR_TIME) return
        if (phaseRef.current !== 'work') return
        const now = performance.now()
        const wMs = (now - workoutStartAtRef.current) + workoutAccumRef.current
        setFinalTime(wMs)
        setWorkoutMs(wMs)
        finalize(wMs, now)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }, [finalize])

    /* ─── Mudar modo / aplicar preset ─── */
    const switchMode = useCallback((newMode) => {
        reset()
        setConfig(DEFAULT_CONFIGS[newMode])
    }, [reset])

    const applyPreset = useCallback((preset) => {
        reset()
        setConfig({ ...preset.config })
    }, [reset])

    const savePreset = useCallback((name) => {
        if (!name?.trim()) return
        const preset = { id: `custom_${Date.now()}`, name: name.trim(), config: { ...configRef.current }, custom: true }
        setCustomPresets(prev => [...prev, preset])
    }, [])

    const removePreset = useCallback((id) => {
        setCustomPresets(prev => prev.filter(p => p.id !== id))
    }, [])

    /* ─── Teclado ─── */
    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); runningRef.current ? pause() : start() }
            else if (e.key === 'Escape' || e.key === 'Backspace') reset()
            else if (e.key === 'r' || e.key === 'R') reset()
            else if (e.key === 'f' || e.key === 'F') finishForTime()
            else if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp') setManualRounds(r => r + 1)
            else if (e.key === '-' || e.key === 'ArrowDown') setManualRounds(r => Math.max(0, r - 1))
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [start, pause, reset, finishForTime])

    // Cleanup RAF ao desmontar
    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

    /* ─── Fundo por fase ─── */
    const phaseColor = PHASE_COLORS[phase] || PHASE_COLORS.idle
    const bgTint = phase === 'idle' ? '#0a0f1e'
        : `linear-gradient(180deg, ${phaseColor}33 0%, #0a0f1e 25%, #0a0f1e 75%, ${phaseColor}33 100%)`

    const canShowOptions = phase === 'idle' && !running

    return (
        <div style={{
            minHeight: '100vh', background: bgTint, color: 'white',
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            display: 'flex', flexDirection: 'column',
            transition: 'background 0.4s ease',
            boxShadow: running ? `inset 0 0 0 6px ${phaseColor}` : 'none',
        }}>
            {/* Barra ÚNICA no topo: título + música + cronómetro + controlos */}
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(to bottom, rgba(10,15,30,0.98) 0%, rgba(10,15,30,0.94) 92%, rgba(10,15,30,0) 100%)', backdropFilter: 'blur(8px)' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: musicEmbed
                        ? 'minmax(0, 1fr) auto auto'
                        : 'minmax(0, 1fr) auto',
                    alignItems: 'center', gap: '1rem',
                    padding: '0.5rem 1.15rem',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    {/* Título compacto */}
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.52rem', fontWeight: 900, letterSpacing: '0.2em', color: '#3b82f6', textTransform: 'uppercase', lineHeight: 1 }}>
                            FitTraining
                        </div>
                        <h1 style={{ margin: '0.1rem 0 0', fontSize: 'clamp(0.9rem, 1.4vw, 1.2rem)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {title}
                        </h1>
                        {subtitle && (
                            <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.1rem' }}>
                                {subtitle}
                            </div>
                        )}
                    </div>

                    {/* Botão música (toggle) — não ocupa quase nada */}
                    {musicEmbed && (
                        <button onClick={() => setMusicOpen(o => !o)} title={`${musicEmbed.provider}${musicEmbed.shuffle ? ' (aleatório)' : ''} — clica para ${musicOpen ? 'fechar' : 'abrir'}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            background: musicOpen ? `${musicEmbed.color}22` : 'rgba(255,255,255,0.05)',
                            color: musicOpen ? musicEmbed.color : 'rgba(255,255,255,0.75)',
                            border: `1px solid ${musicOpen ? `${musicEmbed.color}66` : 'rgba(255,255,255,0.12)'}`,
                            borderRadius: '0.5rem', padding: '0.4rem 0.7rem',
                            fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}>
                            <Music size={14} /> {musicEmbed.provider}
                            {musicOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                    )}

                    {/* Cronómetro + play/reset/opções inline */}
                    <TimerHeader
                        config={config}
                        phase={phase}
                        running={running}
                        msInPhase={msInPhase}
                        workoutMs={workoutMs}
                        round={currentRound}
                        setIndex={currentSet}
                        manualRounds={manualRounds}
                        finalTime={finalTime}
                        onStart={start}
                        onPause={pause}
                        onReset={reset}
                        onFinishForTime={finishForTime}
                        onManualRoundsInc={() => setManualRounds(r => r + 1)}
                        onManualRoundsDec={() => setManualRounds(r => Math.max(0, r - 1))}
                        canToggleOptions={canShowOptions}
                        optionsOpen={optionsOpen}
                        onToggleOptions={() => setOptionsOpen(o => !o)}
                    />
                </div>

                {/* Painel do player de música — colapsável */}
                {musicEmbed && musicOpen && (
                    <div style={{
                        padding: '0.55rem 1.15rem',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: 'rgba(0,0,0,0.35)',
                    }}>
                        {musicEmbed.embedUrl ? (
                            <iframe
                                ref={musicFrameRef}
                                src={musicEmbed.embedUrl}
                                title={`${musicEmbed.provider} player`}
                                width="100%"
                                height={musicEmbed.height}
                                frameBorder="0"
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                referrerPolicy="strict-origin-when-cross-origin"
                                loading="lazy"
                                style={{ borderRadius: '0.5rem', display: 'block', background: '#000', maxWidth: '720px', margin: '0 auto' }}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', padding: '0.5rem' }}>
                                Esta playlist é privada (Ver mais tarde / mix automático) e o YouTube não a deixa embeber.
                            </div>
                        )}
                        {musicEmbed.pageUrl && (
                            <div style={{ textAlign: 'center', marginTop: '0.4rem' }}>
                                <a href={musicEmbed.pageUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                                    Abrir no {musicEmbed.provider} ↗
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {/* Painel de opções — só em idle, colapsável */}
                {canShowOptions && optionsOpen && (
                    <OptionsPanel
                        config={config}
                        onConfigChange={setConfig}
                        onSwitchMode={switchMode}
                        customPresets={customPresets}
                        onApplyPreset={applyPreset}
                        onSavePreset={savePreset}
                        onRemovePreset={removePreset}
                    />
                )}
            </div>

            {/* Conteúdo do treino */}
            <div style={{ flex: 1, padding: '0.75rem 1.15rem 2rem' }}>
                {children}
            </div>

            {/* Sumário no fim */}
            {summary && (
                <SummaryOverlay
                    summary={summary}
                    workoutTitle={wodName || title}
                    shareCode={shareCode}
                    canSaveResult={canSaveResult}
                    onRepeat={repeatWod}
                    onExit={exitToApp}
                />
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   TIMER HEADER — display grande + controlos + contador manual
   ═══════════════════════════════════════════════════════════════ */
function TimerHeader({
    config, phase, running, msInPhase, workoutMs, round, setIndex,
    manualRounds, finalTime, onStart, onPause, onReset, onFinishForTime,
    onManualRoundsInc, onManualRoundsDec,
    canToggleOptions, optionsOpen, onToggleOptions,
}) {
    // Calcular display
    let big, label, sub
    const color = PHASE_COLORS[phase] || 'rgba(255,255,255,0.5)'

    if (phase === 'idle') {
        big = '00:00'
        label = 'PRONTO'
        sub = null
    } else if (phase === 'countdown') {
        const rem = Math.max(0, Math.ceil((config.countdownSec * 1000 - msInPhase) / 1000))
        big = String(rem)
        label = 'PREPARAÇÃO'
        sub = null
    } else if (phase === 'done') {
        if (config.mode === MODES.FOR_TIME && finalTime != null) {
            big = formatMs(finalTime)
            label = 'TERMINADO'
            sub = manualRounds > 0 ? `${manualRounds} rondas` : null
        } else if (config.mode === MODES.TABATA) {
            big = 'FIM'
            label = 'CONCLUÍDO'
            sub = `${config.roundsPerSet}×${config.sets} rondas`
        } else if (config.mode === MODES.EMOM) {
            big = formatMs(config.rounds * config.intervalSec * 1000)
            label = 'CONCLUÍDO'
            sub = `${config.rounds} rondas`
        } else {
            big = formatMs(config.totalMinutes * 60 * 1000)
            label = 'AMRAP TERMINADO'
            sub = `${manualRounds} rondas`
        }
    } else {
        // work / rest / setRest
        if (config.mode === MODES.AMRAP) {
            const totalMs = config.totalMinutes * 60 * 1000
            const remMs = Math.max(0, totalMs - workoutMs)
            big = formatMs(remMs)
            label = 'AMRAP · TEMPO RESTANTE'
            sub = `${manualRounds} rondas`
        } else if (config.mode === MODES.FOR_TIME) {
            big = formatMs(workoutMs)
            const isCap = config.useCap && config.capMinutes
            label = isCap ? `FOR TIME · CAP ${config.capMinutes}:00` : 'FOR TIME'
            sub = manualRounds > 0 ? `${manualRounds} rondas` : null
        } else if (config.mode === MODES.EMOM) {
            const intervalMs = config.intervalSec * 1000
            const msInInterval = workoutMs % intervalMs
            const remInInterval = Math.max(0, intervalMs - msInInterval)
            big = formatMs(remInInterval)
            const isAlt = config.alternated
            const altLabel = isAlt ? ` · ${round % 2 === 1 ? config.labelA : config.labelB}` : ''
            label = `EMOM · RONDA ${round}/${config.rounds}${altLabel}`
            sub = `Decorrido ${formatMs(workoutMs)}`
        } else if (config.mode === MODES.TABATA) {
            const target = phase === 'work' ? config.workSec * 1000
                : phase === 'rest' ? config.restSec * 1000
                    : phase === 'setRest' ? config.setRestSec * 1000 : 0
            const remMs = Math.max(0, target - msInPhase)
            big = formatMs(remMs)
            label = `${PHASE_LABELS[phase]} · RONDA ${round}/${config.roundsPerSet}${config.sets > 1 ? ` · SET ${setIndex}/${config.sets}` : ''}`
            sub = `Decorrido ${formatMs(workoutMs)}`
        }
    }

    const showManualCounter = (config.mode === MODES.AMRAP || config.mode === MODES.FOR_TIME) && (phase === 'work' || phase === 'rest' || phase === 'countdown')

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Cronómetro (direita, alinhado à direita) */}
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.15em', opacity: 0.75, color, lineHeight: 1 }}>
                    {label}
                </div>
                <div style={{
                    fontSize: 'clamp(3.7rem, 9vw, 7.6rem)', fontWeight: 900,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em',
                    color, lineHeight: 1.02, textShadow: `0 0 40px ${color}55`,
                    transition: 'color 0.25s, text-shadow 0.25s',
                }}>
                    {big}
                </div>
                {sub && (
                    <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.15rem', fontWeight: 700, lineHeight: 1 }}>
                        {sub}
                    </div>
                )}
            </div>

            {/* Contador manual de rondas (vertical compacto) */}
            {showManualCounter && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'center' }}>
                    <button onClick={onManualRoundsInc} style={{ ...roundBtn, background: '#22c55e', width: '1.75rem', height: '1.35rem' }}><Plus size={12} /></button>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, padding: '0.15rem 0.4rem', background: 'rgba(255,255,255,0.08)', borderRadius: '0.35rem', minWidth: '1.9rem', textAlign: 'center', lineHeight: 1 }}>
                        {manualRounds}
                    </div>
                    <button onClick={onManualRoundsDec} style={{ ...roundBtn, width: '1.75rem', height: '1.35rem' }}><Minus size={12} /></button>
                </div>
            )}

            {/* Play/Pause + Reset + Terminar + ⚙ Opções */}
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                {!running ? (
                    <button onClick={onStart} style={inlineCtrl('#22c55e')}>
                        <Play size={15} fill="white" /> {phase === 'idle' || phase === 'done' ? 'Iniciar' : 'Retomar'}
                    </button>
                ) : (
                    <button onClick={onPause} style={inlineCtrl('#f59e0b')}>
                        <Pause size={15} fill="white" /> Pausar
                    </button>
                )}
                {config.mode === MODES.FOR_TIME && phase === 'work' && (
                    <button onClick={onFinishForTime} style={iconBtn('#a855f7')} title="Terminar (F)"><Flag size={15} /></button>
                )}
                <button onClick={onReset} style={iconBtn('#3b82f6')} title="Reiniciar (R)"><RotateCcw size={15} /></button>
                {canToggleOptions && (
                    <button onClick={onToggleOptions} style={iconBtn('rgba(255,255,255,0.08)', true)} title="Opções">
                        <Settings size={15} />
                    </button>
                )}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   OPTIONS PANEL — horizontal, aparece por baixo da barra em idle
   ═══════════════════════════════════════════════════════════════ */
function OptionsPanel({ config, onConfigChange, onSwitchMode, customPresets, onApplyPreset, onSavePreset, onRemovePreset }) {
    const [presetsOpen, setPresetsOpen] = useState(false)

    return (
        <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.65rem 1rem',
            alignItems: 'center', justifyContent: 'flex-end',
            padding: '0.45rem 1.15rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.02)',
        }}>
            {/* Tudo encostado à direita: Modo · Config · Presets */}
            <InlineGroup title="Modo">
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                    {Object.values(MODES).map(m => (
                        <ModeInlineBtn key={m} mode={m}
                            active={config.mode === m}
                            onClick={() => onSwitchMode(m)} />
                    ))}
                </div>
            </InlineGroup>

            <InlineGroup title="Config">
                <InlineConfig config={config} onChange={onConfigChange} />
            </InlineGroup>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setPresetsOpen(o => !o)}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        background: presetsOpen ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.05)',
                        color: presetsOpen ? '#93c5fd' : 'rgba(255,255,255,0.65)',
                        border: `1px solid ${presetsOpen ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '0.35rem', padding: '0.25rem 0.55rem',
                        fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer',
                    }}>
                    {presetsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Presets ({BUILT_IN_PRESETS.length + customPresets.length})
                </button>
                {presetsOpen && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                        {BUILT_IN_PRESETS.map(p => <PresetChip key={p.id} preset={p} onApply={onApplyPreset} />)}
                        {customPresets.map(p => <PresetChip key={p.id} preset={p} custom onApply={onApplyPreset} onRemove={onRemovePreset} />)}
                        <SavePresetInline onSave={onSavePreset} />
                    </div>
                )}
            </div>
        </div>
    )
}

function InlineGroup({ title, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{
                fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.18em',
                opacity: 0.5, textTransform: 'uppercase',
            }}>
                {title}
            </div>
            {children}
        </div>
    )
}

function ModeInlineBtn({ mode, active, onClick }) {
    const meta = MODE_META[mode]
    const Icon = meta.icon
    return (
        <button onClick={onClick} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            background: active ? `${meta.color}22` : 'rgba(255,255,255,0.04)',
            color: active ? meta.color : 'rgba(255,255,255,0.7)',
            border: `1px solid ${active ? `${meta.color}66` : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '0.35rem', padding: '0.22rem 0.5rem',
            fontSize: '0.66rem', fontWeight: 900, letterSpacing: '0.03em',
            cursor: 'pointer',
        }}>
            <Icon size={11} /> {meta.label}
        </button>
    )
}

function InlineConfig({ config, onChange }) {
    const update = (patch) => onChange({ ...config, ...patch })
    return (
        <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <InlineField label="Prep">
                <SegBtn active={config.countdownSec === 3} onClick={() => update({ countdownSec: 3 })}>3s</SegBtn>
                <SegBtn active={config.countdownSec === 10} onClick={() => update({ countdownSec: 10 })}>10s</SegBtn>
            </InlineField>

            {config.mode === MODES.AMRAP && (
                <InlineField label="Dur (min)">
                    <NumInput value={config.totalMinutes} min={1} max={60} step={1} onChange={v => update({ totalMinutes: v })} />
                </InlineField>
            )}

            {config.mode === MODES.FOR_TIME && (
                <>
                    <InlineField label="Cap">
                        <SegBtn active={!config.useCap} onClick={() => update({ useCap: false })}>Off</SegBtn>
                        <SegBtn active={!!config.useCap} onClick={() => update({ useCap: true })}>On</SegBtn>
                    </InlineField>
                    {config.useCap && (
                        <InlineField label="min">
                            <NumInput value={config.capMinutes} min={1} max={60} step={1} onChange={v => update({ capMinutes: v })} />
                        </InlineField>
                    )}
                </>
            )}

            {config.mode === MODES.EMOM && (
                <>
                    <InlineField label="Int (s)">
                        <NumInput value={config.intervalSec} min={30} max={300} step={15} onChange={v => update({ intervalSec: v })} />
                    </InlineField>
                    <InlineField label="Rondas">
                        <NumInput value={config.rounds} min={1} max={60} step={1} onChange={v => update({ rounds: v })} />
                    </InlineField>
                    <InlineField label="Alt">
                        <SegBtn active={!config.alternated} onClick={() => update({ alternated: false })}>Off</SegBtn>
                        <SegBtn active={!!config.alternated} onClick={() => update({ alternated: true })}>On</SegBtn>
                    </InlineField>
                    {config.alternated && (
                        <>
                            <InlineField label="A">
                                <TextInputSmall value={config.labelA} onChange={v => update({ labelA: v })} />
                            </InlineField>
                            <InlineField label="B">
                                <TextInputSmall value={config.labelB} onChange={v => update({ labelB: v })} />
                            </InlineField>
                        </>
                    )}
                </>
            )}

            {config.mode === MODES.TABATA && (
                <>
                    <InlineField label="Work (s)">
                        <NumInput value={config.workSec} min={5} max={300} step={5} onChange={v => update({ workSec: v })} />
                    </InlineField>
                    <InlineField label="Rest (s)">
                        <NumInput value={config.restSec} min={0} max={300} step={5} onChange={v => update({ restSec: v })} />
                    </InlineField>
                    <InlineField label="Rondas/set">
                        <NumInput value={config.roundsPerSet} min={1} max={30} step={1} onChange={v => update({ roundsPerSet: v })} />
                    </InlineField>
                    <InlineField label="Sets">
                        <NumInput value={config.sets} min={1} max={10} step={1} onChange={v => update({ sets: v })} />
                    </InlineField>
                    {config.sets > 1 && (
                        <InlineField label="Set rest (s)">
                            <NumInput value={config.setRestSec} min={0} max={600} step={15} onChange={v => update({ setRestSec: v })} />
                        </InlineField>
                    )}
                </>
            )}
        </div>
    )
}

function InlineField({ label, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ fontSize: '0.62rem', opacity: 0.6, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</div>
            <div style={{ display: 'flex', gap: '0.15rem', alignItems: 'center' }}>{children}</div>
        </div>
    )
}

function PresetChip({ preset, custom, onApply, onRemove }) {
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'stretch',
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: '999px', overflow: 'hidden',
        }}>
            <button onClick={() => onApply(preset)} title={preset.name} style={{
                background: 'transparent', color: '#93c5fd', border: 'none',
                padding: '0.22rem 0.6rem', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap',
            }}>
                {preset.name}
            </button>
            {custom && (
                <button onClick={() => onRemove(preset.id)} title="Remover" style={{
                    background: 'transparent', color: 'rgba(255,255,255,0.4)',
                    border: 'none', padding: '0 0.4rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                }}>
                    <X size={10} />
                </button>
            )}
        </div>
    )
}

function SavePresetInline({ onSave }) {
    const [saving, setSaving] = useState(false)
    const [name, setName] = useState('')
    const [warned, setWarned] = useState(false)

    const doSave = () => {
        if (!name.trim()) return
        onSave(name)
        setName('')
        setSaving(false)
        setWarned(true)
    }

    if (!saving) {
        return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <button onClick={() => setSaving(true)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    background: 'transparent', color: 'rgba(255,255,255,0.55)',
                    border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '999px',
                    padding: '0.2rem 0.6rem', fontSize: '0.64rem', fontWeight: 700, cursor: 'pointer'
                }}>
                    <Save size={10} /> Guardar
                </button>
                {warned && (
                    <span style={{ fontSize: '0.6rem', color: '#fbbf24', opacity: 0.85 }}>⚠ perde-se ao fechar</span>
                )}
            </div>
        )
    }

    return (
        <div style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}>
            <input
                autoFocus value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') setSaving(false) }}
                placeholder="Nome"
                style={{
                    background: 'rgba(255,255,255,0.08)', color: 'white',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.35rem',
                    padding: '0.22rem 0.45rem', fontSize: '0.68rem', width: '110px',
                }}
            />
            <button onClick={doSave} style={{ ...roundBtn, background: '#22c55e', width: '1.35rem', height: '1.35rem' }}><Save size={10} /></button>
            <button onClick={() => setSaving(false)} style={{ ...roundBtn, width: '1.35rem', height: '1.35rem' }}><X size={10} /></button>
        </div>
    )
}

function TextInputSmall({ value, onChange }) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
                background: 'rgba(255,255,255,0.06)', color: 'white',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.3rem',
                padding: '0.18rem 0.35rem', fontSize: '0.68rem', width: '5.5rem',
            }}
        />
    )
}

/* ═══════════════════════════════════════════════════════════════
   Inputs partilhados
   ═══════════════════════════════════════════════════════════════ */
function NumInput({ value, min, max, step, onChange }) {
    const clamp = (v) => Math.min(max, Math.max(min, v))
    return (
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.3rem' }}>
            <button onClick={() => onChange(clamp(value - step))} style={numStep}><Minus size={10} /></button>
            <input
                type="number"
                value={value}
                min={min} max={max} step={step}
                onChange={e => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) onChange(clamp(n))
                }}
                style={{
                    width: '2.4rem', textAlign: 'center', background: 'transparent',
                    color: 'white', border: 'none', outline: 'none',
                    padding: '0.15rem 0', fontSize: '0.72rem', fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                }}
            />
            <button onClick={() => onChange(clamp(value + step))} style={numStep}><Plus size={10} /></button>
        </div>
    )
}

function SegBtn({ active, children, onClick }) {
    return (
        <button onClick={onClick} style={{
            background: active ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)',
            color: active ? '#93c5fd' : 'rgba(255,255,255,0.6)',
            border: `1px solid ${active ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '0.3rem', padding: '0.2rem 0.4rem', fontSize: '0.65rem',
            fontWeight: 800, cursor: 'pointer', minWidth: '1.9rem'
        }}>{children}</button>
    )
}

const numStep = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', color: 'rgba(255,255,255,0.75)',
    border: 'none', width: '1.35rem', height: '1.35rem',
    cursor: 'pointer', padding: 0,
}

/* ═══════════════════════════════════════════════════════════════
   SUMMARY OVERLAY — no fim do treino
   ═══════════════════════════════════════════════════════════════ */
function SummaryOverlay({ summary, workoutTitle, shareCode, canSaveResult, onRepeat, onExit }) {
    const { mode, durationMs, round, set, manualRounds, config } = summary
    const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
    const [saveError, setSaveError] = useState(null)

    let roundsCompleted = null
    if (mode === MODES.AMRAP || mode === MODES.FOR_TIME) {
        roundsCompleted = manualRounds
    } else if (mode === MODES.EMOM) {
        roundsCompleted = config.rounds
    } else if (mode === MODES.TABATA) {
        roundsCompleted = (set - 1) * config.roundsPerSet + round
    }

    // No FOR TIME o resultado é o tempo; nos restantes modos o tempo é fixo à
    // partida, por isso o que conta são as rondas.
    const score = mode === MODES.FOR_TIME
        ? formatMs(durationMs)
        : `${roundsCompleted || 0} rondas`
    const scoreValue = mode === MODES.FOR_TIME
        ? Math.round(durationMs / 1000)
        : (roundsCompleted || 0)
    const notes = [
        workoutTitle,
        MODE_META[mode].label,
        mode === MODES.FOR_TIME
            ? (roundsCompleted ? `${roundsCompleted} rondas` : null)
            : `${formatMs(durationMs)} de trabalho`,
    ].filter(Boolean).join(' · ')

    const canSave = !!(canSaveResult && shareCode)

    // Regista o score sem fechar nada: a sala fica aberta para se poder repetir
    // o WOD e registar outra tentativa.
    const registerScore = () => {
        if (!canSave || saveState === 'saving' || saveState === 'saved') return
        setSaveState('saving')
        setSaveError(null)
        apiFetch(`/tv-share/${shareCode}/result`, {
            method: 'POST',
            body: JSON.stringify({ score, scoreValue, notes }),
        })
            .then(async r => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error(body.error || 'Não foi possível registar o resultado.')
                return body
            })
            .then(() => setSaveState('saved'))
            .catch(err => { setSaveState('error'); setSaveError(err.message) })
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem'
        }}>
            <div style={{
                background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: '1.5rem', padding: '2.5rem 3rem', maxWidth: '540px', width: '100%',
                textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <div style={{
                        width: '5rem', height: '5rem', borderRadius: '50%',
                        background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <CheckCircle2 size={44} color="#22c55e" />
                    </div>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.2em', color: '#22c55e', marginBottom: '0.5rem' }}>
                    TREINO CONCLUÍDO
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1.5rem', color: 'white' }}>
                    {MODE_META[mode].label}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: roundsCompleted != null ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <StatBlock label="Duração total" value={formatMs(durationMs)} color="#3b82f6" />
                    {roundsCompleted != null && (
                        <StatBlock label="Rondas completadas" value={String(roundsCompleted)} color="#22c55e" />
                    )}
                </div>

                <div style={{ display: 'grid', gap: '0.6rem' }}>
                    {canSave && (
                        <button onClick={registerScore} disabled={saveState === 'saving' || saveState === 'saved'} style={{
                            background: saveState === 'saved' ? 'rgba(34,197,94,0.15)' : '#22c55e',
                            color: saveState === 'saved' ? '#22c55e' : 'white',
                            border: saveState === 'saved' ? '1px solid rgba(34,197,94,0.35)' : 'none',
                            borderRadius: '0.75rem', padding: '0.85rem 2rem',
                            fontSize: '1rem', fontWeight: 800, width: '100%',
                            cursor: saveState === 'saving' ? 'wait' : (saveState === 'saved' ? 'default' : 'pointer'),
                            opacity: saveState === 'saving' ? 0.7 : 1,
                            boxShadow: saveState === 'saved' ? 'none' : '0 6px 20px rgba(34,197,94,0.35)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                        }}>
                            {saveState === 'saving' && <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> A registar...</>}
                            {saveState === 'saved' && <><CheckCircle2 size={17} /> Score registado no histórico</>}
                            {(saveState === 'idle' || saveState === 'error') && <><Save size={17} /> Registar Score ({score})</>}
                        </button>
                    )}

                    <button onClick={onRepeat} style={{
                        background: '#3b82f6', color: 'white', border: 'none',
                        borderRadius: '0.75rem', padding: '0.85rem 2rem',
                        fontSize: '1rem', fontWeight: 800, cursor: 'pointer', width: '100%',
                        boxShadow: '0 6px 20px rgba(59,130,246,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}>
                        <Repeat size={17} /> Repetir WOD
                    </button>

                    <button onClick={onExit} style={{
                        background: 'rgba(255,255,255,0.06)', color: 'white',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '0.75rem', padding: '0.85rem 2rem',
                        fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}>
                        <X size={17} /> Fechar tudo e voltar à app
                    </button>
                </div>

                {saveError && (
                    <div style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '0.6rem', lineHeight: 1.4 }}>
                        {saveError}
                    </div>
                )}
                {!canSave && (
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.8rem', lineHeight: 1.4 }}>
                        Esta sala foi aberta sem sessão iniciada, por isso o score não pode ser registado no histórico.
                    </div>
                )}
            </div>
        </div>
    )
}

function StatBlock({ label, value, color }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33`,
            borderRadius: '0.85rem', padding: '1rem'
        }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', opacity: 0.6, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                {label}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>
                {value}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUTS DO TREINO (inalterados)
   ═══════════════════════════════════════════════════════════════ */
function BoxWodLayout({ data }) {
    const sections = [
        { key: 'warmup', label: 'Aquecimento', icon: '🔥', color: '#f59e0b' },
        { key: 'skill', label: 'Skill / Força', icon: '💪', color: '#8b5cf6' },
        { key: 'main', label: 'WOD', icon: '⚡', color: '#3b82f6' },
        { key: 'cooldown', label: 'Retorno à calma', icon: '🧊', color: '#06b6d4' },
    ].filter(s => data.content?.[s.key])

    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sections.length, 3)}, minmax(0, 1fr))`, gap: '1.5rem' }}>
            {sections.map(s => (
                <div key={s.key} style={cardStyle(s.color)}>
                    <SectionHeader color={s.color} icon={s.icon} label={s.label} />
                    <div style={{
                        fontSize: 'clamp(1rem, 1.5vw, 1.35rem)',
                        lineHeight: 1.7, whiteSpace: 'pre-wrap',
                        color: 'rgba(255,255,255,0.92)'
                    }}>
                        {data.content[s.key]}
                    </div>
                </div>
            ))}
        </div>
    )
}

function StructuredLayout({ data }) {
    const { exercises = [], summary = {}, warmup, cooldown } = data
    const warmupExs = exercises.filter(e => (e.phase || 'main') === 'warmup')
    const mainExs = exercises.filter(e => (e.phase || 'main') === 'main')
    const cooldownExs = exercises.filter(e => (e.phase || 'main') === 'cooldown')

    const hasWarmup = warmupExs.length > 0 || warmup?.description || warmup?.steps?.length
    const hasCooldown = cooldownExs.length > 0 || cooldown?.description || cooldown?.steps?.length

    return (
        <div>
            {summary.intent && (
                <div style={{
                    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
                    borderRadius: '1rem', padding: '1rem 1.5rem', marginBottom: '1.5rem',
                    fontSize: 'clamp(1rem, 1.4vw, 1.15rem)', lineHeight: 1.6, fontStyle: 'italic'
                }}>
                    🎯 {summary.intent}
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: `${hasWarmup ? '1fr ' : ''}2fr${hasCooldown ? ' 1fr' : ''}`,
                gap: '1.25rem',
                alignItems: 'flex-start'
            }}>
                {hasWarmup && (
                    <div style={cardStyle('#f97316')}>
                        <SectionHeader color="#f97316" icon="🔥" label="Aquecimento" />
                        {warmup?.description && (
                            <p style={{ margin: '0 0 1rem', fontSize: 'clamp(0.95rem, 1.2vw, 1.05rem)', lineHeight: 1.6, opacity: 0.85 }}>
                                {warmup.description}
                            </p>
                        )}
                        {warmup?.steps?.length > 0 && (
                            <ol style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                {warmup.steps.map((step, i) => (
                                    <li key={i} style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1.05rem)', lineHeight: 1.55, color: 'rgba(255,255,255,0.85)' }}>{step}</li>
                                ))}
                            </ol>
                        )}
                        {warmupExs.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                {warmupExs.map((ex, i) => <ExerciseRow key={i} ex={ex} color="#f97316" small />)}
                            </div>
                        )}
                    </div>
                )}

                <div style={cardStyle('#3b82f6')}>
                    <SectionHeader color="#3b82f6" icon="🏋️" label="Parte principal" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {mainExs.map((ex, i) => <ExerciseRow key={i} ex={ex} color="#3b82f6" />)}
                    </div>
                </div>

                {hasCooldown && (
                    <div style={cardStyle('#06b6d4')}>
                        <SectionHeader color="#06b6d4" icon="🧊" label="Retorno à calma" />
                        {cooldown?.description && (
                            <p style={{ margin: '0 0 1rem', fontSize: 'clamp(0.95rem, 1.2vw, 1.05rem)', lineHeight: 1.6, opacity: 0.85 }}>
                                {cooldown.description}
                            </p>
                        )}
                        {cooldown?.steps?.length > 0 && (
                            <ol style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                {cooldown.steps.map((step, i) => (
                                    <li key={i} style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1.05rem)', lineHeight: 1.55, color: 'rgba(255,255,255,0.85)' }}>{step}</li>
                                ))}
                            </ol>
                        )}
                        {cooldownExs.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                {cooldownExs.map((ex, i) => <ExerciseRow key={i} ex={ex} color="#06b6d4" small />)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function SectionHeader({ color, icon, label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: `2px solid ${color}33` }}>
            <span style={{ fontSize: 'clamp(1.3rem, 2vw, 1.75rem)' }}>{icon}</span>
            <h2 style={{ margin: 0, fontSize: 'clamp(1.05rem, 1.8vw, 1.4rem)', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color }}>
                {label}
            </h2>
        </div>
    )
}

function ExerciseRow({ ex, color, small }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderLeft: `4px solid ${color}`,
            borderRadius: '0.7rem',
            padding: small ? '0.55rem 0.85rem' : '0.85rem 1.15rem',
            display: 'flex', alignItems: 'center', gap: '0.85rem'
        }}>
            <div style={{
                background: color + '22', color,
                borderRadius: '0.5rem',
                padding: small ? '0.3rem 0.55rem' : '0.4rem 0.75rem',
                fontWeight: 900,
                fontSize: small ? 'clamp(0.85rem, 1.1vw, 0.95rem)' : 'clamp(1rem, 1.4vw, 1.2rem)',
                whiteSpace: 'nowrap', flexShrink: 0,
                fontVariantNumeric: 'tabular-nums'
            }}>
                {ex.sets}×{ex.reps}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontWeight: 800,
                    fontSize: small ? 'clamp(0.9rem, 1.15vw, 1rem)' : 'clamp(0.95rem, 1.35vw, 1.15rem)',
                    lineHeight: 1.2
                }}>
                    {ex.name}
                </div>
                <div style={{ fontSize: 'clamp(0.75rem, 1vw, 0.85rem)', opacity: 0.6, marginTop: '3px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {ex.weight_h && ex.weight_h !== '—' && <span>♂ {ex.weight_h}</span>}
                    {ex.weight_m && ex.weight_m !== '—' && <span>♀ {ex.weight_m}</span>}
                    {ex.rest && ex.rest !== '-' && <span>⏱ {ex.rest}</span>}
                    {ex.adaptation && <span style={{ color: '#fbbf24' }}>💡 {ex.adaptation}</span>}
                </div>
            </div>
        </div>
    )
}

const cardStyle = (color) => ({
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${color}22`,
    borderRadius: '1rem',
    padding: '1.25rem 1.5rem'
})

const inlineCtrl = (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    background: color, color: 'white', border: 'none',
    borderRadius: '0.5rem', padding: '0.4rem 0.7rem',
    fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: `0 3px 10px ${color}44`, whiteSpace: 'nowrap',
})

const iconBtn = (color, ghost = false) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: color, color: 'white',
    border: ghost ? '1px solid rgba(255,255,255,0.12)' : 'none',
    borderRadius: '0.45rem', width: '2rem', height: '2rem',
    cursor: 'pointer', padding: 0,
    boxShadow: ghost ? 'none' : `0 3px 10px ${color}44`,
})

const roundBtn = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)', color: 'white',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.35rem',
    width: '1.55rem', height: '1.55rem', cursor: 'pointer', padding: 0
}

const h2Style = { fontSize: '1.5rem', fontWeight: 900, margin: '1rem 0 0.5rem', color: 'white' }

const FullScreenMessage = ({ children }) => (
    <div style={{
        minHeight: '100vh', background: '#0a0f1e', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
        <div style={{ textAlign: 'center' }}>{children}</div>
    </div>
)
