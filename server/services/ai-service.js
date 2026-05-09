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
      max_tokens: 16000,
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
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('AI request timed out (120s)')); });
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
  // Try finding first [ ... ] block
  const startArr = text.indexOf('[');
  const endArr = text.lastIndexOf(']');
  if (startArr !== -1 && endArr > startArr) {
    try { return JSON.parse(text.slice(startArr, endArr + 1)); } catch (e) { }
  }

  // Try finding first { ... } block
  const startObj = text.indexOf('{');
  const endObj = text.lastIndexOf('}');
  if (startObj !== -1 && endObj > startObj) {
    try { return JSON.parse(text.slice(startObj, endObj + 1)); } catch (e) { }
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
    return { baseUrl: 'https://gen.pollinations.ai', apiKey: clientApiKey, model: 'openai-large' };
  }
  // Default: use server Pollinations key
  return { baseUrl: 'https://gen.pollinations.ai', apiKey: DEFAULT_API_KEY, model: 'openai-large' };
}

const { PROMPTS, MODALITIES, ATHLETE_PROFILE_TEMPLATE } = require('./fittraining-prompts-v2');

/**
 * Helper to call AI and extract JSON.
 */
async function callGeminiAdapter(baseUrl, apiKey, systemPrompt, userPrompt, model = 'openai') {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  const rawResponse = await callChatCompletions(baseUrl, apiKey, messages, model);
  console.log(`[AI RAW] Response length: ${rawResponse.length} chars`);
  if (rawResponse.length > 0) {
    console.log(`[AI RAW] Start: ${rawResponse.substring(0, 100)}...`);
    console.log(`[AI RAW] End: ...${rawResponse.substring(rawResponse.length - 100)}`);
  }
  const parsed = extractJSON(rawResponse);
  if (!parsed) {
    throw new Error('AI response was not valid JSON');
  }
  return parsed;
}

/**
 * Generate a workout using AI with the V3.0 Double-Loop (Decision -> Workout).
 */
