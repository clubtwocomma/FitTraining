import { useState, useEffect } from 'react'
import WorkoutForm from './components/WorkoutForm'
import WorkoutView from './components/WorkoutView'
import AboutPage from './components/AboutPage'
import SettingsView from './components/SettingsView'
import TrainingPlanner from './components/TrainingPlanner'
import HeroWods from './components/HeroWods'
import GirlsWods from './components/GirlsWods'
import CustomLibrary from './components/CustomLibrary'
import AuthView from './components/AuthView'
import BoxView from './components/BoxView'
import CalendarView from './components/CalendarView'
import BenchmarksView from './components/BenchmarksView'
import HistoryView from './components/HistoryView'
import { Moon, Sun, Info, Dumbbell, Settings, Calendar, Play, Medal, Flame, BookOpen, LogOut, LayoutGrid, Users, ChevronRight, Trophy, TrendingUp, Sparkles } from 'lucide-react'
import { apiFetch } from './lib/api'

function App() {
    const [view, setView] = useState('home')
    const [currentUser, setCurrentUser] = useState(() => {
        const saved = localStorage.getItem('fitUser')
        return saved ? JSON.parse(saved) : null
    })
    const [workoutData, setWorkoutData] = useState(null)
    const [generating, setGenerating] = useState(false)
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
    const [profile, setProfile] = useState(() => {
        const saved = localStorage.getItem('user_profile')
        return saved ? JSON.parse(saved) : { gender: 'homem', level: 'iniciante', environment: 'ginasio', homeEquipment: [] }
    })
    const [activePlans, setActivePlans] = useState([])
    const [stats, setStats] = useState({ points: 0, streak: 0 })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('theme', theme)
    }, [theme])

    useEffect(() => {
        if (currentUser) {
            syncProfile();
            fetchActivePlans();
            fetchStats();
        }
    }, [currentUser, view]);

    const fetchActivePlans = async () => {
        try {
            const res = await apiFetch('/plans/active');
            const data = await res.json();
            setActivePlans(Array.isArray(data) ? data : []);
        } catch (err) { console.error(err); }
    }

    const fetchStats = async () => {
        try {
            const res = await apiFetch('/stats');
            const data = await res.json();
            setStats(data);
        } catch (err) { console.error(err); }
    }

    const syncProfile = async () => {
        try {
            const res = await apiFetch('/auth/profile');
            const data = await res.json();
            if (data.profile) {
                setProfile(data.profile);
                localStorage.setItem('user_profile', JSON.stringify(data.profile));
            }
        } catch (err) {
            console.error("Profile sync failed:", err);
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('fitToken')
        localStorage.removeItem('fitUser')
        setCurrentUser(null)
        setView('home')
    }

    const handleAbandonPlan = async (planId) => {
        if (!window.confirm('Tens a certeza que queres desistir deste plano? Esta ação não pode ser desfeita.')) return;
        try {
            const res = await apiFetch(`/plans/${planId}`, { method: 'DELETE' });
            if (res.ok) {
                setActivePlans(prev => prev.filter(p => p.id !== planId));
            } else {
                throw new Error('Falha ao abandonar plano');
            }
        } catch (err) {
            alert(err.message);
        }
    }

    const handleGenerate = async (params) => {
        setGenerating(true)
        try {
            const response = await apiFetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...params, profile })
            })
            const data = await response.json()
            setWorkoutData(data)
            setView('workout')
        } catch (err) {
            console.error("Erro ao gerar treino:", err)
            alert("Ligação ao servidor falhou. A mostrar exemplo local.")
            const localFallback = {
                totalTime: params.time,
                exercises: [
                    { name: "Flexão de Braços", sets: 3, reps: "12", order: 1, weight_h: "BW", weight_m: "BW", safety_notes: "Aperta o core." },
                    { name: "Agachamento Livre", sets: 3, reps: "15", order: 2, weight_h: "BW", weight_m: "BW", safety_notes: "Calcanhares no chão." }
                ],
                summary: { ...params, method: 'Local fallback' }
            }
            setWorkoutData(localFallback)
            setView('workout')
        } finally {
            setGenerating(false)
        }
    }

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light')
    }

    const HomeDashboard = ({ currentUser, toggleTheme, theme, handleLogout, handleAbandonPlan, stats, setView, activePlans, setWorkoutData }) => (
        <div className="workout-dashboard animate-fade">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.2rem', opacity: 0.6 }}>Bem-vindo de volta,</p>
                    <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.8rem' }}>{currentUser.name.split(' ')[0]}</h2>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={toggleTheme} className="chip" style={{ borderRadius: '1rem', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                    <button onClick={handleLogout} className="chip" style={{ borderRadius: '1rem', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            {/* Daily Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-box">
                    <label><TrendingUp size={16} color="var(--primary-color)" /> Streak</label>
                    <div className="value">{stats?.streak || 0} Dias</div>
                </div>
                <div className="stat-box">
                    <label><Trophy size={16} color="#f59e0b" /> Pontos</label>
                    <div className="value">{(stats?.points || 0).toLocaleString()}</div>
                </div>
            </div>

            {/* AI Generation Card - ALWAYS VISIBLE */}
            <div className="premium-card" style={{
                background: 'linear-gradient(135deg, var(--primary-color), #4f46e5)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                marginBottom: '1.5rem',
                border: 'none',
                cursor: 'pointer'
            }} onClick={() => setView('form')}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.2rem' }}>
                        <Sparkles size={16} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>IA Inteligente</span>
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Gerar Treino de Hoje</h3>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginBottom: '1rem' }}>Sessão isolada para dias sem plano ou extra.</p>
                </div>
                <Dumbbell size={100} style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.15, transform: 'rotate(-20deg)' }} />
            </div>

            {/* Active Plans List */}
            {activePlans.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', opacity: 0.6, marginBottom: '1rem', fontWeight: 800 }}>Planos em Curso</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {activePlans.map(plan => (
                            <div key={plan.id} className="premium-card flex-between" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary-color)', cursor: 'pointer' }} onClick={() => { setWorkoutData({ planId: plan.id }); setView('calendar'); }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: 'var(--primary-glow)', padding: '0.6rem', borderRadius: '0.75rem' }}>
                                        <Calendar size={20} color="var(--primary-color)" />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem' }}>{plan.title}</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>{plan.workouts?.filter(w => w.completed).length}/{plan.workouts?.length} treinos concluídos</p>
                                    </div>
                                </div>
                                    <ChevronRight size={20} opacity={0.3} />
                                </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Navigation Shortcuts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div className="premium-card" style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setView('box')}>
                    <Users size={24} style={{ margin: '0 auto 0.5rem', color: 'var(--primary-color)' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>Box / Aulas</div>
                </div>
                <div className="premium-card" style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setView('history')}>
                    <TrendingUp size={24} style={{ margin: '0 auto 0.5rem', color: 'var(--primary-color)' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>Progresso</div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="app-shell" style={{ paddingBottom: '120px' }}>
            <main className="container animate-fade">
                {/* Fullscreen AI Loading Overlay */}
                {generating && (
                    <div className="glass" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9999, gap: '2rem', padding: '2rem', border: 'none'
                    }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%',
                            border: '6px solid var(--surface-color)', borderTopColor: 'var(--primary-color)',
                            animation: 'spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite'
                        }} />
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ marginBottom: '0.5rem' }}>🤖 A moldar o teu treino...</h2>
                            <p style={{ maxWidth: '320px', margin: '0 auto' }}>A IA está a otimizar cada repetição para os teus objetivos.</p>
                        </div>
                    </div>
                )}

                {!currentUser ? (
                    <AuthView onLoginSuccess={setCurrentUser} />
                ) : (
                    <>
                        {view === 'home' && (
                            <HomeDashboard
                                currentUser={currentUser}
                                toggleTheme={toggleTheme}
                                theme={theme}
                                handleLogout={handleLogout}
                                handleAbandonPlan={handleAbandonPlan}
                                stats={stats}
                                setView={setView}
                                activePlans={activePlans}
                                setWorkoutData={setWorkoutData}
                            />
                        )}
                        {view === 'form' && <WorkoutForm onGenerate={handleGenerate} profile={profile} onBack={() => setView('home')} />}

                        {view === 'workout' && workoutData && (
                            <WorkoutView
                                data={workoutData}
                                onBack={() => {
                                    if (workoutData.scheduledWorkoutId) {
                                        setView('calendar')
                                    } else {
                                        setView('home')
                                    }
                                }}
                            />
                        )}

                        {view === 'about' && <AboutPage onBack={() => setView('home')} />}
                        {view === 'settings' && <SettingsView onBack={() => setView('home')} onSave={(d) => setProfile(d.profile)} onSwitchView={setView} user={currentUser} />}
                        {view === 'planner' && <TrainingPlanner onBack={() => setView('home')} profile={profile} />}
                        {view === 'history' && <HistoryView onBack={() => setView('home')} />}
                        {view === 'benchmarks' && <BenchmarksView onBack={() => setView('home')} />}
                        {view === 'library' && <CustomLibrary onBack={() => setView('home')} />}
                        {view === 'box' && <BoxView user={currentUser} onBack={() => setView('home')} />}
                        {view === 'calendar' && (
                            <CalendarView
                                planId={workoutData?.planId}
                                onBack={() => {
                                    setWorkoutData(null);
                                    setView('home');
                                }}
                                onNewPlan={() => setView('planner')}
                                onStartWorkout={(w) => {
                                    setWorkoutData({ ...w.content, scheduledWorkoutId: w.id });
                                    setView('workout');
                                }}
                            />
                        )}
                    </>
                )}
            </main>

            {/* Mobile Bottom Navigation - Premium Floating Bar */}
            <div className="bottom-nav">
                <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>
                    <Play size={20} fill={view === 'home' ? 'currentColor' : 'none'} />
                    <span>Treino</span>
                </button>
                <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>
                    <Calendar size={20} fill={view === 'calendar' ? 'currentColor' : 'none'} />
                    <span>Plano</span>
                </button>
                <button className={view === 'box' ? 'active' : ''} onClick={() => setView('box')}>
                    <Users size={20} fill={view === 'box' ? 'currentColor' : 'none'} />
                    <span>{currentUser?.boxId ? 'A Minha Box' : 'Config. Box'}</span>
                </button>
                <button className={view === 'benchmarks' ? 'active' : ''} onClick={() => setView('benchmarks')}>
                    <Medal size={20} fill={view === 'benchmarks' ? 'currentColor' : 'none'} />
                    <span>WODs</span>
                </button>
                <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
                    <TrendingUp size={20} fill={view === 'history' ? 'currentColor' : 'none'} />
                    <span>Progresso</span>
                </button>
                <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>
                    <Settings size={20} fill={view === 'settings' ? 'currentColor' : 'none'} />
                    <span>Ajustes</span>
                </button>
            </div>
        </div>
    )
}

export default App
