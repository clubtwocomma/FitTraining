/**
 * shareWod.js
 * Utilitário de partilha de WODs para WhatsApp e outras apps.
 * Suporta: Web Share API (Android/iOS nativo), WhatsApp direto e clipboard (fallback desktop).
 */

/**
 * Formata um WOD em texto legível e pronto a partilhar.
 * @param {object} wod - Objeto WOD com name, stimulus, description, workout, rounds, amrap
 * @param {string} type - Tipo de WOD: 'girl' | 'hero' | 'painstorm'
 */
export function formatWodText(wod, type = 'wod') {
    const typeEmojis = {
        girl: '🔥',
        hero: '🏅',
        painstorm: '⚡',
    }
    const typeLabels = {
        girl: 'BENCHMARK — The Girls',
        hero: 'HERO WOD',
        painstorm: 'PAINSTORM',
    }
    const emoji = typeEmojis[type] || '💪'
    const label = typeLabels[type] || 'WORKOUT'

    let text = `${emoji} *${wod.name}* — ${label}\n`
    text += `─────────────────────\n`

    if (wod.stimulus) {
        text += `🎯 *Estímulo:* ${wod.stimulus}\n`
    }
    if (wod.description) {
        text += `\n📋 *Descrição:*\n${wod.description}\n`
    }

    if (wod.workout && wod.workout.length > 0) {
        text += `\n🏋️ *Exercícios:*\n`
        wod.workout.forEach((ex, idx) => {
            const bullet = idx % 2 === 0 ? '▸' : '◦'
            text += `${bullet} ${ex.name} — ${ex.reps}\n`
        })
    }

    if (wod.rounds) {
        text += `\n🔁 *${wod.rounds} Rounds*\n`
    } else if (wod.amrap) {
        text += `\n⏱️ *AMRAP ${wod.amrap} minutos*\n`
    }

    if (type === 'hero' && (wod.hero || wod.honor)) {
        text += `\n🫡 *In Honor of:* ${wod.hero || wod.honor}\n`
    }

    text += `\n─────────────────────\n`
    text += `📱 _FitTraining App_`

    return text
}

/**
 * Copia texto para a área de transferência com fallback.
 */
async function copyToClipboard(text) {
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
    } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
    }
}

/**
 * Partilha um WOD via WhatsApp (abre link wa.me).
 * @param {string} text - Texto já formatado
 */
export function shareViaWhatsApp(text) {
    const encoded = encodeURIComponent(text)
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer')
}

/**
 * Partilha um WOD via Telegram.
 * @param {string} text - Texto já formatado
 */
export function shareViaTelegram(text) {
    const encoded = encodeURIComponent(text)
    window.open(`https://t.me/share/url?url=&text=${encoded}`, '_blank', 'noopener,noreferrer')
}

/**
 * Função principal de partilha de WOD.
 * Usa a Web Share API se disponível (nativa no telemóvel),
 * caso contrário mostra as opções de partilha.
 *
 * @param {object} wod - O objeto WOD completo
 * @param {string} type - 'girl' | 'hero' | 'painstorm'
 * @param {'native' | 'whatsapp' | 'telegram' | 'copy'} method - Método de partilha
 * @returns {Promise<void>}
 */
export async function shareWod(wod, type, method = 'native') {
    const text = formatWodText(wod, type)

    if (method === 'whatsapp') {
        shareViaWhatsApp(text)
        return
    }

    if (method === 'telegram') {
        shareViaTelegram(text)
        return
    }

    if (method === 'copy') {
        await copyToClipboard(text)
        return
    }

    // 'native' — tenta Web Share API (funciona no telemóvel com apps nativas)
    if (navigator.share) {
        try {
            await navigator.share({
                title: `${wod.name} — FitTraining`,
                text,
            })
        } catch (err) {
            if (err.name !== 'AbortError') {
                // Fallback para clipboard se share falhar
                await copyToClipboard(text)
                throw new Error('copy_fallback')
            }
        }
    } else {
        // Desktop sem Web Share API → clipboard
        await copyToClipboard(text)
        throw new Error('copy_fallback')
    }
}
