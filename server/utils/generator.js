const { generateWithAI } = require('../services/ai-service');

const generateWorkout = async (exercises, { time, muscleGroups, type, equipment, aiProvider, profile, clientApiKey }) => {
    // Constants for timing (seconds)
    const SEC_PER_REP = 3;
    const REST_BETWEEN_SETS = 45;
    const WARMUP_MINS = 5;
    const COOLDOWN_MINS = 5;

    // Filter exercises based on type and equipment for fallback or AI context
    const dayOfWeek = new Date().getDay(); // 0-6 (Sun-Sat)

    // Filter exercises based on type and equipment
    let filtered = exercises.filter(ex => {
        let typeMatch = type === 'both' ? true : ex.type.includes(type);

        // Special logic for 'Built': stricly legs and glutes everyday
        if (type === 'built') {
            typeMatch = ex.muscle_groups.some(mg => ['pernas', 'glúteos', 'isquiotibiais'].includes(mg));
        }

        // Equipment strategy
        const hasRequiredEquipment = ex.equipment.length === 0 ||
            ex.equipment.every(req => equipment.includes(req));

        const muscleMatch = muscleGroups.includes('corpo inteiro') ||
            ex.muscle_groups.some(mg => muscleGroups.includes(mg)) ||
            ex.muscle_groups.includes('corpo inteiro');

        return typeMatch && hasRequiredEquipment && muscleMatch;
    });

    // ALWAYS try AI generation first (Pollinations.ai as default)
    // Only skip if explicitly set to '' (static only)
    const useAI = aiProvider !== '';
    if (useAI) {
        try {
            const aiResponse = await generateWithAI(aiProvider || 'pollinations', {
                time,
                muscleGroups,
                type,
                equipment,
                exercises: filtered,
                profile,
                clientApiKey
            });

            // If AI returns exercises, return that plan
            if (aiResponse.exercises && aiResponse.exercises.length > 0) {
                return {
                    totalTime: time,
                    ...aiResponse,
                    summary: aiResponse.summary || { type, muscleGroups, equipmentUsed: equipment, method: 'AI' }
                };
            }
        } catch (err) {
            console.error('[Generator] AI Generation failed, falling back to static:', err.message);
        }
    }

    // Improved Static Strategy
    const totalTargetSec = time * 60;
    let currentTotalSec = 0;
    const selectedExercises = [];

    // 1. Warmup (Static)
    // Find monostructural (Run/Bike)
    const mono = filtered.find(ex => ex.id === 'bike' || ex.id === 'treadmill') || {
        name: 'Corrida (Passada)',
        reps_h: '3-5 min',
        reps_m: '3-5 min'
    };

    selectedExercises.push({
        id: 'warmup_mono',
        name: mono.name,
        phase: 'warmup',
        sets: 1,
        reps: '3-5 min',
        rest: '0s',
        reps_h: mono.reps_h || 'Corrida Lenta',
        reps_m: mono.reps_m || 'Corrida Lenta',
        weight_h: 'Cardio',
        weight_m: 'Cardio',
        duration: 240, // 4 mins avg
        order: 1
    });

    // Find 1-2 dynamic movements from filtered that match muscle groups
    const dynamic = filtered
        .filter(ex => ex.equipment.length === 0 && !['bike', 'treadmill'].includes(ex.id))
        .slice(0, 2);

    dynamic.forEach((ex, i) => {
        selectedExercises.push({
            ...ex,
            id: `warmup_dynamic_${i}`,
            phase: 'warmup',
            sets: 1,
            reps: '10-15',
            rest: '0s',
            reps_h: '10-15',
            reps_m: '10-15',
            weight_h: 'Peso do Corpo',
            weight_m: 'Peso do Corpo',
            duration: 60,
            order: i + 2
        });
    });

    currentTotalSec += selectedExercises.reduce((sum, ex) => sum + ex.duration, 0);

    // Shuffle main exercises
    filtered = filtered.sort(() => Math.random() - 0.5);

    for (let ex of filtered) {
        if (currentTotalSec >= totalTargetSec - (COOLDOWN_MINS * 60) - 120) break;

        const sets = 3;
        const reps = parseInt(ex.default_reps) || 12;
        const exDuration = (sets * reps * SEC_PER_REP) + (sets * REST_BETWEEN_SETS);

        if (currentTotalSec + exDuration <= totalTargetSec - (COOLDOWN_MINS * 60) + 120) {
            const phaseName = (type === 'crossfit' || type === 'both') ? 'wod' : 'main';
            selectedExercises.push({
                ...ex,
                phase: phaseName,
                sets: 3,
                reps: reps,
                rest: "45-60s",
                reps_h: reps,
                reps_m: Math.max(8, reps - 2),
                weight_h: ex.type.includes('força') ? "Carga Moderada" : "Intenso",
                weight_m: ex.type.includes('força') ? "Carga Leve/Média" : "Intenso",
                duration: exDuration,
                order: selectedExercises.length + 1
            });
            currentTotalSec += exDuration;
        }
    }

    // 2. Cooldown (Static)
    selectedExercises.push({
        id: 'cooldown_static',
        name: 'Alongamento e Flexibilidade',
        phase: 'cooldown',
        sets: 1,
        reps: '5 min',
        rest: '0s',
        reps_h: 'Full Body Stretch',
        reps_m: 'Full Body Stretch',
        weight_h: 'Relaxado',
        weight_m: 'Relaxado',
        duration: COOLDOWN_MINS * 60,
        order: selectedExercises.length + 1
    });
    currentTotalSec += COOLDOWN_MINS * 60;

    return {
        exercises: selectedExercises,
        totalTime: Math.ceil(currentTotalSec / 60),
        summary: {
            muscleGroups,
            type,
            method: 'Static',
            structure: type === 'crossfit' ? "FOR TIME (Rounds & Reps)" : "Treino de Séries",
            stimulus: type === 'crossfit' ? "Foco em intensidade e técnica." : "Foco em hipertrofia e força."
        }
    };
};

module.exports = { generateWorkout };
