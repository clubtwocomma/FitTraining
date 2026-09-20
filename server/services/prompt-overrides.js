/**
 * Lets the super-admin view and override the AI *system* prompts used to
 * generate training plans and box WODs, without a redeploy — same pattern as
 * the Pollinations model selector (server/superadmin/index.html).
 *
 * Scope is deliberately limited to system prompts. The user prompts
 * (PROMPTS.*.user) are template functions that serialize live athlete/box
 * data into the exact JSON schema the downstream parser expects — letting an
 * admin free-edit that text risks breaking JSON parsing app-wide, so those
 * stay code-only and are only exposed read-only for reference.
 */
const prisma = require('../lib/prisma');
const { PROMPTS } = require('./fittraining-prompts-v2');

const SETTING_PREFIX = 'prompt_override';

const PLAN_MODALITIES = ['forca_classico', 'crossfit', 'calistenia', 'hyrox', 'built', 'misto'];
const MODALITY_LABELS = {
  forca_classico: 'Força Clássica',
  crossfit: 'CrossFit',
  calistenia: 'Calistenia',
  hyrox: 'Hyrox',
  built: 'Built (Hipertrofia)',
  misto: 'Misto'
};

// Registry of the editable system prompts. `modalities: null` means the
// prompt takes no modality parameter (DECISAO) or the app currently always
// calls it with one fixed modality (WOD_UNICO/WOD_SEMANA are hardcoded to
// 'crossfit' in ai-service.js) — in both cases there's nothing useful to
// select, so the UI shows a single box instead of a modality picker.
const PROMPT_DEFS = [
  {
    key: 'DECISAO_SYSTEM',
    category: 'plano',
    label: 'Decisão do Treinador',
    description: 'Avalia se o atleta deve treinar hoje e com que intensidade, antes de gerar o plano.',
    modalities: null,
    getOriginal: () => PROMPTS.DECISAO.system
  },
  {
    key: 'TREINO_SYSTEM',
    category: 'rapido',
    label: 'Geração de Treino Único',
    description: 'Usado pelo botão "Gerar Treino" e "Sinto-me com Sorte" no formulário rápido (sessão isolada, não um plano multi-dia).',
    modalities: PLAN_MODALITIES,
    getOriginal: (modality) => PROMPTS.TREINO.system(modality)
  },
  {
    key: 'PLANO_SYSTEM',
    category: 'plano',
    label: 'Geração do Plano de Treino Multi-Dia',
    description: 'Gera a estrutura completa do plano (dias, exercícios, séries/reps) para a modalidade escolhida.',
    modalities: PLAN_MODALITIES,
    getOriginal: (modality) => PROMPTS.PLANO.system(modality)
  },
  {
    key: 'WOD_UNICO_SYSTEM',
    category: 'box',
    label: 'Geração de WOD Único da Box',
    description: 'Usado pelo botão de gerar um WOD avulso para a box (sempre modalidade CrossFit).',
    modalities: null,
    fixedModality: 'crossfit',
    getOriginal: () => PROMPTS.WOD_UNICO.system('crossfit')
  },
  {
    key: 'WOD_SEMANA_SYSTEM',
    category: 'box',
    label: 'Geração de Plano Semanal de WODs da Box',
    description: 'Usado para gerar vários dias de WODs de uma vez para a box (sempre modalidade CrossFit).',
    modalities: null,
    fixedModality: 'crossfit',
    getOriginal: () => PROMPTS.WOD_SEMANA.system('crossfit')
  }
];

// In-memory cache: settingKey -> override text. Populated at startup and
// updated immediately on save, so a change takes effect without a restart.
const cache = new Map();

function settingKey(promptKey, modality) {
  return `${SETTING_PREFIX}::${promptKey}::${modality || 'default'}`;
}

function findDef(promptKey) {
  const def = PROMPT_DEFS.find(d => d.key === promptKey);
  if (!def) throw new Error(`Prompt desconhecido: ${promptKey}`);
  return def;
}

function resolveModality(def, modality) {
  if (def.fixedModality) return def.fixedModality;
  if (!def.modalities) return null;
  return modality && def.modalities.includes(modality) ? modality : (def.defaultModality || def.modalities[0]);
}

function getOriginalPrompt(promptKey, modality) {
  const def = findDef(promptKey);
  const resolvedModality = resolveModality(def, modality);
  return def.getOriginal(resolvedModality);
}

function getEffectivePrompt(promptKey, modality) {
  const def = findDef(promptKey);
  const resolvedModality = resolveModality(def, modality);
  const cached = cache.get(settingKey(promptKey, resolvedModality));
  return cached !== undefined ? cached : def.getOriginal(resolvedModality);
}

async function setOverride(promptKey, modality, text) {
  const def = findDef(promptKey);
  const resolvedModality = resolveModality(def, modality);
  const key = settingKey(promptKey, resolvedModality);
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: text },
    create: { key, value: text }
  });
  cache.set(key, text);
  return { promptKey, modality: resolvedModality, text };
}

async function clearOverride(promptKey, modality) {
  const def = findDef(promptKey);
  const resolvedModality = resolveModality(def, modality);
  const key = settingKey(promptKey, resolvedModality);
  await prisma.appSetting.deleteMany({ where: { key } });
  cache.delete(key);
  return { promptKey, modality: resolvedModality, text: def.getOriginal(resolvedModality) };
}

async function loadAllOverrides() {
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: `${SETTING_PREFIX}::` } } });
  cache.clear();
  for (const row of rows) cache.set(row.key, row.value);
  console.log(`[Prompts] ${rows.length} override(s) de prompt carregado(s) da BD.`);
}

// Flattened, UI-ready listing: one entry per (prompt, modality) combination.
function listPrompts() {
  const entries = [];
  for (const def of PROMPT_DEFS) {
    const modalityList = def.modalities || [resolveModality(def, null)];
    for (const modality of modalityList) {
      const key = settingKey(def.key, modality);
      const defaultText = def.getOriginal(modality);
      const overridden = cache.has(key);
      entries.push({
        key: def.key,
        modality: def.modalities ? modality : null,
        modalityLabel: def.modalities ? (MODALITY_LABELS[modality] || modality) : null,
        category: def.category,
        label: def.label,
        description: def.description,
        text: overridden ? cache.get(key) : defaultText,
        default: defaultText,
        isOverridden: overridden
      });
    }
  }
  return entries;
}

module.exports = { listPrompts, getEffectivePrompt, getOriginalPrompt, setOverride, clearOverride, loadAllOverrides, PROMPT_DEFS };
