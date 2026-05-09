import React, { useState, useEffect } from 'react';
import { Calendar, Users, Award, Plus, Trash2, CheckCircle2, Clock, MapPin, ChevronRight, ChevronLeft, Play, QrCode, UserCheck, XCircle, Settings, Edit2, Copy, Share, Flame, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';
import ScheduleAdmin from './admin/ScheduleAdmin';

const MonthCalendar = ({ selectedDate, onDateSelect }) => {
    const [viewDate, setViewDate] = useState(new Date(selectedDate));
    
    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();
    const currentMonthStr = viewDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }).toUpperCase();
    
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(viewYear, viewMonth, i));

    const isSameDay = (d1, d2) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };

    return (
        <div className="premium-card" style={{ marginBottom: '2rem', padding: '1.25rem', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button className="chip" onClick={() => setViewDate(new Date(viewYear, viewMonth - 1, 1))} style={{ padding: '8px' }}>
                    <ChevronLeft size={18} />
                </button>
                <div style={{ fontWeight: 900, color: 'var(--primary-color)', fontSize: '0.9rem', letterSpacing: '1px' }}>
                    {currentMonthStr}
                </div>
                <button className="chip" onClick={() => setViewDate(new Date(viewYear, viewMonth + 1, 1))} style={{ padding: '8px' }}>
                    <ChevronRight size={18} />
                </button>
            </div>
            
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)', 
                gap: '8px',
                textAlign: 'center'
            }}>
                {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(d => (
                    <div key={d} style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.3, marginBottom: '4px' }}>{d}</div>
                ))}
                {days.map((dateObj, idx) => {
                    if (!dateObj) return <div key={`empty-${idx}`} />;
                    
                    const isSelected = isSameDay(dateObj, selectedDate);
                    const isToday = isSameDay(dateObj, new Date());
                    
                    return (
                        <div 
                            key={idx}
                            onClick={() => onDateSelect(dateObj)}
                            style={{
                                padding: '8px 0',
                                borderRadius: '0.75rem',
                                fontSize: '0.9rem',
                                fontWeight: isSelected || isToday ? 800 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: isSelected ? 'var(--primary-color)' : isToday ? 'var(--primary-glow)' : 'transparent',
                                color: isSelected ? 'white' : isToday ? 'var(--primary-color)' : 'var(--text-main)',
                                border: isToday && !isSelected ? '1px solid var(--primary-color)' : '1px solid transparent'
                            }}
                        >
                            {dateObj.getDate()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const UserManagement = ({ user, boxUsers, handleValidateAthlete, handleUpdateRole }) => {
    const getStatusBadge = (status) => {
        const colors = {
            'ACTIVE': '#22c55e',
            'SUSPENDED': '#ef4444',
            'FORMER': '#94a3b8',
            'LEAD': '#3b82f6'
        };
        return (
            <span style={{ 
                fontSize: '0.65rem', 
                background: colors[status] || '#94a3b8', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: '4px',
                fontWeight: 800,
                marginLeft: '8px'
            }}>
                {status}
            </span>
        );
    };

    return (
        <div className="user-management animate-slide-up">
            <h3 style={{ fontWeight: 900, marginBottom: '1.5rem' }}>Atletas da Box ({boxUsers.length})</h3>
            <div className="premium-card" style={{ background: 'white' }}>
                <div style={{ padding: '0.5rem 1.5rem' }}>
                    {boxUsers.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                            <Users size={48} style={{ margin: '0 auto 1rem' }} />
                            <p>Nenhum atleta associado.</p>
                        </div>
                    ) : (
                        boxUsers.map(u => (
                            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 0', borderBottom: '1px solid var(--surface-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '45px', height: '45px', background: u.boxValidated ? 'var(--primary-glow)' : '#fff7ed', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {u.boxValidated ? <UserCheck color="var(--primary-color)" /> : <Clock color="#f59e0b" />}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                                            {u?.name}
                                            {getStatusBadge(u?.memberStatus || 'ACTIVE')}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{u?.email} • {u?.role}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                    {!u.boxValidated ? (
                                        <button onClick={() => handleValidateAthlete(u.id)} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Validar</button>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {(user.role === 'ADMIN' || user.role === 'BOX_ADMIN') && user.id !== u.id && u.role !== 'ADMIN' && (
                                                <select
                                                    value={u.role}
                                                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                                    style={{ fontSize: '0.75rem', padding: '0.4rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'var(--surface-color)' }}
                                                >
                                                    <option value="ATHLETE">Atleta</option>
                                                    <option value="COACH">Coach</option>
                                                    <option value="BOX_ADMIN">Box Admin</option>
                                                </select>
                                            )}
                                            <span style={{ fontSize: '0.85rem', color: '#22c55e', fontWeight: 800 }}>✓ Validado</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const BoxSettings = ({ box, newBoxName, setNewBoxName, newBoxLocation, setNewBoxLocation, handleUpdateBox, copyInviteCode, shareInviteLink }) => (
    <div className="box-settings animate-slide-up">
        <h3 style={{ fontWeight: 900, marginBottom: '2rem' }}>Definições da Box</h3>
        <div className="premium-card" style={{ background: 'white', padding: '2rem' }}>
            <p style={{ opacity: 0.6, marginBottom: '2rem' }}>Código de Convite: <strong>{box?.inviteCode || '---'}</strong></p>
            
            <form onSubmit={handleUpdateBox} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', display: 'block' }}>Nome da Box</label>
                    <input type="text" value={newBoxName} onChange={e => setNewBoxName(e.target.value)} placeholder={box?.name || "Nome do Ginásio/Box"} className="form-input" required />
                </div>
                <div className="form-group">
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', display: 'block' }}>Localização</label>
                    <input type="text" value={newBoxLocation} onChange={e => setNewBoxLocation(e.target.value)} placeholder={box?.location || "Localização"} className="form-input" />
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
            <div className="tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: '#e2e8f0', padding: '0.35rem', borderRadius: '1rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {[
                    { id: 'attendance', name: 'Presenças', icon: Users },
                    { id: 'classes', name: 'Gestão Aulas', icon: Calendar },
                    { id: 'users', name: 'Atletas', icon: UserCheck, adminOnly: true },
                    { id: 'settings', name: 'Definições', icon: Settings, adminOnly: true }
                ].map(t => (
                    (!t.adminOnly || isManager) && (
                        <button key={t.id} onClick={() => setMgmtTab(t.id)} className={`tab-btn ${mgmtTab === t.id ? 'active' : ''}`} style={{ flex: '0 0 auto', fontSize: '0.75rem', padding: '0.6rem 0.8rem', whiteSpace: 'nowrap' }}>
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
                                        <div style={{ fontWeight: 800 }}>{new Date(cls.startTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} - {cls.name || 'Aula'}</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{cls.bookings?.filter(b => b.status === 'CONFIRMED').length || 0} / {cls.capacity} Inscritos</div>
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
                                                <div style={{ fontWeight: 800 }}>{b?.user?.name || 'Atleta'}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{b?.user?.email || ''}</div>
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
                    <ScheduleAdmin user={user} />
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
                    const isPast = new Date(cls.startTime) <= new Date();
                    const booking = cls.bookings?.find(b => b.userId === user?.id && ['CONFIRMED', 'WAITLISTED'].includes(b.status));
                    const isFull = cls._count?.bookings >= cls.capacity;
                    return (
                        <React.Fragment key={cls.id}>
                            <div className="premium-card hover-lift"
                                style={{
                                    background: 'white',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                    border: booking ? '2px solid var(--primary-color)' : '1px solid var(--glass-border)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setExpandedClassId(expandedClassId === cls.id ? null : cls.id)}
                            >
                                {/* Linha 1: Hora + Título */}
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ background: booking ? 'var(--primary-color)' : 'var(--primary-glow)', padding: '0.6rem 0.8rem', borderRadius: '1rem', textAlign: 'center', minWidth: '65px' }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: booking ? 'white' : 'var(--primary-color)' }}>
                                            {new Date(cls.startTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: booking ? 0.8 : 0.6, color: booking ? 'white' : 'inherit' }}>Início</div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cls.name || 'WOD & Skills'}
                                            {booking && <CheckCircle2 size={16} color="var(--primary-color)" style={{ flexShrink: 0 }} />}
                                        </h4>
                                        {booking && (
                                            <div style={{ color: booking.status === 'WAITLISTED' ? 'var(--warning)' : 'var(--primary-color)', fontWeight: 800, fontSize: '0.8rem', marginTop: '2px' }}>
                                                {booking.status === 'WAITLISTED' ? 'Em Espera' : '✓ Reservado'}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Linha 2: Info e Botões */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.85rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Users size={14} /> {cls.bookings?.filter(b => b.status === 'CONFIRMED').length || 0} / {cls.capacity}
                                        </span>
                                        <span onClick={(e) => { e.stopPropagation(); setExpandedClassId(expandedClassId === cls.id ? null : cls.id); }} style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 800, background: 'var(--primary-glow)', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                            {expandedClassId === cls.id ? 'Esconder Lista' : 'Ver Inscritos'}
                                            <ChevronRight size={14} style={{ transform: expandedClassId === cls.id ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                        </span>
                                    </div>
                                    
                                    <button
                                        className={`btn ${bookingLoading === cls.id ? 'loading' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleBooking(cls);
                                        }}
                                        style={{
                                            width: 'auto',
                                            padding: '0.6rem 1.25rem',
                                            fontSize: '0.9rem',
                                            background: booking ? 'transparent' : isPast ? '#e2e8f0' : 'var(--primary-color)',
                                            color: booking ? 'var(--danger)' : isPast ? 'var(--text-muted)' : 'white',
                                            border: booking ? '1.5px solid var(--danger)' : 'none',
                                            opacity: ((!booking && isFull) || isPast) ? 0.5 : 1,
                                            cursor: isPast ? 'not-allowed' : 'pointer'
                                        }}
                                        disabled={(!booking && isFull && !booking) || bookingLoading === cls.id || (isPast && !booking)}
                                    >
                                        {isPast && !booking ? 'Terminada' : booking ? 'Cancelar' : (isFull ? 'Lotado' : 'Reservar')}
                                    </button>
                                </div>
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

const WodDisplay = ({ wods, isCoach, user, fetchData, selectedDate, isEnrolled }) => {
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
    const [scoreType, setScoreType] = useState('REPS');
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [showAddPlan, setShowAddPlan] = useState(false);
    const [planDays, setPlanDays] = useState(5);
    const [planPrompt, setPlanPrompt] = useState('');

    useEffect(() => {
        if (todayWod) fetchResults();
    }, [todayWod]);

    const fetchResults = async () => {
        if (!todayWod?.id) return;
        try {
            const res = await apiFetch(`/boxes/${user.boxId}/results?boxWodId=${todayWod.id}`);
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
                body: JSON.stringify({ 
                    boxWodId: todayWod.id, 
                    score, 
                    type,
                    scoreType: todayWod.scoreType // Send this to help backend calculate scoreValue
                })
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
            const yyyy = selectedDate.getFullYear();
            const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            
            const res = await apiFetch(`/boxes/${user.boxId}/wods`, {
                method: 'POST',
                body: JSON.stringify({
                    title, stimulus,
                    date: dateStr,
                    scoreType,
                    content: { warmup, main: mainWorkout, cooldown }
                })
            });
            if (res.ok) {
                alert('WOD publicado!');
                setShowAddWod(false);
                fetchData();
            } else {
                const errorData = await res.json();
                alert('Erro ao publicar WOD: ' + (errorData.error || 'Erro desconhecido.'));
                console.error("Publish WOD Error:", errorData);
            }
        } catch (err) { 
            console.error(err); 
            alert('Erro ao ligar ao servidor.');
        }
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt) {
            alert('Por favor, descreve o objetivo do treino (ex: "Foco em cardio e kettlebells").');
            return;
        }
        setAiLoading(true);
        console.log("Starting AI generation with prompt:", aiPrompt);
        try {
            const res = await apiFetch('/generate-workout', {
                method: 'POST',
                body: JSON.stringify({ prompt: aiPrompt, goal: 'Box Daily WOD' })
            });
            console.log("AI response status:", res.status);
            const data = await res.json();
            console.log("AI response data:", data);
            if (res.ok && data.workout) {
                setMainWorkout(data.workout);
                if (data.warmup) setWarmup(data.warmup);
                if (data.title) setTitle(data.title);
                alert('WOD gerado com sucesso!');
            } else {
                alert(data.error || 'Erro ao gerar treino.');
            }
        } catch (err) {
            console.error(err);
            alert('Erro de rede ao contactar a IA.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleAiPlanGenerate = async () => {
        if (!planPrompt) {
            alert('Por favor, descreve o objetivo da semana.');
            return;
        }
        setAiLoading(true);
        try {
            // 1. Gerar via IA
            const res = await apiFetch('/generate-box-plan', {
                method: 'POST',
                body: JSON.stringify({ prompt: planPrompt, days: planDays })
            });
            const wodsArray = await res.json();
            
            if (res.ok && Array.isArray(wodsArray)) {
                // 2. Publicar em Bulk
                const yyyy = selectedDate.getFullYear();
                const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const dd = String(selectedDate.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;

                const bulkRes = await apiFetch(`/boxes/${user.boxId}/wods/bulk`, {
                    method: 'POST',
                    body: JSON.stringify({ wods: wodsArray, startDate: dateStr })
                });

                if (bulkRes.ok) {
                    alert(`Sucesso! Programação para ${planDays} dias publicada.`);
                    setShowAddPlan(false);
                    fetchData();
                } else {
                    alert('Erro ao publicar programação em lote.');
                }
            } else {
                alert('Erro ao gerar plano via IA.');
            }
        } catch (err) {
            console.error(err);
            alert('Erro de rede.');
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="wod-display animate-slide-up">
            {isCoach && (
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <button onClick={() => { setShowAddWod(!showAddWod); setShowAddPlan(false); }} className="btn btn-outline" style={{ flex: 1, borderStyle: 'dashed' }}>
                        {showAddWod ? 'Cancelar' : '+ Publicar WOD Individual'}
                    </button>
                    <button onClick={() => { setShowAddPlan(!showAddPlan); setShowAddWod(false); }} className="btn btn-outline" style={{ flex: 1, borderStyle: 'dashed', borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}>
                        {showAddPlan ? 'Cancelar' : '✨ Gerar Programação Semanal (IA)'}
                    </button>
                </div>
            )}

            {showAddPlan && (
                <div className="premium-card animate-slide-up" style={{ background: 'white', marginBottom: '2rem', padding: '2rem', border: '2px solid var(--primary-glow)' }}>
                    <h4 style={{ marginBottom: '1rem', fontWeight: 900 }}>Gerar Programação Múltiplos Dias</h4>
                    <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '1.5rem' }}>
                        A IA criará treinos variados e equilibrados para os próximos dias a partir de {selectedDate.toLocaleDateString()}.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="input-group">
                            <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Objetivo/Tema Geral</label>
                            <textarea 
                                value={planPrompt} 
                                onChange={e => setPlanPrompt(e.target.value)} 
                                placeholder="Ex: Semana focada em levantamento olímpico e endurance cardiovascular." 
                                className="form-input"
                                rows="3"
                            />
                        </div>

                        <div className="input-group">
                            <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Número de Dias Consecutivos</label>
                            <input 
                                type="number"
                                min="1"
                                max="14"
                                value={planDays} 
                                onChange={e => setPlanDays(e.target.value)} 
                                className="form-input"
                                style={{ background: 'white' }}
                                placeholder="Ex: 5"
                            />
                            <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.25rem' }}>Recomendado: 1 a 7 dias para maior precisão da IA.</p>
                        </div>

                        <button 
                            onClick={handleAiPlanGenerate} 
                            className={`btn btn-primary ${aiLoading ? 'loading' : ''}`}
                            disabled={aiLoading}
                            style={{ marginTop: '0.5rem' }}
                        >
                            {aiLoading ? 'A Planear...' : 'Gerar e Publicar Programação'}
                        </button>
                    </div>
                </div>
            )}

            {showAddWod && (
                <div className="premium-card animate-slide-up" style={{ background: 'white', marginBottom: '2rem', padding: '2rem' }}>
                    <h4 style={{ marginBottom: '1.5rem', fontWeight: 900 }}>Publicar Treino do Dia</h4>
                    <form onSubmit={handlePublishWod} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ background: 'var(--primary-glow)', padding: '1rem', borderRadius: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input 
                                type="text" 
                                value={aiPrompt} 
                                onChange={e => setAiPrompt(e.target.value)} 
                                placeholder="Descreve o foco (ex: 15min AMRAP com peso corporal)" 
                                className="form-input" 
                                style={{ flex: 1, border: 'none', background: 'white' }} 
                            />
                            <button 
                                type="button" 
                                onClick={handleAiGenerate} 
                                className={`btn btn-primary ${aiLoading ? 'loading' : ''}`} 
                                style={{ width: 'auto', padding: '0.75rem 1rem' }}
                                disabled={aiLoading}
                            >
                                <Sparkles size={16} /> IA Gerar
                            </button>
                        </div>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Título (ex: Fran)" className="form-input" />
                        <input type="text" value={stimulus} onChange={e => setStimulus(e.target.value)} placeholder="Estímulo (ex: Sprint)" className="form-input" />
                        <textarea rows="2" value={warmup} onChange={e => setWarmup(e.target.value)} placeholder="Warm-up" className="form-input"></textarea>
                        <textarea rows="4" value={mainWorkout} onChange={e => setMainWorkout(e.target.value)} required placeholder="WOD Content" className="form-input"></textarea>
                        
                        <div className="input-group-v2">
                            <label style={{ fontSize: '0.8rem', fontWeight: 900, color: '#64748b' }}>TIPO DE PONTUAÇÃO</label>
                            <select 
                                className="form-input" 
                                value={scoreType} 
                                onChange={e => setScoreType(e.target.value)}
                                style={{ background: '#f8fafc' }}
                            >
                                <option value="TIME">Tempo (Menos é melhor)</option>
                                <option value="REPS">Repetições / AMRAP (Mais é melhor)</option>
                                <option value="WEIGHT">Peso / Carga (Mais é melhor)</option>
                                <option value="WEIGHT_AND_TIME">Peso + Tempo (Peso ganha, Tempo desempata)</option>
                            </select>
                        </div>

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
                        <div style={{ padding: '2.5rem 2rem', background: 'linear-gradient(135deg, var(--primary-color), #4f46e5)', color: 'white', textAlign: 'center' }}>
                            <Award size={40} style={{ marginBottom: '1rem', opacity: 0.8 }} />
                            <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 900, lineHeight: 1.2 }}>{todayWod.title}</h2>
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
                        {(isEnrolled || isCoach) ? (
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
                        ) : (
                            <div className="premium-card" style={{ background: 'rgba(255,255,255,0.5)', padding: '2rem', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                                <Clock size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                <h4 style={{ fontWeight: 800, marginBottom: '0.5rem', opacity: 0.5 }}>Resultado Bloqueado</h4>
                                <p style={{ fontSize: '0.85rem', opacity: 0.5 }}>Precisas de estar inscrito numa aula hoje para poderes registar o teu resultado no WOD.</p>
                            </div>
                        )}

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
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [inviteCode, setInviteCode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('invite') || '';
    });
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
    }, [view, user?.boxId, selectedDate]);

    const fetchData = async () => {
        if (!user?.boxId) return;
        setLoading(true);
        try {
            const yyyy = selectedDate.getFullYear();
            const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            const endpoints = [
                apiFetch(`/boxes/${user.boxId}`),
                apiFetch(`/boxes/${user.boxId}/classes?date=${dateStr}`),
                apiFetch(`/boxes/${user.boxId}/wods?date=${dateStr}`)
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

            if (isCoach && view === 'management') {
                const usersResponse = responses.find(r => r.url.includes('/users'));
                if (usersResponse && usersResponse.ok) {
                    const usersData = await usersResponse.json();
                    setBoxUsers(Array.isArray(usersData) ? usersData : []);
                } else if (usersResponse) {
                    console.error("Failed to fetch users:", await usersResponse.text());
                }
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
        
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}?invite=${box.inviteCode}`;
        
        const text = `Junta-te à minha Box ${box.name} no FitTraining! Usa o código: ${box.inviteCode}`;
        const fullMessage = `${text} ${shareUrl}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Convidar para FitTraining',
                text: text,
                url: shareUrl
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(fullMessage);
            alert("Convite copiado para a área de transferência! 📋");
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
        const currentUserId = user?.id;
        const booking = cls.bookings?.find(b => b.userId === currentUserId && ['CONFIRMED', 'WAITLISTED'].includes(b.status));
        console.log('[handleBooking] userId:', currentUserId, 'bookings:', cls.bookings, 'found:', booking);
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
                <div style={{ flex: 1, minWidth: 0 }}>
                    <button onClick={onBack} className="chip" style={{ background: 'transparent', padding: '0', fontSize: '0.8rem', marginBottom: '0.5rem' }}>← Voltar</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'var(--primary-glow)', padding: '0.6rem', borderRadius: '0.8rem', flexShrink: 0 }}>
                            <Users color="var(--primary-color)" size={24} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontWeight: 900, margin: 0, fontSize: '1.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{box?.name || 'A Minha Box'}</h1>
                            <p style={{ opacity: 0.5, margin: 0, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{box?.location || 'A Minha Box'}</p>
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="chip" style={{ background: 'var(--secondary-color)', color: 'white' }}>{isManager ? 'BOX ADMIN' : isCoach ? 'COACH' : 'ATLETA'}</div>
                </div>
            </header>

            {(view === 'schedule' || view === 'wod') && (
                <MonthCalendar 
                    selectedDate={selectedDate} 
                    onDateSelect={(date) => setSelectedDate(date)} 
                />
            )}

            <div className="tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: '#e2e8f0', padding: '0.35rem', borderRadius: '1rem', overflowX: 'auto' }}>
                {[
                    { id: 'schedule', name: 'Aulas', icon: Calendar },
                    { id: 'wod', name: 'WOD', icon: Flame },
                    { id: 'management', name: 'Gestão', icon: Settings, coachOnly: true }
                ].map(t => (
                    (!t.coachOnly || isCoach) && (
                        <button key={t.id} onClick={() => setView(t.id)} className={`tab-btn ${view === t.id ? 'active' : ''}`} style={{ flex: 1, fontSize: '0.85rem', padding: '0.75rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <t.icon size={16} /> {t.name}
                        </button>
                    )
                ))}
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
                    selectedDate={selectedDate}
                    isEnrolled={classes.some(cls => cls.bookings?.some(b => b.userId === user?.id && b.status === 'CONFIRMED'))}
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
