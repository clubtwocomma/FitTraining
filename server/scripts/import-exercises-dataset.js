/**
 * One-time import of the MIT-licensed text data from
 * https://github.com/hasaneyldrm/exercises-dataset (data/exercises.json only —
 * media is excluded, see NOTICE.md in that repo for why).
 *
 * Maps the dataset's English taxonomy onto this app's PT-PT muscle-group /
 * equipment vocabulary, batch-translates name + a short coaching cue to PT
 * via the existing AI pipeline, and upserts into the Exercise table.
 *
 * Usage: node scripts/import-exercises-dataset.js /path/to/exercises_raw.json
 */
require('dotenv').config();
const fs = require('fs');
const prisma = require('../lib/prisma');
const { callGeminiAdapter } = require('../services/ai-service');

const SRC_PATH = process.argv[2];
if (!SRC_PATH || !fs.existsSync(SRC_PATH)) {
  console.error('Usage: node scripts/import-exercises-dataset.js <path-to-exercises_raw.json>');
  process.exit(1);
}

const AI_BASE_URL = 'https://gen.pollinations.ai';
const AI_KEY = process.env.POLLINATIONS_API_KEY;
if (!AI_KEY) {
  console.error('POLLINATIONS_API_KEY não definido no .env — necessário para traduzir os exercícios.');
  process.exit(1);
}

const BATCH_SIZE = 25;

// ─── Taxonomy mapping: dataset (EN) → app vocabulary (PT) ─────────────────
const CATEGORY_TO_MUSCLE_GROUPS = {
  chest: ['peito'],
  back: ['costas'],
  shoulders: ['ombros'],
  'upper arms': ['braços'],
  'lower arms': ['braços'],
  'upper legs': ['pernas'],
  'lower legs': ['pernas'],
  waist: ['core'],
  cardio: ['cardio'],
  neck: ['ombros']
};

const EQUIPMENT_TO_PT = {
  'body weight': [],
  assisted: [],
  weighted: [],
  dumbbell: ['halteres'],
  barbell: ['barra olímpica'],
  'olympic barbell': ['barra olímpica'],
  'ez barbell': ['barra olímpica'],
  'trap bar': ['barra olímpica'],
  kettlebell: ['kettlebells'],
  band: ['elásticos'],
  'resistance band': ['elásticos'],
  'medicine ball': ['bola medicinal'],
  'stationary bike': ['bicicleta estática'],
  cable: ['cabo (polia)'],
  'leverage machine': ['máquina'],
  'smith machine': ['smith machine'],
  'stability ball': ['bola suíça']
  // anything else (bosu ball, roller, wheel roller, rope, hammer, tire,
  // sled machine, elliptical machine, skierg machine, stepmill machine,
  // upper body ergometer) is left unmapped — those exercises simply won't
  // surface via the equipment filter, which is fine for niche gear.
};

const BUILT_TARGETS = new Set(['glutes', 'hamstrings', 'quads', 'calves', 'adductors', 'abductors']);

function deriveType(record) {
  const types = ['força'];
  if (record.equipment === 'body weight' || record.category === 'cardio') types.push('crossfit');
  if (record.category === 'upper legs' || record.category === 'lower legs' || BUILT_TARGETS.has(record.target)) {
    types.push('built');
  }
  return types;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function translateBatch(records) {
  const system = `Es um tradutor especializado em fitness. Traduz nomes de exercícios de inglês para português europeu (PT-PT), e escreve UMA nota de segurança curta e prática (máx. 15 palavras, PT-PT) por exercício, no estilo "Manter o core ativado e não deixar a anca cair.". Responde APENAS com um objeto JSON válido no formato {"items":[{"id":"0001","name_pt":"...","safety_note_pt":"..."}]}, sem texto adicional.`;

  const payload = records.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    target: r.target,
    instructions_excerpt: (r.instructions?.en || '').slice(0, 220)
  }));

  const user = `Traduz estes ${payload.length} exercícios:\n${JSON.stringify(payload)}`;

  const result = await callGeminiAdapter(AI_BASE_URL, AI_KEY, system, user, 'openai-large');
  const items = Array.isArray(result) ? result : result.items;
  if (!Array.isArray(items)) throw new Error('Resposta da IA sem array "items"');
  return items;
}

function fallbackTranslation(record) {
  // Used only if a batch's AI call fails after retries — keeps the import
  // moving instead of dropping records silently.
  return {
    id: record.id,
    name_pt: record.name,
    safety_note_pt: 'Executa o movimento com controlo e boa técnica.'
  };
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(SRC_PATH, 'utf8'));
  console.log(`[Import] ${raw.length} exercícios carregados de ${SRC_PATH}`);

  const existing = await prisma.exercise.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map(e => e.name.toLowerCase()));
  console.log(`[Import] ${existingNames.size} exercícios já existentes na BD (serão ignorados por nome).`);

  const batches = chunk(raw, BATCH_SIZE);
  const toInsert = [];
  let translatedCount = 0;
  let fallbackCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let translations;
    try {
      translations = await translateBatch(batch);
    } catch (err) {
      console.warn(`[Import] Lote ${i + 1}/${batches.length} falhou na tradução (${err.message}) — a usar fallback em inglês.`);
      translations = batch.map(fallbackTranslation);
      fallbackCount += batch.length;
    }

    const byId = new Map(translations.map(t => [t.id, t]));

    for (const record of batch) {
      const t = byId.get(record.id) || fallbackTranslation(record);
      let namePt = (t.name_pt || record.name).trim();

      // Avoid unique-constraint collisions
      let finalName = namePt;
      let suffix = 2;
      while (existingNames.has(finalName.toLowerCase())) {
        finalName = `${namePt} (${suffix})`;
        suffix++;
      }
      existingNames.add(finalName.toLowerCase());

      const muscleGroups = CATEGORY_TO_MUSCLE_GROUPS[record.category] || ['core'];
      const equipment = EQUIPMENT_TO_PT[record.equipment] ?? [];

      toInsert.push({
        name: finalName,
        nameEn: record.name,
        muscleGroups,
        equipment,
        type: deriveType(record),
        category: record.category,
        target: record.target || null,
        secondaryMuscles: record.secondary_muscles || [],
        safetyNotes: t.safety_note_pt || 'Executa o movimento com controlo e boa técnica.',
        instructionsEn: record.instructions?.en || null,
        defaultReps: '10-12',
        defaultTime: 0,
        source: 'exercises-dataset'
      });
      translatedCount++;
    }

    console.log(`[Import] Lote ${i + 1}/${batches.length} processado (${translatedCount}/${raw.length} exercícios preparados).`);
  }

  console.log(`[Import] A inserir ${toInsert.length} exercícios na BD (${fallbackCount} usaram fallback em inglês)...`);

  const insertChunks = chunk(toInsert, 200);
  let inserted = 0;
  for (const c of insertChunks) {
    const res = await prisma.exercise.createMany({ data: c, skipDuplicates: true });
    inserted += res.count;
  }

  console.log(`[Import] Concluído: ${inserted} novos exercícios inseridos na BD.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[Import] Falha fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
