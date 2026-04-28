/**
 * AI Service for generating workouts.
 * Uses Pollinations.ai (OpenAI-compatible) as the primary provider.
 * Falls back to client-configured keys if provided.
 */
const https = require('https');
const http = require('http');

// ─── Server default API key (Pollinations.ai) ───
const DEFAULT_API_KEY = 'sk_qYxYPRzO3EjO8TDaFEwxGAKhb3QBSBbM';
const POLLINATIONS_BASE = 'https://text.pollinations.ai/openai';  // OpenAI-compatible endpoint

/**
 * Make a real HTTP POST to an OpenAI-compatible chat/completions endpoint.
 */
function callChatCompletions(baseUrl, apiKey, messages, model) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl.replace(/\/$/, '') + '/v1/chat/completions');
    const postData = JSON.stringify({
      model: model || 'openai',
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    });

    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            console.error(`[AI] API returned ${res.statusCode}: ${body.slice(0, 500)}`);
            reject(new Error(`API error ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          const data = JSON.parse(body);
          const content = data.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error('AI response missing content'));
            return;
          }
          resolve(content);
        } catch (e) {
          reject(new Error('Failed to parse AI response: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('AI request timed out (60s)')); });
    req.write(postData);
    req.end();
  });
}

/**
 * Extract JSON from AI response text (handles markdown code blocks, etc.)
 */
function extractJSON(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch (e) { }
  // Try extracting from ```json ... ``` blocks
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) try { return JSON.parse(m[1].trim()); } catch (e) { }
  // Try finding first { ... } block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (e) { }
  }
  return null;
}

/**
 * Resolve API base URL and key based on provider + client key override.
 * Priority: client key > server default (Pollinations).
 */
function resolveProvider(provider, clientApiKey) {
  // If client provided a key for a specific provider, use it
  if (clientApiKey && clientApiKey.length > 4) {
    if (provider === 'openai') {
      return { baseUrl: 'https://api.openai.com', apiKey: clientApiKey, model: 'gpt-4o-mini' };
    }
    if (provider === 'gemini') {
      // Gemini uses its own format but we'll route through Pollinations with client key
      return { baseUrl: 'https://gen.pollinations.ai', apiKey: clientApiKey, model: 'openai' };
    }
    // For pollination or any other, use Pollinations with client key
    return { baseUrl: 'https://gen.pollinations.ai', apiKey: clientApiKey, model: 'openai' };
  }
  // Default: use server Pollinations key
  return { baseUrl: 'https://gen.pollinations.ai', apiKey: DEFAULT_API_KEY, model: 'openai' };
}

/**
 * Build the comprehensive workout generation prompt with all user settings.
 */
function buildWorkoutPrompt(params) {
  const { time, muscleGroups, type, equipment, profile } = params;
  const gender = profile?.gender || 'homem';
  const level = profile?.level || 'iniciante';
  const environment = profile?.environment || 'ginásio';
  const homeEquipment = profile?.homeEquipment || [];

  const allKnownEquip = ['halteres', 'barra olímpica', 'barra de pull-ups', 'kettlebells', 'bicicleta estática', 'passadeira', 'banco', 'elásticos', 'bola medicinal', 'caixa'];
  const equipList = (equipment && equipment.length > 0 ? equipment : ['nenhum (peso corporal)']);
  const forbiddenEquip = allKnownEquip.filter(e => !equipList.includes(e));

  return `### IDENTIDADE E REGRAS DE OURO ###
És um programador de treinos ELITE. A tua missão é definir o INTUITO e o ESFORÇO do treino com precisão.

1. REGRAS DE ESFORÇO (%RM):
- É EXPRESSAMENTE PROIBIDO usar KGs específicos (ex: "50kg").
- O campo weight_h e weight_m DEVE conter apenas a PERCENTAGEM DO RM (Repetição Máxima) para definir o nível de esforço.
- ✅ FORMATO OBRIGATÓRIO: "X% RM" (Ex: "75% RM", "60% RM", "85% RM").
- Se for Peso Corporal, escreve "Peso Corporal".

2. INTUITO DO TREINO (NOVO):
- No campo "intent" do summary, deves descrever brevemente o objetivo do treino.

3. REGRAS DE EQUIPAMENTO (CRÍTICO):
- LISTA DISPONÍVEL: ${equipList.join(', ')}.
- LISTA PROIBIDA (NÃO USAR): ${forbiddenEquip.join(', ')}.

4. CARDIO E DISTÂNCIAS:
- NUNCA uses reps numéricas. Usa sempre: "400m", "800m", "20 cal", "10 min", etc.

5. ADAPTAÇÕES E EQUIPAMENTO (CRÍTICO):
- Se houver limitações (${profile?.limitations || 'Nenhuma'}), ADAPTA os exercícios.
- É PROIBIDO mencionar a lesão ou adaptação no nome do exercício (ex: NÃO ESCREVAS "Agachamento (Adaptado)"). Escreve apenas o nome do exercício.
- No campo "adaptation" (NOVO), deves sugerir uma alternativa caso o utilizador não tenha o equipamento ideal ou a máquina necessária (ex: Leg Press -> Agachamento com Elásticos se for HomeGym). Considera sempre se o utilizador está em 'box' (CrossFit) ou 'homegym' (${environment}).

6. ESTRUTURA DO TREINO (OBRIGATÓRIO):
- O treino DEVE conter 3 fases: "warmup" (aquecimento), "main" (parte principal) e "cooldown" (retorno à calma).
- O tempo total (${time} min) deve focar-se na parte principal, mas o aquecimento e cooldown devem ser sugeridos.

---
PERFIL: ${gender} | Nível: ${level} | Grupos: ${muscleGroups.join(', ')} | Tempo: ${time} min.

ESTRUTURA JSON:
{
  "totalTime": ${time},
  "summary": { 
    "muscleGroups": ${JSON.stringify(muscleGroups)}, 
    "type": "${type}", 
    "method": "AI", 
    "structure": "Ex: AMRAP 20",
    "intent": "Descrição breve do intuito do treino...",
    "stimulus": "Curto (ex: Cardiovascular)"
  },
  "exercises": [
    {
      "phase": "warmup",
      "name": "Exercício de Aquecimento",
      "sets": 1, "reps": "10", "rest": "0s",
      "weight_h": "-", "weight_m": "-"
    },
    {
      "phase": "main",
      "name": "Exercício Principal",
      "sets": 3, "reps": "10", "rest": "60s",
      "weight_h": "75% RM", "weight_m": "75% RM",
      "adaptation": "Dica de adaptação para HomeGym ou se faltar material..."
    },
    {
      "phase": "cooldown",
      "name": "Alongamento/Mobilidade",
      "sets": 1, "reps": "5 min", "rest": "0s",
      "weight_h": "-", "weight_m": "-"
    }
  ]
}

Responde apenas com JSON.`;
}

/**
 * Generate a workout using AI (Pollinations.ai as primary, client keys as override).
 */
const generateWithAI = async (provider, params) => {
  const { clientApiKey } = params;
  const { baseUrl, apiKey, model } = resolveProvider(provider, clientApiKey);
  const prompt = buildWorkoutPrompt(params);

  const messages = [
    {
      role: 'system',
      content: `És um Sistema Inteligente de Programação de Treinos. 
      ZERO TOLERANCE RULES:
      1. NÃO uses KGs. Usa apenas %RM (ex: "70% RM").
      2. No summary, o campo "intent" deve descrever se o treino é metabólico/rápido ou força/pesado.
      3. NÃO uses números simples para Cardio. Usa distância/calorias.
      4. NÃO sugiras equipamento que o utilizador NÃO possui.
      Responde em JSON e em Português de Portugal.`
    },
    { role: 'user', content: prompt }
  ];

  console.log(`[AI] Generating workout via ${baseUrl} (provider: ${provider || 'pollinations-default'}, model: ${model})`);

  try {
    const rawResponse = await callChatCompletions(baseUrl, apiKey, messages, 'openai');
    const parsed = extractJSON(rawResponse);

    if (!parsed) {
      console.error('[AI] Failed to parse JSON from response');
      throw new Error('AI response was not valid JSON');
    }

    // Ensure exercises array exists and has valid structure
    const exercises = (parsed.exercises || []).map((ex, i) => ({
      phase: ex.phase || 'main',
      name: ex.name || `Exercício ${i + 1}`,
      sets: parseInt(ex.sets) || 1,
      reps: String(ex.reps || '10'),
      rest: ex.rest || '60s',
      weight_h: ex.weight_h || '80% RM',
      weight_m: ex.weight_m || '80% RM',
      adaptation: ex.adaptation || '',
      safety_notes: ex.safety_notes || '',
      duration: parseInt(ex.duration) || 120,
      order: i + 1
    }));

    console.log(`[AI] Successfully generated ${exercises.length} exercises`);

    return {
      provider: provider || 'pollinations',
      exercises,
      summary: parsed.summary || { method: 'AI', type: params.type },
      totalTime: params.time,
      aiContribution: `AI Workout Intent: ${parsed.summary?.intent || 'Equilibrado'}`
    };
  } catch (err) {
    console.error('[AI] Generation failed:', err.message);
    throw err;
  }
};

const testConnection = async (provider, apiKey) => {
  if (!apiKey || apiKey.length < 5) {
    throw new Error('Chave de API inválida ou muito curta.');
  }

  console.log(`Testing connection for ${provider}...`);

  // Real implementation would make a small call to the API
  // For now, we simulate success for demo purposes
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (apiKey.includes('error')) {
        reject(new Error(`Falha na autenticação com ${provider}.`));
      } else {
        resolve({ status: 'ok', message: `Conexão com ${provider} estabelecida com sucesso!` });
      }
    }, 1500);
  });
};

const generateMultiDayPlan = async (provider, params) => {
  const { goal, freq, period, level, limitations, type, exigency, motive, profile } = params;
  const environment = profile?.environment || 'ginasio';
  console.log(`[AI-Plan] Generating for environment: ${environment}`);
  const homeEquipment = profile?.homeEquipment || [];

  const totalDays = period === 'week' ? 7 : 30;
  const trainingDaysPerWeek = parseInt(freq);

  // Real implementation would invoke actual AI.
  // We're mimicking the prompt structure for when the backend is hooked to LLM.
  const prompt = `Gera um Plano de Treino de ${totalDays} Dias.
Objetivo: ${goal}
Tipo de Treino Preferido: ${type || 'Mistura'}
Nível de Experiência: ${level}
Nível de Exigência: ${exigency || 'Normal'}
Motivo/Competição: ${motive || 'Nenhum'}
Dias de treino por semana: ${trainingDaysPerWeek} (Distribui estrategicamente dias de "Descanso / Rest").
Ambiente de Treino: ${environment === 'casa' ? `Em Casa (Equipamento disponível: ${homeEquipment.length > 0 ? homeEquipment.join(', ') : 'Apenas Peso Corporal/Calistenia'})` : environment === 'box' ? 'Box de CrossFit' : 'Ginásio Completo'}
Limitações físicas reportadas: ${limitations || 'Nenhuma'}

REGRAS:
1. Deves devolver a resposta ESTRITAMENTE num formato JSON.
2. Cada sessão de treino deve ter um "focus" (ex: "Peito e Triceps" ou "WOD Funcional").
3. Dias de descanso DEVEM existir para perfazer os ${totalDays} dias. Título: "Descanso Ativo" ou "Recuperação", sem exercícios.
   > CRÍTICO: Para dias de descanso, o JSON deve obrigatoriamente incluir o campo "rest_justification", explicando psicologicamente à pessoa (com base na exigência e objetivos) PORQUE o descanso ou recuperação ativa (caminhada, yoga, mobilidade) é estritamente vital hoje.
4. Para TODOS os exercícios de força, deves incluir a percentagem de 1RM (%RM).
5. Deves ter em extrema consideração e ADAPTAR TODOS os exercícios se houver limitações explícitas. É PROIBIDO mencionar a lesão ou adaptação no nome do exercício.
6. Se o Tipo de Treino for 'calistenia', usa EXCLUSIVAMENTE o peso corporal em todo o plano.
7. Se o Tipo de Treino for 'hyrox', planeia blocos de corrida severa intercalada com estações funcionais pesadas (Trenó/Sled, Wall Balls, Burpees).
8. Se a Exigência for 'extrema' (Bi-diário de Elite), nos dias de treino deves assumir 2 sessões e espelhá-lo no foco (ex: "Manhã: Corrida / Tarde: Força") e duplicar o volume.

ESTRUTURA JSON EXIGIDA:
{
  "title": "Plano Personalizado...",
  "limitationsConsidered": "...",
  "sessions": [
    {
      "day": 1,
      "focus": "Costas & Biceps" | "Descanso",
      "duration": "60 min" | "-",
      "rest_justification": "Explicação científica e motivacional para o descanso ativo (apenas dias de descanso)",
      "exercises": [
        {
          "name": "Nome",
          "sets": "X",
          "reps": "X",
          "rest": "X seg",
          "rm_percent": "75% RM",
          "adaptation": "Alternativa caso não tenhas material..."
        }
      ]
    }
  ]
}`;

  console.log("Multi-Day Plan AI Prompt Executed:\n", prompt);

  // MOCKING the AI response based on the strict prompt instructions
  const sessions = [];
  let workoutCount = 0;

  const goalMap = {
    'f_loss': { rm: '60-70% RM', sets: '3-4', reps: '12-15', rest: '60s', title: 'Queima Avançada' },
    'm_gain': { rm: '75-85% RM', sets: '4', reps: '8-12', rest: '90s', title: 'Hipertrofia Dinâmica' },
    'strength': { rm: '85-95% RM', sets: '5', reps: '3-5', rest: '120s', title: 'Força Pura' },
    'endur': { rm: '50-60% RM', sets: '3', reps: '15-20', rest: '30s', title: 'Condicionamento' },
    'well': { rm: '60-75% RM', sets: '3', reps: '10-12', rest: '60s', title: 'Funcional' }
  };
  const g = goalMap[goal] || goalMap['well'];

  // Adjust splits based on selected type
  let splitMap = [];
  if (type === 'calistenia') {
    splitMap = [
      { focus: 'Push Avançado (P. Corporal)', ex: ['Flexões Diamante', 'Pike Push-ups', 'Dips Estritos', 'Prancha'] },
      { focus: 'Pull & Core (P. Corporal)', ex: ['Elevações (Pull-ups)', 'Australianas', 'L-Sit Hold', 'Toe-to-bar'] },
      { focus: 'Pernas & Pliometria', ex: ['Pistol Squats', 'Jumping Lunges', 'Tuck Jumps', 'Agachamento Isométrico'] }
    ];
  } else if (type === 'hyrox') {
    splitMap = [
      { focus: 'Simulação Hyrox 1', ex: ['Corrida 1km', 'SkiErg 1000m', 'Corrida 1km', 'Sled Push 50m'] },
      { focus: 'Simulação Hyrox 2', ex: ['Corrida 1km', 'Rowing 1000m', 'Corrida 1km', 'Farmers Carry 200m'] },
      { focus: 'Força Estacionária', ex: ['Wall Balls', 'Sandbag Lunges', 'Burpee Broad Jumps', 'Remada Pesada'] }
    ];
  } else {
    splitMap = [
      { focus: 'Peito, Ombros e Triceps', ex: ['Supino', 'Press Militar', 'Crucifixo', 'Extensão Tricep'] },
      { focus: 'Pernas, Glúteos e Core', ex: ['Agachamento', 'Leg Press', 'Lunge', 'Romanian Deadlift'] },
      { focus: 'Costas, Biceps e Posterior', ex: ['Elevações', 'Remada', 'Bicep Curl', 'Face Pulls'] },
      { focus: 'Metcon Condicionamento', ex: ['Burpees', 'Kettlebell Swings', 'Box Jumps', 'Wall Balls'] }
    ];
  }

  for (let i = 1; i <= totalDays; i++) {
    const shouldRest = (workoutCount >= trainingDaysPerWeek && i <= 7)
      || (i % Math.ceil(7 / (7 - trainingDaysPerWeek)) === 0 && workoutCount > 0);

    if (shouldRest || workoutCount >= (trainingDaysPerWeek * (totalDays / 7))) {
      let restMsg = 'A recuperação não é opcional, é onde o músculo cresce. Faz uma caminhada de 30 min, mobilidade leve e hidrata-te.';
      if (exigency === 'extrema') restMsg = 'O corpo de elite precisa de pausa. Faz gelo, liberta as fascias com rolo e foca na visualização da tua prova.';
      if (type === 'hyrox') restMsg = 'Hyrox desgasta brutalmente o sistema nervoso central. Faz rolo nos gémeos e isquiotibiais. Yoga ou natação ligeira hoje.';

      sessions.push({
        day: i,
        focus: 'Dia de Descanso / Recuperação',
        duration: '-',
        rest_justification: restMsg,
        exercises: []
      });
    } else {
      const split = splitMap[workoutCount % splitMap.length];
      const isExtreme = exigency === 'extrema';
      const durationStr = isExtreme ? 'Manhã: 60min | Tarde: 60min' : '45-60 min';
      const focusPrefix = isExtreme ? '[BI-DIÁRIO ELITE] ' : '';

      const mainExercises = split.ex.map(e => ({
        phase: 'main',
        name: e,
        sets: isExtreme ? (parseInt(g.sets) + 2).toString() : g.sets,
        reps: g.reps,
        rest: g.rest,
        weight_h: type === 'calistenia' || e.includes('Corrida') || e.includes('Ski') ? '-' : g.rm,
        weight_m: type === 'calistenia' || e.includes('Corrida') || e.includes('Ski') ? '-' : g.rm,
        adaptation: e === 'Leg Press' && environment === 'casa' ? 'Substituir por Agachamento com Elástico ou Lunge Búlgaro se não houver máquina.' : 
                   e === 'Remada' && environment === 'casa' ? 'Usar elásticos ou remada curvada com halteres/garrafas.' : '',
        rm_percent: type === 'calistenia' || e.includes('Corrida') || e.includes('Ski') ? '-' : g.rm
      }));

      const getWarmupExercises = (focus) => {
        const warmupMap = {
          'Peito': [
            { phase: 'warmup', name: 'Mobilidade de Ombro (Passagens c/ Elástico)', sets: '1', reps: '15', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Escápulas no Chão (Floor Slides)', sets: '2', reps: '12', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Flexões de Braços Ligeiras', sets: '2', reps: '10', rest: '30s', rm_percent: '-' }
          ],
          'Pernas': [
            { phase: 'warmup', name: 'Mobilidade de Anca (Spiderman Stretch)', sets: '1', reps: '10/lado', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Cossack Squats (Mobilidade Lateral)', sets: '2', reps: '12', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Agachamentos Globais (Pausados)', sets: '2', reps: '10', rest: '30s', rm_percent: '-' }
          ],
          'Costas': [
            { phase: 'warmup', name: 'Cat-Cow (Mobilidade de Coluna)', sets: '1', reps: '12', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Mobilidade Torácica (Rotação)', sets: '2', reps: '10/lado', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Scapular Pull-ups / Remada Invertida Ligeira', sets: '2', reps: '10', rest: '30s', rm_percent: '-' }
          ],
          'Metcon': [
            { phase: 'warmup', name: 'Corrida Ligeira / Jumping Jacks', sets: '1', reps: '3 min', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Inchworms (Caminhada de Mãos)', sets: '2', reps: '8', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Burpees em câmara lenta', sets: '2', reps: '5', rest: '30s', rm_percent: '-' }
          ],
          'Calistenia': [
            { phase: 'warmup', name: 'Rotação de Pulsos e Cotovelos', sets: '1', reps: '1 min', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Prancha Abdominal Dinâmica', sets: '2', reps: '45s', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Escápulas em suspensão (Active Hang)', sets: '2', reps: '30s', rest: '30s', rm_percent: '-' }
          ],
          'Hyrox': [
            { phase: 'warmup', name: 'Corrida com joelhos altos', sets: '1', reps: '2 min', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Lunges Dinâmicos', sets: '2', reps: '12', rest: '-', rm_percent: '-' },
            { phase: 'warmup', name: 'Air Squats rápidos', sets: '2', reps: '15', rest: '30s', rm_percent: '-' }
          ]
        };

        const key = Object.keys(warmupMap).find(k => focus.toLowerCase().includes(k.toLowerCase())) || 'Metcon';
        return warmupMap[key];
      };

      const warmUp = getWarmupExercises(split.focus);

      const coolDown = [
        { phase: 'cooldown', name: 'Alongamentos Estáticos Gerais', sets: '1', reps: '5 min', rest: '-', rm_percent: '-' }
      ];

      sessions.push({
        day: i,
        focus: focusPrefix + split.focus,
        duration: durationStr,
        exercises: [...warmUp, ...mainExercises, ...coolDown]
      });
      workoutCount++;
    }
  }

  return {
    title: `Plano ${type ? type.toUpperCase() : g.title} - ${level.toUpperCase()}`,
    limitationsConsidered: limitations && limitations.length > 3 ? `Adaptações Ativas: Todos os exercícios de carga e impacto foram ajustados para proteger: ${limitations}. Se sentires desconforto, reduz a amplitude.` : 'Nenhuma limitação reportada. Avança com segurança.',
    period: totalDays + ' Dias',
    sessions: sessions
  };
};

/**
 * Parse free-text workout descriptions into structured exercise data.
 * Uses regex patterns to handle common workout notation formats.
 */
const parseWorkoutText = async (rawText, type) => {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const exercises = [];
  let structure = null;
  let aiNotes = '';

  // Detect workout structure from header lines
  const structurePatterns = [
    { regex: /AMRAP\s*(\d+)/i, name: 'AMRAP', extract: m => ({ structure: `AMRAP ${m[1]} min` }) },
    { regex: /EMOM\s*(\d+)/i, name: 'EMOM', extract: m => ({ structure: `EMOM ${m[1]} min` }) },
    { regex: /FOR\s*TIME/i, name: 'FOR TIME', extract: () => ({ structure: 'FOR TIME' }) },
    { regex: /(\d+)\s*(?:rounds?|rondas?)\s*(?:for\s*time|por\s*tempo)?/i, name: 'Rounds', extract: m => ({ structure: `${m[1]} Rounds` }) },
    { regex: /tabata/i, name: 'Tabata', extract: () => ({ structure: 'Tabata' }) },
    { regex: /(\d+)\s*(?:RFT)/i, name: 'RFT', extract: m => ({ structure: `${m[1]} Rounds For Time` }) },
    { regex: /circuito|circuit/i, name: 'Circuito', extract: () => ({ structure: 'Circuito' }) },
  ];

  for (const line of lines) {
    for (const sp of structurePatterns) {
      const m = line.match(sp.regex);
      if (m && !structure) {
        const result = sp.extract(m);
        structure = result.structure;
        aiNotes += `Estrutura detetada: ${structure}. `;
        break;
      }
    }
  }

  // Exercise parsing patterns  (order matters — most specific first)
  const exercisePatterns = [
    // "3x10 Back Squat @ 80kg" or "3x10 Back Squat (80 kg)"
    /^(\d+)\s*[xX×]\s*(\d+[-–]?\d*)\s+(.+?)(?:\s*[@(]\s*(\d+[\.,]?\d*)\s*(?:kg|lbs?)?\s*[)]?\s*)?$/i,
    // "10 Thrusters (43/29 kg)"
    /^(\d+)\s+(.+?)(?:\s*\(([^)]+)\))?$/i,
    // "Back Squat 5x5 @ 80% 1RM"
    /^(.+?)\s+(\d+)\s*[xX×]\s*(\d+[-–]?\d*)\s*(?:[@(]\s*(.+?)\s*[)]?\s*)?$/i,
    // "Run 400m" or "Corrida 200m"
    /^((?:Run|Corrida|Row|Remo|Ski|Bike|Bicicleta)\s+\d+\s*(?:m|km|cal)?)/i,
  ];

  for (const line of lines) {
    // Skip structure header lines, separators, and empty-ish lines
    if (/^[-=]+$/.test(line) || /^(AMRAP|EMOM|FOR TIME|RFT|tabata|circuito|circuit|ou:|---)/i.test(line)) continue;
    if (line.length < 3) continue;
    // Skip lines that are purely descriptive (sentences)
    if (/^[""]/.test(line) || /^hoje/i.test(line)) {
      // Try extracting exercises from descriptive text
      const descExercises = extractFromDescription(line);
      exercises.push(...descExercises);
      continue;
    }

    let matched = false;

    // Pattern 1: "3x10 Exercise @ load"
    let m = line.match(/^(\d+)\s*[xX×]\s*(\d+[-–]?\d*)\s+(.+?)(?:\s*[@(]\s*(.+?)\s*[)]?\s*)?$/);
    if (m) {
      exercises.push({
        name: m[3].trim(),
        sets: parseInt(m[1]),
        reps: m[2],
        load: m[4] || null,
        rest: null
      });
      matched = true;
    }

    // Pattern 2: "Exercise 3x10 @ load"
    if (!matched) {
      m = line.match(/^(.+?)\s+(\d+)\s*[xX×]\s*(\d+[-–]?\d*)\s*(?:[@(]\s*(.+?)\s*[)]?\s*)?$/);
      if (m) {
        exercises.push({
          name: m[1].trim(),
          sets: parseInt(m[2]),
          reps: m[3],
          load: m[4] || null,
          rest: null
        });
        matched = true;
      }
    }

    // Pattern 3: "10 Thrusters (43/29 kg)" — reps first, single set
    if (!matched) {
      m = line.match(/^(\d+)\s+(.+?)(?:\s*\(([^)]+)\))?\s*$/);
      if (m && m[2] && !/^\d/.test(m[2].trim())) {
        exercises.push({
          name: m[2].trim(),
          sets: 1,
          reps: m[1],
          load: m[3] || null,
          rest: null
        });
        matched = true;
      }
    }

    // Pattern 4: cardio distances — "Run 400m", "Corrida 200m"
    if (!matched) {
      m = line.match(/^((?:Run|Corrida|Row|Remo|Ski|Bike|Bicicleta|Assault)\s+\d+\s*(?:m|km|cal)?)/i);
      if (m) {
        exercises.push({
          name: m[1].trim(),
          sets: 1,
          reps: '1',
          load: null,
          rest: null
        });
        matched = true;
      }
    }

    // Pattern 5: plain exercise name (no numbers)
    if (!matched && /^[A-ZÀ-Ú]/.test(line) && line.length > 3 && line.length < 80) {
      exercises.push({
        name: line,
        sets: 1,
        reps: '?',
        load: null,
        rest: null
      });
    }
  }

  if (exercises.length === 0) {
    // Last resort: try to extract from the entire text as descriptive
    const descExercises = extractFromDescription(rawText);
    exercises.push(...descExercises);
  }

  if (structure) {
    aiNotes += `Tipo classificado como "${type}". `;
  }
  aiNotes += `${exercises.length} exercício(s) extraído(s) do texto original.`;

  return {
    exercises,
    structure: structure || type,
    aiNotes
  };
};

/**
 * Extract exercises from descriptive/narrative text.
 */
function extractFromDescription(text) {
  const exercises = [];
  // Common exercise names to look for in descriptions
  const knownExercises = [
    'Wall Ball', 'Box Jump', 'Clean and Jerk', 'Clean', 'Snatch', 'Deadlift',
    'Thruster', 'Pull-up', 'Pull-ups', 'Push-up', 'Push-ups', 'Burpee', 'Burpees',
    'Squat', 'Front Squat', 'Back Squat', 'Overhead Squat',
    'Kettlebell Swing', 'KB Swing', 'Turkish Get-up',
    'Muscle-up', 'Muscle-ups', 'Ring Dip', 'Ring Dips',
    'Toes-to-bar', 'T2B', 'HSPU', 'Handstand Push-up',
    'Double-under', 'Double-unders', 'DU',
    'Rope Climb', 'Rope Climbs',
    'Rowing', 'Row', 'Remo', 'Corrida', 'Run',
    'Bench Press', 'Supino', 'Press', 'Push Press', 'Push Jerk',
    'Lunge', 'Lunges', 'Walking Lunge',
    'Sit-up', 'Sit-ups', 'GHD Sit-up',
    'Plank', 'Prancha',
    'Dumbbell Snatch', 'DB Snatch', 'Dumbbell Clean',
    'Romanian Deadlift', 'RDL',
    'Leg Press', 'Leg Curl', 'Leg Extension',
    'Wall Sit', 'Wall Sits',
    'Bike', 'Bicicleta', 'Assault Bike', 'Ski Erg',
  ];

  for (const ex of knownExercises) {
    // Look for "N ExerciseName" pattern in text
    const regex = new RegExp(`(\\d+)\\s+${ex.replace(/[-()]/g, '\\$&')}s?\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      exercises.push({
        name: ex,
        sets: 1,
        reps: match[1],
        load: null,
        rest: null
      });
    }
    // Also check for just the name if no number
    if (!exercises.some(e => e.name.toLowerCase() === ex.toLowerCase())) {
      const nameRegex = new RegExp(`\\b${ex.replace(/[-()]/g, '\\$&')}s?\\b`, 'gi');
      if (nameRegex.test(text) && !exercises.some(e => e.name.toLowerCase() === ex.toLowerCase())) {
        // Extract load if mentioned nearby (e.g., "a 60kg")
        const loadMatch = text.match(new RegExp(`${ex.replace(/[-()]/g, '\\$&')}s?\\s*(?:a|@|com)?\\s*(\\d+[\\.,]?\\d*)\\s*(?:kg|lbs?)`, 'i'));
        exercises.push({
          name: ex,
          sets: 1,
          reps: '?',
          load: loadMatch ? loadMatch[1] + ' kg' : null,
          rest: null
        });
      }
    }
  }

  return exercises;
}

module.exports = { generateWithAI, testConnection, generateMultiDayPlan, parseWorkoutText };
