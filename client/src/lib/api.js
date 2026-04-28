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
