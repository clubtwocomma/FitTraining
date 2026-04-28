import React, { useState, useEffect } from 'react';
import { Calendar, Users, Award, Plus, Trash2, CheckCircle2, Clock, MapPin, ChevronRight, Play, QrCode, UserCheck, XCircle, Settings, Edit2, Copy, Share } from 'lucide-react';
import { apiFetch } from '../lib/api';

const UserManagement = ({ user, boxUsers, handleValidateAthlete, handleUpdateRole }) => (
    <div className="user-management animate-slide-up">
        <h3 style={{ fontWeight: 900, marginBottom: '2rem' }}>Atletas Inscritos</h3>
        <div className="premium-card" style={{ background: 'white' }}>
            <div style={{ padding: '1.5rem' }}>
                {boxUsers.length === 0 ? <p>Nenhum atleta associado.</p> : (
                    boxUsers.map(u => (
                        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--surface-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '45px', height: '45px', background: u.boxValidated ? 'var(--primary-glow)' : '#fff7ed', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {u.boxValidated ? <UserCheck color="var(--primary-color)" /> : <Clock color="#f59e0b" />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800 }}>{u.name}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{u.email} • {u.role}</div>
                                </div>
                            </div>
                            {!u.boxValidated ? (
                                <button onClick={() => handleValidateAthlete(u.id)} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Validar</button>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#22c55e', fontWeight: 800 }}>✓ Ativo</span>
                                    {(user.role === 'ADMIN' || user.role === 'BOX_ADMIN') && user.id !== u.id && u.role !== 'ADMIN' && (
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                            style={{ fontSize: '0.75rem', padding: '0.3rem', borderRadius: '0.5rem', border: '1px solid var(--surface-color)', background: 'var(--surface-color)' }}
                                        >
                                            <option value="ATHLETE">Atleta</option>
                                            <option value="COACH">Coach</option>
                                            <option value="BOX_ADMIN">Box Admin</option>
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
);

const BoxSettings = ({ box, newBoxName, setNewBoxName, newBoxLocation, setNewBoxLocation, handleUpdateBox, copyInviteCode, shareInviteLink }) => (
    <div className="box-settings animate-slide-up">
        <h3 style={{ fontWeight: 900, marginBottom: '2rem' }}>Definições da Box</h3>
        <div className="premium-card" style={{ background: 'white', padding: '2rem' }}>
            <form onSubmit={handleUpdateBox} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                    <label>Nome da Box</label>
                    <input type="text" value={newBoxName} onChange={e => setNewBoxName(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                    <label>Localização</label>
                    <input type="text" value={newBoxLocation} onChange={e => setNewBoxLocation(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                    <label>Código de Convite (Ativo)</label>
                    <div style={{
                        background: '#f8fafc',
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        border: '1px dashed #cbd5e1',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ fontWeight: 900, fontSize: '1.8rem', color: 'var(--primary-color)', letterSpacing: '4px' }}>
                            {box?.inviteCode}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                            <button type="button" onClick={copyInviteCode} className="chip" style={{ background: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Copy size={14} /> Copiar
                            </button>
                            <button type="button" onClick={shareInviteLink} className="chip" style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Share size={14} /> Partilhar
                            </button>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '0.5rem', textAlign: 'center' }}>Distribui este código pelo WhatsApp ou e-mail dos teus atletas.</p>
                </div>
                <button type="submit" className="btn btn-primary">Guardar Alterações</button>
            </form>
        </div>
    </div>
);

const ClassManager = ({ boxId, onUpdate }) => {
    const [showAddClass, setShowAddClass] = useState(false);
    const [classTime, setClassTime] = useState('');
    const [classCapacity, setClassCapacity] = useState(12);

    const handleCreateClass = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch(`/boxes/${boxId}/classes`, {
                method: 'POST',
                body: JSON.stringify({ startTime: classTime, capacity: classCapacity })
            });
            if (res.ok) {
                alert('Aula criada!');
                setShowAddClass(false);
                onUpdate();
            }
        } catch (err) { console.error(err); }
    };

    return (
        <div className="class-manager">
            <button onClick={() => setShowAddClass(!showAddClass)} className="btn btn-primary" style={{ marginBottom: '1.5rem' }}>
                {showAddClass ? 'Cancelar' : '+ Agendar Aula'}
            </button>

            {showAddClass && (
                <div className="premium-card animate-slide-up" style={{ background: 'white', marginBottom: '2rem', padding: '2rem' }}>
                    <h4 style={{ marginBottom: '1.5rem', fontWeight: 900 }}>Nova Aula no Horário</h4>
                    <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input type="datetime-local" value={classTime} onChange={e => setClassTime(e.target.value)} required className="form-input" />
                        <input type="number" value={classCapacity} onChange={e => setClassCapacity(e.target.value)} required placeholder="Capacidade" className="form-input" />
                        <button type="submit" className="btn btn-primary">Adicionar ao Horário</button>
                    </form>
                </div>
            )}

            <div className="premium-card" style={{ background: 'white', padding: '1.5rem' }}>
                <h4 style={{ fontWeight: 800 }}>Aulas Ativas</h4>
                <div style={{ opacity: 0.5, fontSize: '0.9rem' }}>Aqui podes gerir as aulas existentes (brevemente: eliminar/editar).</div>
            </div>
        </div>
    );
};

const ManagementDashboard = ({ user, handleUpdateRole, mgmtTab, setMgmtTab, isManager, classes, attendanceList, setAttendanceList, boxId, fetchData, boxUsers, handleValidateAthlete, box, newBoxName, setNewBoxName, newBoxLocation, setNewBoxLocation, handleUpdateBox, copyInviteCode, shareInviteLink }) => {
    return (
        <div className="mgmt-view animate-fade">
            <div className="tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: '#e2e8f0', padding: '0.35rem', borderRadius: '1rem' }}>
                {[
                    { id: 'attendance', name: 'Presenças', icon: Users },
                    { id: 'classes', name: 'Horário', icon: Calendar },
                    { id: 'users', name: 'Atletas', icon: UserCheck, adminOnly: true },
                    { id: 'settings', name: 'Definições', icon: Settings, adminOnly: true }
                ].map(t => (
                    (!t.adminOnly || isManager) && (
                        <button key={t.id} onClick={() => setMgmtTab(t.id)} className={`tab-btn ${mgmtTab === t.id ? 'active' : ''}`} style={{ flex: 1, fontSize: '0.8rem', padding: '0.6rem' }}>
                            <t.icon size={14} /> {t.name}
                        </button>
                    )
                ))}
            </div>

            {mgmtTab === 'attendance' && (
                <div className="attendance-mgmt">
                    <div className="premium-card" style={{ background: 'white' }}>
                        <h4 style={{ padding: '1.5rem', borderBottom: '1px solid var(--surface-color)', margin: 0 }}>Mapa de Aulas & Presenças</h4>
                        <div style={{ padding: '1.5rem' }}>
                            {classes.length === 0 ? <p style={{ opacity: 0.5 }}>Nenhuma aula agendada.</p> : classes.map(cls => (
                                <div key={cls.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--surface-color)' }}>
                                    <div>
                                        <div style={{ fontWeight: 800 }}>{new Date(cls.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - WOD</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{cls._count?.bookings || 0} / {cls.capacity} Inscritos</div>
                                    </div>
                                    <button onClick={() => setAttendanceList({ classId: cls.id, users: cls.bookings || [] })} className="chip" style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)' }}>
                                        Ver Lista
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {attendanceList && (
                        <div className="premium-card animate-slide-up" style={{ background: '#f8fafc', marginTop: '2rem', padding: '2rem', border: '2px solid var(--primary-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h4 style={{ margin: 0, fontWeight: 900 }}>Lista de Presenças</h4>
                                <button onClick={() => setAttendanceList(null)} className="chip" style={{ background: 'white' }}>Fechar</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {attendanceList.users.length === 0 ? <p style={{ opacity: 0.5 }}>Ninguém inscrito ainda.</p> : (
                                    attendanceList.users.map(b => (
                                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'white', borderRadius: '1rem' }}>
                                            <div style={{ width: '40px', height: '40px', background: 'var(--primary-glow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Users size={18} color="var(--primary-color)" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800 }}>{b.user.name}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{b.user.email}</div>
                                            </div>
                                            <CheckCircle2 color="#22c55e" size={20} />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {mgmtTab === 'classes' && (
                <div className="classes-mgmt">
                    <ClassManager boxId={boxId} onUpdate={fetchData} />
                </div>
            )}

            {mgmtTab === 'users' && <UserManagement user={user} handleUpdateRole={handleUpdateRole} boxUsers={boxUsers} handleValidateAthlete={handleValidateAthlete} />}
            {mgmtTab === 'settings' && <BoxSettings box={box} newBoxName={newBoxName} setNewBoxName={setNewBoxName} newBoxLocation={newBoxLocation} setNewBoxLocation={setNewBoxLocation} handleUpdateBox={handleUpdateBox} copyInviteCode={copyInviteCode} shareInviteLink={shareInviteLink} />}
        </div>
    );
}

const MemberSchedule = ({ classes, user, bookingLoading, handleBooking }) => {
    const [expandedClassId, setExpandedClassId] = useState(null);
    return (
        <div className="member-schedule animate-fade">
            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontWeight: 900, margin: 0 }}>Horário de Hoje</h3>
                <p style={{ opacity: 0.5 }}>Escolhe a tua aula e garante a tua vaga.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {classes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.3 }}>Nenhuma aula publicada hoje.</div>
                ) : classes.map(cls => {
                    const booking = cls.bookings?.find(b => b.userId === user.id && b.status === 'CONFIRMED');
                    return (
                        <React.Fragment key={cls.id}>
                            <div className="premium-card hover-lift"
                                style={{
                                    background: 'white',
                                    padding: '1.5rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    border: booking ? '2px solid var(--primary-color)' : '1px solid var(--glass-border)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setExpandedClassId(expandedClassId === cls.id ? null : cls.id)}
                            >
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flex: 1 }}>
                                    <div style={{ background: booking ? 'var(--primary-color)' : 'var(--primary-glow)', padding: '0.75rem', borderRadius: '1rem', textAlign: 'center', minWidth: '70px' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: booking ? 'white' : 'var(--primary-color)' }}>
                                            {new Date(cls.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: booking ? 0.8 : 0.6, color: booking ? 'white' : 'inherit' }}>Início</div>
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                                            WOD & Skills
                                            {booking && <CheckCircle2 size={16} color="var(--primary-color)" style={{ marginLeft: '8px' }} />}
                                        </h4>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span><Users size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {cls._count?.bookings || 0} / {cls.capacity} Vagas</span>
                                            {booking && <span style={{ color: 'var(--primary-color)', fontWeight: 800 }}>• Reservado</span>}
                                            <span style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 800, background: 'var(--primary-glow)', padding: '0.2rem 0.5rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {expandedClassId === cls.id ? 'Esconder Lista' : 'Ver Inscritos'}
                                                <ChevronRight size={14} style={{ transform: expandedClassId === cls.id ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className={`btn ${bookingLoading === cls.id ? 'loading' : ''} ${booking ? 'btn-outline' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleBooking(cls);
                                    }}
                                    style={{
                                        width: 'auto',
                                        padding: '0.75rem 1.5rem',
                                        background: booking ? 'transparent' : 'var(--primary-color)',
                                        color: booking ? 'var(--primary-color)' : 'white',
                                        borderColor: booking ? 'var(--primary-color)' : 'transparent',
                                        opacity: (!booking && cls._count?.bookings >= cls.capacity) ? 0.3 : 1
                                    }}
                                    disabled={(!booking && cls._count?.bookings >= cls.capacity) || bookingLoading === cls.id}
                                >
                                    {booking ? 'Cancelar' : (cls._count?.bookings >= cls.capacity ? 'Lotado' : 'Reservar')}
                                </button>
                            </div>
                            {/* User List Expandable Section */}
                            {expandedClassId === cls.id && (
                                <div style={{ marginTop: '-1rem', marginBottom: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '0 0 1rem 1rem', border: '1px solid var(--glass-border)', borderTop: 'none', borderLeft: booking ? '2px solid var(--primary-color)' : '1px solid var(--glass-border)', borderRight: booking ? '2px solid var(--primary-color)' : '1px solid var(--glass-border)', borderBottom: booking ? '2px solid var(--primary-color)' : '1px solid var(--glass-border)' }}>
                                    <h5 style={{ fontWeight: 800, margin: '0 0 1rem 0', opacity: 0.7, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Users size={14} /> Atletas Inscritos ({cls.bookings?.length || 0})
                                    </h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                                        {cls.bookings?.length === 0 ? (
                                            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Sem inscrições.</div>
                                        ) : (
                                            cls.bookings?.map(b => (
                                                <div key={b.user?.id || Math.random()} style={{ background: 'white', padding: '0.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: b.userId === user.id ? 'var(--primary-color)' : '#94a3b8' }}></div>
                                                    {b.userId === user.id ? 'Eu (' + (b.user?.name ? b.user.name.split(' ')[0] : 'Admin') + ')' : (b.user?.name || 'Atleta Anónimo')}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

const WodDisplay = ({ wods, isCoach, user, fetchData }) => {
    const todayWod = wods[0];
    const [results, setResults] = useState([]);
    const [score, setScore] = useState('');
    const [type, setType] = useState('RX');
    const [submitting, setSubmitting] = useState(false);
    const [showAddWod, setShowAddWod] = useState(false);

    // Form states for adding WOD
    const [title, setTitle] = useState('');
    const [stimulus, setStimulus] = useState('');
    const [warmup, setWarmup] = useState('');
    const [mainWorkout, setMainWorkout] = useState('');
    const [cooldown, setCooldown] = useState('');

    useEffect(() => {
        if (todayWod) fetchResults();
    }, [todayWod]);

    const fetchResults = async () => {
        try {
            const res = await apiFetch(`/boxes/${user.boxId}/results`);
            const data = await res.json();
            setResults(Array.isArray(data) ? data : []);
        } catch (err) { console.error(err); }
    };

    const handleLogResult = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await apiFetch('/box/results', {
                method: 'POST',
                body: JSON.stringify({ boxWodId: todayWod.id, score, type })
            });
            if (res.ok) {
                setScore('');
                fetchResults();
            }
        } catch (err) { console.error(err); }
        finally { setSubmitting(false); }
    }

    const handlePublishWod = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch(`/boxes/${user.boxId}/wods`, {
                method: 'POST',
                body: JSON.stringify({
                    title, stimulus,
                    content: { warmup, main: mainWorkout, cooldown }
                })
            });
            if (res.ok) {
                alert('WOD publicado!');
                setShowAddWod(false);
                fetchData();
            }
        } catch (err) { console.error(err); }
    };

    return (
        <div className="wod-display animate-slide-up">
            {isCoach && (
                <button onClick={() => setShowAddWod(!showAddWod)} className="btn btn-outline" style={{ marginBottom: '2rem', borderStyle: 'dashed' }}>
                    {showAddWod ? 'Cancelar' : '+ Publicar WOD Staff'}
                </button>
            )}

            {showAddWod && (
                <div className="premium-card animate-slide-up" style={{ background: 'white', marginBottom: '2rem', padding: '2rem' }}>
                    <h4 style={{ marginBottom: '1.5rem', fontWeight: 900 }}>Publicar Treino do Dia</h4>
                    <form onSubmit={handlePublishWod} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Título (ex: Fran)" className="form-input" />
                        <input type="text" value={stimulus} onChange={e => setStimulus(e.target.value)} placeholder="Estímulo (ex: Sprint)" className="form-input" />
                        <textarea rows="2" value={warmup} onChange={e => setWarmup(e.target.value)} placeholder="Warm-up" className="form-input"></textarea>
                        <textarea rows="4" value={mainWorkout} onChange={e => setMainWorkout(e.target.value)} required placeholder="WOD Content" className="form-input"></textarea>
                        <button type="submit" className="btn btn-primary">Lançar Treino</button>
                    </form>
                </div>
            )}

            {!todayWod ? (
                <div style={{ textAlign: 'center', padding: '5rem', opacity: 0.3 }}>
                    <Calendar size={48} style={{ marginBottom: '1rem' }} />
                    <p>Nenhum WOD publicado para hoje.</p>
                </div>
            ) : (
                <>
                    <div className="premium-card" style={{ padding: '0', overflow: 'hidden', background: 'white', marginBottom: '2rem' }}>
                        <div style={{ padding: '3rem 2rem', background: 'linear-gradient(135deg, var(--primary-color), #4f46e5)', color: 'white', textAlign: 'center' }}>
                            <Award size={48} style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
                            <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 900 }}>{todayWod.title}</h2>
                            <div style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', borderRadius: '2rem', background: 'rgba(255,255,255,0.2)', display: 'inline-block', fontWeight: 800 }}>
                                {todayWod.stimulus}
                            </div>
                        </div>

                        <div style={{ padding: '2.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                {['warmup', 'main', 'cooldown'].map(section => (
                                    todayWod.content[section] && (
                                        <div key={section} className="premium-card" style={{ background: '#f8fafc', padding: '1.5rem', border: 'none' }}>
                                            <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.5, marginBottom: '1rem' }}>{section}</h4>
                                            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                                {todayWod.content[section]}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        <div className="premium-card" style={{ background: 'white', padding: '2rem' }}>
                            <h4 style={{ fontWeight: 900, marginBottom: '1.5rem' }}>Registar Resultado</h4>
                            <form onSubmit={handleLogResult} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="input-group">
                                    <label style={{ fontWeight: 700, fontSize: '0.85rem', opacity: 0.6 }}>O Teu Resultado (Tempo/Reps/KG)</label>
                                    <input type="text" value={score} onChange={e => setScore(e.target.value)} required placeholder="Ex: 12:45, 150 reps, 80kg" className="form-input" />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {['RX', 'Scaled'].map(t => (
                                        <button key={t} type="button" onClick={() => setType(t)} className={`chip ${type === t ? 'active' : ''}`} style={{ flex: 1 }}>{t}</button>
                                    ))}
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'A guardar...' : 'Submeter Marca'}
                                </button>
                            </form>
                        </div>

                        <div className="premium-card" style={{ background: 'white', padding: '2rem' }}>
                            <h4 style={{ fontWeight: 900, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Award size={20} color="var(--primary-color)" /> Leaderboard
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {results.length === 0 ? <p style={{ opacity: 0.5, textAlign: 'center', padding: '2rem' }}>Ainda ninguém registou marcas hoje.</p> : (
                                    results.map((res, idx) => (
                                        <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '1rem', background: idx < 3 ? 'var(--primary-glow)' : '#f8fafc' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ fontWeight: 900, opacity: 0.3, width: '20px' }}>{idx + 1}</div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{res.user.name}</div>
                                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.5, fontWeight: 700 }}>{res.type}</div>
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: 900, color: 'var(--primary-color)', fontSize: '1.1rem' }}>{res.score}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default function BoxView({ user, onBack }) {
    const [view, setView] = useState('schedule'); // 'schedule', 'wod', 'management'
    const [mgmtTab, setMgmtTab] = useState('attendance'); // 'attendance', 'classes', 'settings', 'users'
    const [box, setBox] = useState(null);
    const [classes, setClasses] = useState([]);
    const [wods, setWods] = useState([]);
    const [boxUsers, setBoxUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(null);
    const [attendanceList, setAttendanceList] = useState(null);
    const [inviteCode, setInviteCode] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);

    // Box Creation/Edit States
    const [showCreateBox, setShowCreateBox] = useState(false);
    const [newBoxName, setNewBoxName] = useState('');
    const [newBoxLocation, setNewBoxLocation] = useState('');

    const isManager = user?.role === 'ADMIN' || user?.role === 'BOX_ADMIN';
    const isCoach = isManager || user?.role === 'COACH';

    useEffect(() => {
        if (user?.boxId) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [view, user?.boxId]);

    const fetchData = async () => {
        if (!user?.boxId) return;
        setLoading(true);
        try {
            const endpoints = [
                apiFetch(`/boxes/${user.boxId}`),
                apiFetch(`/boxes/${user.boxId}/classes`),
                apiFetch(`/boxes/${user.boxId}/wods`)
            ];

            if (isCoach && (view === 'management')) {
                endpoints.push(apiFetch(`/boxes/${user.boxId}/users`));
            }

            const responses = await Promise.all(endpoints);
            const boxData = await responses[0].json();
            const classesData = await responses[1].json();
            const wodsData = await responses[2].json();

            setBox(boxData);
            setClasses(Array.isArray(classesData) ? classesData : []);
            setWods(Array.isArray(wodsData) ? wodsData : []);

            if (newBoxName === '') setNewBoxName(boxData.name || '');
            if (newBoxLocation === '') setNewBoxLocation(boxData.location || '');

            if (isCoach && view === 'management' && responses[3]) {
                const usersData = await responses[3].json();
                setBoxUsers(Array.isArray(usersData) ? usersData : []);
            }
        } catch (err) {
            console.error("Error fetching box data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinBox = async (e) => {
        e.preventDefault();
        setJoinLoading(true);
        try {
            const res = await apiFetch('/boxes/join', {
                method: 'POST',
                body: JSON.stringify({ inviteCode })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Bem-vindo à ${data.boxName}! Aguarda agora a validação do administrador.`);
                window.location.reload();
            } else {
                alert(data.error || 'Erro ao aderir à box.');
            }
        } catch (err) {
            alert('Erro na ligação ao servidor.');
        } finally {
            setJoinLoading(false);
        }
    };

    const handleCreateBox = async (e) => {
        e.preventDefault();
        setJoinLoading(true);
        try {
            const res = await apiFetch('/boxes', {
                method: 'POST',
                body: JSON.stringify({ name: newBoxName, location: newBoxLocation })
            });
            if (res.ok) {
                alert('Box criada com sucesso! Podes agora convidar atletas.');
                window.location.reload();
            } else {
                const data = await res.json();
                alert(data.error || 'Erro ao criar box.');
            }
        } catch (err) { alert('Erro ao criar box.'); }
        finally { setJoinLoading(false); }
    };

    const handleUpdateBox = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch(`/boxes/${user.boxId}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: newBoxName, location: newBoxLocation })
            });
            if (res.ok) {
                alert('Definições da Box atualizadas!');
                fetchData();
            }
        } catch (err) { console.error(err); }
    };

    const copyInviteCode = () => {
        if (!box?.inviteCode) return;
        navigator.clipboard.writeText(box.inviteCode);
        alert("Código de convite copiado para a área de transferência! 📋");
    };

    const shareInviteLink = () => {
        if (!box?.inviteCode) return;
        const text = `Junta-te à minha Box ${box.name} no FitTraining! Usa o código: ${box.inviteCode}`;
        if (navigator.share) {
            navigator.share({
                title: 'Convidar para FitTraining',
                text: text,
                url: window.location.origin
            }).catch(console.error);
        } else {
            copyInviteCode();
        }
    };

    const handleUpdateRole = async (userId, newRole) => {
        try {
            const res = await apiFetch(`/boxes/${user.boxId}/users/${userId}/role`, {
                method: 'PATCH',
                body: JSON.stringify({ role: newRole })
            });
            if (res.ok) {
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || 'Erro ao atualizar permissões.');
            }
        } catch (err) { console.error(err); }
    };

    const handleValidateAthlete = async (athleteId) => {
        try {
            const res = await apiFetch(`/boxes/${user.boxId}/users/${athleteId}/validate`, {
                method: 'PATCH'
            });
            if (res.ok) {
                alert('Atleta validado!');
                fetchData();
            }
        } catch (err) { console.error(err); }
    };

    const handleBooking = async (cls) => {
        const booking = cls.bookings?.find(b => b.userId === user.id && b.status === 'CONFIRMED');
        setBookingLoading(cls.id);
        try {
            const method = booking ? 'DELETE' : 'POST';
            const url = booking ? `/bookings/${booking.id}` : '/bookings';

            const res = await apiFetch(url, {
                method,
                body: booking ? null : JSON.stringify({ classId: cls.id })
            });

            if (res.ok) {
                alert(booking ? 'Reserva cancelada.' : 'Reserva efetuada com sucesso!');
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || 'Erro na operação.');
            }
        } catch (err) {
            alert('Erro na ligação ao servidor.');
        } finally {
            setBookingLoading(null);
        }
    };

    if (!user?.boxId) return (
        <div className="box-selection animate-slide-up" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div className="premium-card" style={{ maxWidth: '500px', margin: '0 auto', background: 'white', padding: '3rem' }}>
                {!showCreateBox ? (
                    <>
                        <QrCode size={64} color="var(--primary-color)" style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
                        <h2 style={{ fontWeight: 900, marginBottom: '1rem' }}>Sócio de uma Box?</h2>
                        <p style={{ opacity: 0.6, marginBottom: '2.5rem' }}>Insere o código de convite do teu ginásio para te associares e veres os horários.</p>

                        <form onSubmit={handleJoinBox} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={e => setInviteCode(e.target.value)}
                                placeholder="Código de Convite"
                                className="form-input"
                                style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}
                                required
                            />
                            <button type="submit" className={`btn btn-primary ${joinLoading ? 'loading' : ''}`} disabled={joinLoading}>
                                Aderir à Box
                            </button>
                        </form>

                        <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--surface-color)' }}>
                            <p style={{ opacity: 0.5, marginBottom: '1rem' }}>És proprietário de um ginásio?</p>
                            <button onClick={() => setShowCreateBox(true)} className="chip" style={{ width: '100%', padding: '1rem' }}>Registar Nova Box</button>
                        </div>
                    </>
                ) : (
                    <>
                        <Plus size={64} color="var(--primary-color)" style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
                        <h2 style={{ fontWeight: 900, marginBottom: '1rem' }}>Criar Nova Box</h2>
                        <p style={{ opacity: 0.6, marginBottom: '2.5rem' }}>Cria o teu espaço, gere atletas e partilha horários.</p>

                        <form onSubmit={handleCreateBox} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input type="text" value={newBoxName} onChange={e => setNewBoxName(e.target.value)} placeholder="Nome do Ginásio/Box" className="form-input" required />
                            <input type="text" value={newBoxLocation} onChange={e => setNewBoxLocation(e.target.value)} placeholder="Localização (Cidade/Rua)" className="form-input" />
                            <button type="submit" className={`btn btn-primary ${joinLoading ? 'loading' : ''}`} disabled={joinLoading}>
                                Criar e Ser Admin
                            </button>
                            <button type="button" onClick={() => setShowCreateBox(false)} className="chip" style={{ background: 'transparent' }}>Cancelar</button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );

    if (!user?.boxValidated && !isManager) return (
        <div className="validation-pending animate-fade" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <Clock size={64} color="#f59e0b" style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
            <h2 style={{ fontWeight: 900 }}>Aprovação Pendente</h2>
            <p style={{ opacity: 0.6, maxWidth: '400px', margin: '0 auto' }}>
                Já pertences a **{box?.name}**, mas o administrador ainda não validou a tua conta. Fala com a equipa técnica.
            </p>
            <button onClick={() => window.location.reload()} className="chip" style={{ marginTop: '2rem' }}>Verificar Status</button>
        </div>
    );


    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
            <div className="loader"></div>
        </div>
    );

    return (
        <div className="box-view-container animate-fade">
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <button onClick={onBack} className="chip" style={{ background: 'transparent', padding: '0', fontSize: '0.8rem', marginBottom: '0.5rem' }}>← Voltar</button>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 900, margin: 0 }}>
                        <Users color="var(--primary-color)" size={32} /> {box?.name || 'A Minha Box'}
                    </h1>
                    <p style={{ opacity: 0.5, margin: '0.5rem 0 0 0' }}>{box?.location || 'Gere as tuas aulas e acompanha a comunidade.'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="chip" style={{ background: 'var(--secondary-color)', color: 'white' }}>{isManager ? 'BOX ADMIN' : isCoach ? 'COACH' : 'ATLETA'}</div>
                </div>
            </header>

            <div className="tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2.5rem', background: '#f1f5f9', padding: '0.5rem', borderRadius: '1.25rem' }}>
                <button onClick={() => setView('schedule')} className={`tab-btn ${view === 'schedule' ? 'active' : ''}`} style={{ flex: 1 }}>Aulas</button>
                <button onClick={() => setView('wod')} className={`tab-btn ${view === 'wod' ? 'active' : ''}`} style={{ flex: 1 }}>WOD</button>
                {isCoach && <button onClick={() => setView('management')} className={`tab-btn ${view === 'management' ? 'active' : ''}`} style={{ flex: 1 }}>Gestão</button>}
            </div>

            {view === 'schedule' && (
                <MemberSchedule
                    classes={classes}
                    user={user}
                    bookingLoading={bookingLoading}
                    handleBooking={handleBooking}
                />
            )}
            {view === 'wod' && (
                <WodDisplay
                    wods={wods}
                    isCoach={isCoach}
                    user={user}
                    fetchData={fetchData}
                />
            )}
            {view === 'management' && isCoach && (
                <ManagementDashboard
                    user={user}
                    handleUpdateRole={handleUpdateRole}
                    mgmtTab={mgmtTab}
                    setMgmtTab={setMgmtTab}
                    isManager={isManager}
                    classes={classes}
                    attendanceList={attendanceList}
                    setAttendanceList={setAttendanceList}
                    boxId={user.boxId}
                    fetchData={fetchData}
                    boxUsers={boxUsers}
                    handleValidateAthlete={handleValidateAthlete}
                    box={box}
                    newBoxName={newBoxName}
                    setNewBoxName={setNewBoxName}
                    newBoxLocation={newBoxLocation}
                    setNewBoxLocation={setNewBoxLocation}
                    handleUpdateBox={handleUpdateBox}
                    copyInviteCode={copyInviteCode}
                    shareInviteLink={shareInviteLink}
                />
            )}
        </div>
    );
}
