/**
 * Lists text/chat models available on Pollinations.ai, so the super-admin can
 * pick which one the app uses by default — without a redeploy. The catalogue
 * changes often, so this always tries a live fetch first and only falls back
 * to a small curated list if the API is unreachable.
 */

const MODELS_URL = 'https://gen.pollinations.ai/models';

// Present in the catalogue but not chat/text-completion models — never show these.
const SKIP_KEYWORDS = ['whisper', '-tts-', 'guard', 'safeguard', 'orpheus', 'allam'];

// Used only if the live /models call fails outright (network down, endpoint moved).
const FALLBACK_MODELS = [
  { name: 'openai-fast', title: 'GPT-5 Nano', brand: 'OpenAI', promptPricePerM: 0.0375, completionPricePerM: 0.3 },
  { name: 'openai', title: 'GPT-5.4 Nano', brand: 'OpenAI', promptPricePerM: 0.15, completionPricePerM: 0.9375 },
  { name: 'gpt-5.4-mini', title: 'GPT-5.4 Mini', brand: 'OpenAI', promptPricePerM: 0.5625, completionPricePerM: 3.375 },
  { name: 'mistral', title: 'Mistral Small 4', brand: 'Mistral', promptPricePerM: 0.15, completionPricePerM: 0.6 },
  { name: 'gemini', title: 'Gemini 3.5 Flash', brand: 'Google', promptPricePerM: 1.5, completionPricePerM: 9 },
  { name: 'openai-large', title: 'GPT-5.5', brand: 'OpenAI', promptPricePerM: 5, completionPricePerM: 30 }
].map(m => ({ ...m, name: m.name, description: m.title, free: false, reasoning: false, contextLength: null, isFallback: true }));

function isTextModel(m) {
  const name = (m.name || m.id || '').toLowerCase();
  if (m.category && m.category !== 'text') return false;
  return !SKIP_KEYWORDS.some(kw => name.includes(kw));
}

function toPricePerMillion(pricePerToken) {
  if (pricePerToken === null || pricePerToken === undefined) return null;
  const n = Number(pricePerToken);
  return Number.isFinite(n) ? n * 1_000_000 : null;
}

function normalizeModel(m) {
  const promptPricePerM = toPricePerMillion(m.pricing?.promptTextTokens);
  const completionPricePerM = toPricePerMillion(m.pricing?.completionTextTokens);
  const free = (promptPricePerM ?? 0) < 0.0001 && (completionPricePerM ?? 0) < 0.0001;
  return {
    name: m.name,
    title: m.title || m.name,
    description: m.description || m.title || m.name,
    brand: m.brand || m.owned_by || 'Outro',
    promptPricePerM,
    completionPricePerM,
    contextLength: m.context_length || null,
    reasoning: !!m.reasoning,
    tools: !!m.tools,
    free
  };
}

function sortByPriceAscending(models) {
  const priceKey = m => (m.completionPricePerM ?? m.promptPricePerM ?? Infinity);
  return [...models].sort((a, b) => priceKey(a) - priceKey(b));
}

async function fetchAvailableModels() {
  try {
    const res = await fetch(MODELS_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.data || [];
    const textModels = items.filter(isTextModel).map(normalizeModel);
    if (textModels.length === 0) throw new Error('Nenhum modelo de texto devolvido pela API');
    return sortByPriceAscending(textModels);
  } catch (err) {
    console.warn('[Pollinations Models] Falha ao obter lista ao vivo, a usar fallback estático:', err.message);
    return sortByPriceAscending(FALLBACK_MODELS);
  }
}

module.exports = { fetchAvailableModels };
