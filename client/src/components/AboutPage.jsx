import { ChevronLeft, HelpCircle, ShieldAlert, GraduationCap } from 'lucide-react'

export default function AboutPage({ onBack }) {
    return (
        <div className="about-page animate-fade">
            <button onClick={onBack} className="chip" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ChevronLeft size={16} /> Voltar
            </button>

            <header style={{ marginBottom: '2rem' }}>
                <h1>Sobre o FitTraining</h1>
                <p>A tua aplicação de fitness inteligente, focada na simplicidade e resultados em casa.</p>
            </header>

            <section className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HelpCircle size={20} color="var(--primary-color)" /> Como funciona?
                </h2>
                <p style={{ marginTop: '0.5rem' }}>
                    O FitTraining utiliza um algoritmo (estático ou IA) para combinar os exercícios da nossa base de dados com o tempo que tens e o equipamento que possuis. O objetivo é criar treinos equilibrados que podes fazer sem sair de casa.
                </p>
            </section>

            <section className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GraduationCap size={20} color="var(--primary-color)" /> O que é o modo IA?
                </h2>
                <p style={{ marginTop: '0.5rem' }}>
                    Ao ativares a Inteligência Artificial (Gemini ou OpenAI), a aplicação envia os teus critérios para um modelo de linguagem avançado que reorganiza e ajusta o treino de forma mais dinâmica, podendo sugerir variações criativas e intensidades adaptadas.
                </p>
            </section>

            <section className="glass" style={{ padding: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                    <ShieldAlert size={20} /> Aviso de Segurança
                </h2>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    Este gerador é apenas uma ferramenta de auxílio. Deves adaptar cada exercício ao teu nível de condição física. Se não tens experiência, consulta um profissional. A execução correta é mais importante do que o número de repetições.
                </p>
            </section>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem' }}>Versão 1.0.0 (Beta AI)</p>
            </div>
        </div>
    )
}
