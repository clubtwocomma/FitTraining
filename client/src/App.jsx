import { useState, useEffect, useRef } from 'react'
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
import NotificationBell from './components/NotificationBell'
import { MoonStar, SunDim, Power, BellRing, Info, Dumbbell, Settings, Calendar, Play, Medal, Flame, BookOpen, LayoutGrid, Users, ChevronRight, Trophy, TrendingUp, Sparkles, Clock, User, ShieldCheck } from 'lucide-react'
import PasswordChangeModal from './components/PasswordChangeModal'
import { apiFetch } from './lib/api'

const UserMenu = ({ user, theme, toggleTheme, onLogout, onPasswordChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div style={{ position: 'relative' }} ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{ 
                    background: 'var(--surface-color)', border: 'none', borderRadius: '1rem', 
                    width: '48px', height: '48px', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', cursor: 'pointer', padding: 0 
                }}
            >
                <User size={24} strokeWidth={2.5} color="#64748b" />
            </button>

            {isOpen && (
                <div className="premium-card animate-scale-up" style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '0.75rem',
                    width: '240px', padding: '0.75rem', zIndex: 1000, background: 'white',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--surface-color)'
                }}>
                    <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--surface-color)', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>{user.name}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{user.email}</div>
                    </div>

                    <button className="menu-item" onClick={() => { toggleTheme(); setIsOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {theme === 'light' ? <MoonStar size={18} strokeWidth={2} /> : <SunDim size={18} strokeWidth={2} />}
                        <span>Modo {theme === 'light' ? 'Escuro' : 'Claro'}</span>
                    </button>

                    <button className="menu-item" onClick={() => { onPasswordChange(); setIsOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        <ShieldCheck size={18} strokeWidth={2} />
                        <span>Alterar Password</span>
                    </button>

                    <div style={{ borderTop: '1px solid var(--surface-color)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                        <button className="menu-item" onClick={() => { onLogout(); setIsOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '0.5rem', fontSize: '0.9rem', color: '#ef4444' }}>
                            <Power size={18} strokeWidth={2} />
                            <span>Terminar Sessão</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

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
    const [boxName, setBoxName] = useState('')
    const [boxData, setBoxData] = useState(null)
    const [showPasswordModal, setShowPasswordModal] = useState(false)

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('theme', theme)
    }, [theme])

    useEffect(() => {
        if (currentUser) {
            syncProfile();
            fetchActivePlans();
            fetchStats();
            if (currentUser.boxId) fetchBoxData();
        }
    }, [currentUser, view]);

    const fetchBoxData = async () => {
        try {
            const res = await apiFetch(`/boxes/${currentUser.boxId}`);
            if (res.ok) {
                const data = await res.json();
                setBoxName(data.name);
                setBoxData(data);
            }
        } catch (err) { console.error(err); }
    };

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
            if (res.ok) {
                const userData = await res.json();
                
                // Update fitness profile
                if (userData.profile) {
                    setProfile(userData.profile);
                    localStorage.setItem('user_profile', JSON.stringify(userData.profile));
                }

                // Update currentUser if boxId or role changed
                if (userData.boxId !== currentUser.boxId || userData.role !== currentUser.role) {
                    const updatedUser = { ...currentUser, boxId: userData.boxId, role: userData.role, boxValidated: userData.boxValidated };
                    setCurrentUser(updatedUser);
                    localStorage.setItem('fitUser', JSON.stringify(updatedUser));
                }
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

    const handlePin = async (workout) => {
        try {
            const newProfile = { ...profile, pinnedWorkout: workout, pinnedAt: new Date().toISOString() };
            const res = await apiFetch('/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile: newProfile })
            });
            if (res.ok) {
                setProfile(newProfile);
                setView('home');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleUnpin = async () => {
        try {
            const { pinnedWorkout, pinnedAt, ...restProfile } = profile;
            const res = await apiFetch('/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile: restProfile })
            });
            if (res.ok) {
                setProfile(restProfile);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const HomeDashboard = ({ currentUser, toggleTheme, theme, handleLogout, handleAbandonPlan, stats, setView, activePlans, setWorkoutData, boxName }) => (
        <div className="workout-dashboard animate-fade">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.2rem', opacity: 0.6 }}>Bem-vindo de volta,</p>
                    <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.8rem' }}>{currentUser.name.split(' ')[0]}</h2>
                    {boxName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.4rem', color: 'var(--primary-color)', fontWeight: 800, fontSize: '0.85rem' }}>
                            <Users size={14} /> {boxName}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <NotificationBell userId={currentUser.id} />
                    <UserMenu 
                        user={currentUser} 
                        theme={theme} 
                        toggleTheme={toggleTheme} 
                        onLogout={handleLogout} 
                        onPasswordChange={() => setShowPasswordModal(true)}
                    />
                </div>
            </header>

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

            {profile?.pinnedWorkout && (
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', opacity: 0.6, margin: 0, fontWeight: 800 }}>📌 Treino Fixado</h4>
                        <button onClick={(e) => { e.stopPropagation(); handleUnpin(); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Remover</button>
                    </div>
                    <div className="premium-card" style={{ 
                        padding: '1.25rem', 
                        border: '2px solid var(--primary-color)',
                        background: 'var(--primary-glow)',
                        cursor: 'pointer'
                    }} onClick={() => { setWorkoutData(profile.pinnedWorkout); setView('workout'); }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div style={{ flex: 1 }}>
                                <h4 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: 'var(--primary-color)', letterSpacing: '-0.02em' }}>{profile.pinnedWorkout.summary?.structure || 'Sessão Personalizada'}</h4>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--primary-color)', opacity: 0.8, fontWeight: 600 }}>
                                    {profile.pinnedWorkout.duration || profile.pinnedWorkout.totalTime} min • {profile.pinnedWorkout.summary?.type || 'Treino'}
                                </p>
                             </div>
                             <div style={{ background: 'var(--primary-color)', color: 'white', width: '44px', height: '44px', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px var(--primary-glow)' }}>
                                <Play size={20} fill="currentColor" />
                             </div>
                        </div>
                    </div>
                </div>
            )}

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
                        {boxData && !boxData.approved && (
                            <div className="animate-fade" style={{ padding: '2rem', textAlign: 'center', marginTop: '20vh' }}>
                                <div className="glass" style={{ padding: '3rem 2rem', borderRadius: '2.5rem' }}>
                                    <div style={{ width: '80px', height: '80px', background: 'var(--primary-glow)', color: 'var(--primary-color)', borderRadius: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                        <Clock size={32} />
                                    </div>
                                    <h2 style={{ fontWeight: 900, fontSize: '1.5rem', marginBottom: '1rem' }}>Box em Aprovação</h2>
                                    <p style={{ opacity: 0.7, maxWidth: '280px', margin: '0 auto 2rem', fontWeight: 600 }}>A tua box está a ser validada pelo administrador do sistema. Receberás um email assim que estiver pronta.</p>
                                    <button onClick={handleLogout} className="btn-primary" style={{ width: '100%', padding: '1rem', borderRadius: '1.25rem' }}>Sair</button>
                                </div>
                            </div>
                        )}
                        
                        {(!boxData || boxData.approved) && (
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
                                        boxName={boxName}
                                    />
                                )}
                                {view === 'form' && <WorkoutForm onGenerate={handleGenerate} profile={profile} onBack={() => setView('home')} />}
                                {view === 'workout' && workoutData && (
                                    <WorkoutView
                                        data={workoutData}
                                        onPin={handlePin}
                                        onBack={() => {
                                            if (workoutData.scheduledWorkoutId) setView('calendar')
                                            else setView('home')
                                        }}
                                    />
                                )}
                                {view === 'about' && <AboutPage onBack={() => setView('home')} />}
                                {view === 'settings' && <SettingsView onBack={() => setView('home')} onSave={(d) => setProfile(d.profile)} onSwitchView={setView} user={currentUser} />}
                                {view === 'planner' && <TrainingPlanner onBack={() => setView('home')} profile={profile} />}
                                {view === 'history' && <HistoryView onBack={() => setView('home')} />}
                                {view === 'benchmarks' && <BenchmarksView onBack={() => setView('home')} onStartWorkout={(w) => { setWorkoutData(w); setView('workout'); }} />}
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
                    </>
                )}
            </main>

            {currentUser && (!boxData || boxData.approved) && (
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
            )}
            {showPasswordModal && <PasswordChangeModal onClose={() => setShowPasswordModal(false)} />}
        </div>
    )
}

export default App
