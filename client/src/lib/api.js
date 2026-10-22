// Removed import.meta.env dependency for absolute reliability behind Nginx reverse proxy
const API_BASE = '/fittraining/api'

export const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem('fitToken')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const res = await fetch(`${API_BASE}${normalizedPath}`, {
    ...options,
    headers
  })

  // Auto-logout se o token for inválido (excepto nas rotas de login/registo)
  if ((res.status === 401 || res.status === 403) && !path.includes('auth/login') && !path.includes('auth/register')) {
      localStorage.removeItem('fitToken');
      localStorage.removeItem('fitUser');
      window.location.reload();
  }

  return res;
}

// Gerações por IA (planos, treinos, WODs da box) demoram ~1 minuto e o proxy corta
// pedidos de mais de 60 s. Pede-se o modo assíncrono: o servidor responde logo com
// um jobId e aqui consulta-se o estado até terminar. Devolve uma Response normal,
// como apiFetch, para os chamadores não mudarem.
export const apiJob = async (path, options = {}, { intervalMs = 2500, timeoutMs = 5 * 60 * 1000 } = {}) => {
  const res = await apiFetch(path, { ...options, headers: { ...options.headers, 'X-Async': '1' } })
  if (res.status !== 202) return res // servidor antigo ou erro imediato (validação, limite)
  const { jobId } = await res.json()
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    await new Promise(r => setTimeout(r, intervalMs))
    let poll
    try {
      poll = await apiFetch(`/jobs/${jobId}`)
    } catch {
      continue // falha de rede pontual (ex.: troca de wifi para dados): tenta de novo
    }
    if (poll.status === 404) break
    if (!poll.ok) continue
    const job = await poll.json()
    if (job.status === 'running') continue
    return new Response(JSON.stringify(job.body ?? {}), {
      status: job.httpStatus || (job.status === 'done' ? 200 : 500),
      headers: { 'Content-Type': 'application/json' }
    })
  }
  return new Response(JSON.stringify({ error: 'A geração está a demorar demasiado. Tenta novamente daqui a pouco.' }), {
    status: 504,
    headers: { 'Content-Type': 'application/json' }
  })
}
