const { generateWorkout } = require('./server/utils/generator');
const fs = require('fs');
const path = require('path');

const exercises = JSON.parse(fs.readFileSync('./server/data/exercises.json', 'utf8'));

async function test() {
    console.log("Testing Static Generation...");
    const staticResult = await generateWorkout(exercises, {
        time: 30,
        muscleGroups: ['peito', 'core'],
        type: 'força',
        equipment: ['halteres']
    });
    console.log("Static Exercises:", staticResult.exercises.map(e => e.name));

    console.log("\nTesting AI Selection (Mock)...");
    const aiResult = await generateWorkout(exercises, {
        time: 30,
        muscleGroups: ['pernas'],
        type: 'crossfit',
        equipment: [],
        aiProvider: 'gemini'
    });
    console.log("AI Result Method:", aiResult.summary.method);
}

test();
