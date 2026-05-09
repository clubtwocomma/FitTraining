const { generateMultiDayPlan } = require('../server/services/ai-service');

async function test() {
  console.log('--- TESTE PLANO V3.0 ---');
  const params = {
    goal: 'Ganho de Massa',
    freq: '3',
    period: 'week',
    level: 'intermédio',
    limitations: '',
    type: 'forca_classico',
    exigency: 'normal',
    motive: 'Preparação Verão',
    profile: {
      environment: 'ginásio',
      homeEquipment: ['halteres']
    }
  };

  try {
    const result = await generateMultiDayPlan('pollinations', params);
    console.log('\n✅ RESULTADO:\n');
    console.log('Título:', result.title);
    console.log('Período:', result.period);
    console.log('Limitações Consideradas:', result.limitationsConsidered);
    console.log('\nSessões Geradas:', result.sessions.length);
    
    result.sessions.forEach(s => {
      console.log(`\nDia ${s.day}: ${s.focus}`);
      if (s.rest_justification) {
        console.log(`   Rest: ${s.rest_justification}`);
      } else {
        console.log(`   Exercícios: ${s.exercises.length}`);
        s.exercises.slice(0, 2).forEach(ex => {
          console.log(`   - ${ex.name} (${ex.sets}x${ex.reps})`);
        });
      }
    });
  } catch (err) {
    console.error('\n❌ ERRO NO TESTE:', err.message);
  }
}

test();