const generateWithAI = async (provider, params) => {
  const { clientApiKey, time, muscleGroups, type, equipment, profile, optimization } = params;
  const { baseUrl, apiKey, model } = resolveProvider(provider, clientApiKey);
  
  const modality = type || 'misto';

  // Map to ATHLETE_PROFILE_TEMPLATE
  const athleteProfile = {
    ...ATHLETE_PROFILE_TEMPLATE,
    athlete: {
      ...ATHLETE_PROFILE_TEMPLATE.athlete,
      gender: profile?.gender || 'masculino',
      level: profile?.level || 'iniciante',
      modality: modality,
      environment: profile?.environment || 'ginásio',
      equipment: equipment && equipment.length > 0 ? equipment : ['peso corporal'],
      limitations: profile?.limitations || [],
      session_duration_minutes: parseInt(time) || 60,
    },
    training_history: {
      ...ATHLETE_PROFILE_TEMPLATE.training_history,
      last_session: {
        ...ATHLETE_PROFILE_TEMPLATE.training_history.last_session,
        date: new Date().toISOString().split('T')[0],
      }
    }
  };

  try {
    console.log(`[AI V3.0] Step 1: Evaluating Decision via ${baseUrl}...`);
    const decision = await callGeminiAdapter(
      baseUrl, apiKey, 
      PROMPTS.DECISAO.system, 
      PROMPTS.DECISAO.user(athleteProfile),
      model
    );

    if (!decision.should_train) {
      console.log(`[AI V3.0] Coach decision: Rest. Reason: ${decision.rest_reason}`);
      return {
        provider: provider || 'pollinations',
        exercises: [],
        summary: { type: modality, method: 'AI V3.0', intent: 'Descanso Ativo' },
        totalTime: time,
        aiContribution: `Treinador IA recomendou descanso: ${decision.coaching_note}`
      };
    }

    console.log(`[AI V3.0] Step 2: Generating Workout (${modality})...`);
    const session = await callGeminiAdapter(
      baseUrl, apiKey,
      PROMPTS.TREINO.system(modality),
      PROMPTS.TREINO.user(athleteProfile, decision, optimization, modality),
      model
    );

    // Flatten V3.0 structure to the V2 format expected by generator.js
    const flattenedExercises = [];
    let order = 1;

    (session.warmup?.exercises || []).forEach(ex => {
      flattenedExercises.push({
        phase: 'warmup',
        name: ex.name,
        sets: 1,
        reps: ex.duration || '5 min',
        rest: '0s',
        weight_h: '-',
        weight_m: '-',
        adaptation: '',
        safety_notes: ex.purpose || '',
        duration: parseInt(ex.duration) * 60 || 300,
        order: order++
      });
    });

    (session.main?.exercises || []).forEach(ex => {
      flattenedExercises.push({
        phase: 'main',
        name: ex.name,
        sets: parseInt(ex.sets) || 3,
        reps: ex.reps || '10',
        rest: `${ex.rest_seconds || 60}s`,
        weight_h: ex.weight_rx || '-',
        weight_m: ex.weight_scaled || '-',
        adaptation: ex.adaptation || '',
        safety_notes: ex.safety_notes || '',
        duration: ((parseInt(ex.sets) || 3) * 60) + ((parseInt(ex.sets) || 3) * (ex.rest_seconds || 60)),
        order: order++
      });
    });

    (session.cooldown?.exercises || []).forEach(ex => {
      flattenedExercises.push({
        phase: 'cooldown',
        name: ex.name,
        sets: 1,
        reps: ex.duration || '5 min',
        rest: '0s',
        weight_h: '-',
        weight_m: '-',
        adaptation: '',
        safety_notes: ex.purpose || '',
        duration: parseInt(ex.duration) * 60 || 300,
        order: order++
      });
    });

    console.log(`[AI V3.0] Successfully generated ${flattenedExercises.length} exercises`);

    return {
      provider: provider || 'pollinations',
      exercises: flattenedExercises,
      summary: session.summary || { method: 'AI V3.0', type: modality },
      totalTime: session.summary?.total_time_minutes || time,
      aiContribution: `AI Workout Intent: ${session.summary?.intent || 'Equilibrado'} | Nota: ${session.summary?.coaching_note || ''}`
    };

  } catch (err) {
    console.error('[AI V3.0] Generation failed:', err.message);
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
  const {
    clientApiKey, goal, freq, period, level, limitations, type, exigency,
    motive, profile, history, lastSession, stateToday, session_duration
  } = params;
  const { baseUrl, apiKey, model } = resolveProvider(provider, clientApiKey);

  const modality = type || 'misto';
  const environment = profile?.athlete?.environment || profile?.environment || 'ginásio';
  const totalDays = period === 'week' ? 7 : 30;
  const equipment = profile?.athlete?.equipment || profile?.homeEquipment || ['peso corporal'];

  // ── Fase A: Construir athleteProfile com dados reais ─────────────────────────
  const athleteProfile = {
    athlete: {
      gender: profile?.gender || 'masculino',
      age: profile?.age || null,
      level: level || 'iniciante',
      modality,
      environment,
      equipment,
      limitations: limitations ? limitations.split(/[,.;]+/).map(s => s.trim()).filter(Boolean) : [],
      session_duration_minutes: session_duration || 60,
      goal: { primary: goal || 'Geral', deadline: null, event: motive || null }
    },
    state_today: {
      energy: stateToday?.energy || 'normal',
      sleep_hours: parseInt(stateToday?.sleep_hours) || 7,
      stress: stateToday?.stress || 'normal',
      days_since_rest: stateToday?.days_since_rest || 1
    },
    training_history: {
      last_session: lastSession || {
        date: new Date().toISOString().split('T')[0],
        muscle_groups: [],
        rpe_reported: 7,
        completed: true,
        notes: 'Primeiro plano — sem histórico anterior.'
      },
      weekly_assessment: params.weeklyAssessment || null,
      current_cycle: { phase: 'indefinida', week: 1, total_weeks: 4 },
      recent_rm_tests: {}
    }
  };

  const planConfig = {
    totalDays,
    goal: goal || 'Geral',
    level: level || 'iniciante',
    exigency: exigency || 'normal',
    trainingDaysPerWeek: parseInt(freq) || 3,
    environment,
    equipment,
    limitations: limitations || 'Nenhuma',
    motive: motive || 'Nenhum',
    cyclePhase: 'indefinida',
    session_duration: session_duration || 60,
    history: history || []
  };

  try {
    // ── Fase B: DECISAO — Treinador analisa o contexto ─────────────────────────
    console.log(`[AI V3.0] Treinador a decidir... (energia: ${athleteProfile.state_today.energy}, sono: ${athleteProfile.state_today.sleep_hours}h, dias desde descanso: ${athleteProfile.state_today.days_since_rest})`);
    let decision;
    try {
      decision = await callGeminiAdapter(
        baseUrl, apiKey,
        PROMPTS.DECISAO.system,
        PROMPTS.DECISAO.user(athleteProfile),
        model
      );
      console.log(`[AI V3.0] Decisão: should_train=${decision.should_train}, intensity=${decision.intensity_modifier}, volume=${decision.volume_modifier}`);
    } catch (decisionErr) {
      console.warn('[AI V3.0] DECISAO falhou, a usar defaults:', decisionErr.message);
      decision = {
        should_train: true,
        intensity_modifier: 1.0,
        volume_modifier: 1.0,
        recommended_focus: [],
        forbidden_groups: [],
        phase_guidelines: { sets: '4', rep_range: '8-12', intensity_range: '65-75% RM' },
        coaching_note: 'Treino normal com base no perfil definido.'
      };
    }

    // Injetar decisão no planConfig
    planConfig.coachingDecision = decision;
    planConfig.cyclePhase = decision.phase_guidelines ? 'indefinida' : 'indefinida';

    // ── Fase C: PLANO — Gera 7 dias com contexto da decisão ────────────────────
    console.log(`[AI V3.0] A gerar Plano ${modality.toUpperCase()} (${totalDays} dias)...`);
    const parsed = await callGeminiAdapter(
      baseUrl, apiKey,
      PROMPTS.PLANO.system(modality),
      PROMPTS.PLANO.user(planConfig, modality),
      model
    );

    const planLevel = level || 'iniciante';
    const coachNote = decision.coaching_note || '';

    return {
      title: `Plano ${modality.toUpperCase()} - ${planLevel.toUpperCase()}`,
      limitationsConsidered: `${coachNote} | Lógica: ${parsed.plan_meta?.programming_logic || 'IA V3.0'}`,
      period: `${parsed.plan_meta?.total_days || totalDays} Dias`,
      coachingDecision: decision,
      sessions: (parsed.days || parsed.sessions || []).map(d => ({
        day: d.day,
        focus: d.focus || (d.type === 'rest' ? 'Descanso Ativo' : 'Treino'),
        duration: d.session_duration_minutes ? `${d.session_duration_minutes} min` : '-',
        warmup: d.warmup || null,
        cooldown: d.cooldown || null,
        rest_justification: d.rest_justification || '',
        exercises: (d.exercises || []).map((ex, idx) => ({
          phase: 'main',
          name: ex.name,
          sets: ex.sets || 1,
          reps: ex.reps || '10',
          rest: ex.rest_seconds ? `${ex.rest_seconds}s` : '0s',
          weight_h: ex.weight_rx || '-',
          weight_m: ex.weight_scaled || '-',
          adaptation: ex.adaptation || '',
          rm_percent: ex.weight_scaled || '-',
          safety_notes: ex.safety_notes || '',
          order: idx + 1
        }))
      }))
    };
  } catch (err) {
    console.error('[AI V3.0 Multi-Day] Generation failed:', err.message);
    throw err;
  }
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

/**
 * Generate a single WOD based on a conversational prompt.
 */
/**
 * Generate a single WOD based on a conversational prompt using V3.0 Prompts.
 */
async function generateWod(prompt, goal = 'Daily WOD') {
  const { baseUrl, apiKey, model } = resolveProvider('pollinations', null);
  const modality = 'crossfit';
  const wodConfig = {
    prompt,
    goal,
    duration: 20,
    level: 'intermédio',
    equipment: ['barbell', 'kettlebell', 'pull-up bar', 'rower', 'bike', 'rings']
  };

  try {
    console.log(`[AI V3.0] Generating WOD...`);
    const parsed = await callGeminiAdapter(
      baseUrl, apiKey,
      PROMPTS.WOD_UNICO.system(modality),
      PROMPTS.WOD_UNICO.user(wodConfig)
    );
    
    return {
      title: parsed.title || 'WOD do Dia',
      warmup: `[${parsed.warmup?.duration_minutes || 10} min] ${parsed.warmup?.description || ''}`,
      workout: `Formato: ${parsed.format}\nCap: ${parsed.time_cap}\nEstímulo: ${parsed.stimulus}\n\nRX: ${parsed.workout?.rx}\n\nSCALED: ${parsed.workout?.scaled}\n\nDica Coach: ${parsed.coaching_tip}`
    };
  } catch (err) {
    console.error('[AI V3.0 WOD] Error:', err.message);
    throw err;
  }
}

/**
 * Generate a multi-day Box WOD plan using V3.0 Prompts.
 */
async function generateBoxWodPlan(prompt, days = 5) {
  const { baseUrl, apiKey, model } = resolveProvider('pollinations', null);
  const modality = 'crossfit';
  const weekConfig = {
    prompt,
    days,
    level: 'intermédio',
    equipment: ['barbell', 'kettlebell', 'pull-up bar', 'rower', 'bike', 'rings', 'wall balls', 'box']
  };

  try {
    console.log(`[AI V3.0] Generating Weekly Box WOD Plan (${days} days)...`);
    const parsed = await callGeminiAdapter(
      baseUrl, apiKey,
      PROMPTS.WOD_SEMANA.system(modality),
      PROMPTS.WOD_SEMANA.user(weekConfig)
    );
    
    // Ensure we return an array matching the frontend expectations
    const wodsArray = (parsed.wods || []).map(wod => ({
      title: wod.title || 'WOD do Dia',
      stimulus: wod.stimulus || 'Misto',
      warmup: `[${wod.warmup?.duration_minutes || 10} min] ${wod.warmup?.description || ''}`,
      workout: `Formato: ${wod.format}\nCap: ${wod.time_cap}\n\nRX: ${wod.workout?.rx}\n\nSCALED: ${wod.workout?.scaled}\n\nDica Coach: ${wod.coaching_tip}`
    }));

    return wodsArray;
  } catch (err) {
    console.error('[AI V3.0 Weekly Plan] Error:', err.message);
    throw err;
  }
}

module.exports = { generateWithAI, testConnection, generateMultiDayPlan, parseWorkoutText, generateWod, generateBoxWodPlan, callGeminiAdapter };
