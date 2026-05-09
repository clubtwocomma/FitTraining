import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Users, Clock, Save, XCircle, Edit2, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import ClassDetailModal from './ClassDetailModal';

const ScheduleAdmin = ({ user }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedule, setSchedule] = useState([]);
    const [coaches, setCoaches] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState(null);

    useEffect(() => {
        if (user?.boxId) {
            fetchSchedule();
            fetchCoaches();
        }
    }, [currentDate, user]);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const dateStr = currentDate.toISOString().split('T')[0];
            const res = await apiFetch(`/boxes/${user.boxId}/schedule/week?date=${dateStr}`);
            const data = await res.json();
            setSchedule(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCoaches = async () => {
        try {
            const res = await apiFetch(`/admin/coaches?boxId=${user.boxId}`);
            const data = await res.json();
            setCoaches(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handlePrevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const handleNextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const handleSaveClass = async (formData) => {
        try {
            const url = selectedClass ? `/admin/classes/${selectedClass.id}` : `/admin/classes`;
            const method = selectedClass ? 'PATCH' : 'POST';
            
            let finalData = { ...formData };
            if (selectedClass) {
                const isRecurringChange = formData.recurrence !== 'none';
                const hasSeries = !!selectedClass.seriesId;
                
                if (hasSeries || isRecurringChange) {
                    const msg = hasSeries 
                        ? 'Esta aula faz parte de uma série. Queres aplicar estas alterações (incluindo nova recorrência) a TODA a série futura ou apenas a esta aula isolada?\n\n[OK] = Toda a Série\n[Cancelar] = Apenas Esta'
                        : 'Definiste uma recorrência. Queres gerar a série de aulas para o futuro?\n\n[OK] = Sim, gerar série\n[Cancelar] = Não, guardar apenas esta';
                    
                    if (window.confirm(msg)) finalData.updateAllSeries = true;
                }
            }

            const res = await apiFetch(url, {
                method,
                body: JSON.stringify(finalData)
            });

            if (res.ok) {
                setIsFormOpen(false);
                setSelectedClass(null);
                fetchSchedule();
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao guardar aula.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleMoveClass = async (cls, newDate, newHour) => {
        try {
            const dateStr = newDate.toISOString().split('T')[0];
            const startTime = `${String(newHour).padStart(2, '0')}:00`;
            
            const originalStart = new Date(cls.startTime);
            const originalEnd = cls.endTime ? new Date(cls.endTime) : null;
            let endTime = '';
            if (originalEnd) {
                const durationMs = originalEnd.getTime() - originalStart.getTime();
                const newStart = new Date(`${dateStr}T${startTime}`);
                const newEnd = new Date(newStart.getTime() + durationMs);
                endTime = newEnd.toTimeString().slice(0, 5);
            }

            let finalData = {
                name: cls.name,
                date: dateStr,
                startTime,
                endTime,
                capacity: cls.capacity,
                location: cls.location,
                coachId: cls.coachId
            };

            if (cls.seriesId) {
                const updateSeries = window.confirm('Queres mover APENAS esta aula ou TODA a série semanal para este novo horário?\n\nClique em [OK] para Mover Toda a Série\nClique em [Cancelar] para Mover Apenas Esta Aula');
                if (updateSeries) finalData.updateAllSeries = true;
            }

            const res = await apiFetch(`/admin/classes/${cls.id}`, {
                method: 'PATCH',
                body: JSON.stringify(finalData)
            });

            if (res.ok) fetchSchedule();
        } catch (err) {
            console.error('Drag error:', err);
        }
    };

    const onDragStart = (e, cls) => {
        e.dataTransfer.setData('sourceClass', JSON.stringify(cls));
        e.currentTarget.style.opacity = '0.4';
    };

    const onDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';
    };

    const onDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const onDragLeave = (e) => {
        e.currentTarget.classList.remove('drag-over');
    };

    const onDrop = (e, day, hour) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        try {
            const classData = JSON.parse(e.dataTransfer.getData('sourceClass'));
            handleMoveClass(classData, day, hour);
        } catch(err) {}
    };

    const getWeekDays = () => {
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            return date;
        });
    };

    const weekDays = getWeekDays();
    
    const getVisibleHours = () => {
        if (schedule.length === 0) return Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 a 21:00 por defeito
        
        let min = 7;
        let max = 21;
        
        schedule.forEach(c => {
            const startHour = new Date(c.startTime).getHours();
            let endHour = c.endTime ? new Date(c.endTime).getHours() : startHour + 1;
            // Se terminar às 00:00, considerar 24 para o cálculo do max
            if (endHour === 0 && new Date(c.endTime).getDate() !== new Date(c.startTime).getDate()) endHour = 24;
            
            if (startHour < min) min = startHour;
            if (endHour > max) max = endHour;
        });
        
        // Garantir que mostramos sempre pelo menos até à hora seguinte à última aula
        return Array.from({ length: Math.min(24, max - min + 1) }, (_, i) => i + min);
    };

    const hours = getVisibleHours();

    const handleCancelClass = async (cls) => {
        let url = `/admin/classes/${cls.id}`;
        
        if (cls.seriesId) {
            const mode = window.confirm('Queres apagar APENAS esta aula ou TODA a série semanal?\n\nClique em [OK] para Apagar Toda a Série\nClique em [Cancelar] para Apagar Apenas Esta Aula');
            if (mode) {
                url += '?deleteAllSeries=true';
            }
        } else {
            if (!window.confirm('Tens a certeza que queres apagar esta aula?')) return;
        }

        try {
            const res = await apiFetch(url, { method: 'DELETE' });
            if (res.ok) {
                fetchSchedule();
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao apagar aula.');
            }
        } catch (err) {
            console.error(err);
            alert('Erro de rede ao apagar aula.');
        }
    };

    const renderClassCard = (c) => {
        const isFull = c.totalBooked >= c.capacity;
        let statusColor = 'var(--primary-color)';
        if (c.cancelledAt) statusColor = '#94a3b8';
        else if (isFull) statusColor = '#ef4444';

        return (
            <div 
                key={c.id} 
                className={`admin-class-card ${c.cancelledAt ? 'cancelled' : ''}`}
                style={{ borderLeftColor: statusColor }}
                draggable
                onDragStart={(e) => onDragStart(e, c)}
                onDragEnd={onDragEnd}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClass(c);
                    setIsDetailOpen(true);
                }}
            >
                <div className="card-header">
                    <span className="class-name">{c.name}</span>
                    <div className="actions-v2">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedClass(c); setIsFormOpen(true); }} className="mini-btn"><Edit2 size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleCancelClass(c); }} className="mini-btn delete"><Trash2 size={12} /></button>
                    </div>
                </div>
                <div className="card-info">
                    <Users size={10} /> {c.totalBooked}/{c.capacity} 
                    {c.seriesId && <Clock size={10} style={{ marginLeft: '4px', opacity: 0.5 }} title="Série Semanal" />}
                </div>
            </div>
        );
    };

    return (
        <div className="schedule-admin animate-fade">
            <div className="admin-header-v2">
                <div className="title-group">
                    <h2 className="premium-title">Gestão de Horários</h2>
                    <p className="subtitle">Planeia as tuas aulas semanais e gere vagas em tempo real.</p>
                </div>
                
                <div className="header-actions">
                    <div className="week-selector">
                        <button className="nav-btn" onClick={handlePrevWeek}><ChevronLeft size={18} /></button>
                        <span className="week-range">
                            {weekDays[0].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} - {weekDays[6].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                        </span>
                        <button className="nav-btn" onClick={handleNextWeek}><ChevronRight size={18} /></button>
                    </div>
                    
                    {!isFormOpen && (
                        <button className="btn btn-primary main-add-btn" onClick={() => { setSelectedClass(null); setIsFormOpen(true); }}>
                            <Plus size={20} />
                            <span>Nova Aula</span>
                        </button>
                    )}
                </div>
            </div>

            {isFormOpen && (
                <div className="inline-editor-container animate-slide-down">
                    <div className="premium-card editor-card">
                        <div className="editor-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="icon-badge"><Plus size={20} color="var(--primary-color)" /></div>
                                <h3 style={{ margin: 0, fontWeight: 900 }}>{selectedClass ? 'Editar Aula' : 'Configurar Nova Aula'}</h3>
                            </div>
                            <button className="close-btn" onClick={() => setIsFormOpen(false)}><XCircle size={24} /></button>
                        </div>
                        
                        <ClassFormInline 
                            onSave={handleSaveClass}
                            onCancel={() => setIsFormOpen(false)}
                            coaches={coaches}
                            initialData={selectedClass}
                            boxId={user.boxId}
                        />
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ padding: '8rem', textAlign: 'center' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '1rem', opacity: 0.5, fontWeight: 700 }}>A carregar mapa semanal...</p>
                </div>
            ) : (
                <div className="schedule-grid-container-v2">
                    <div className="schedule-grid">
                        <div className="grid-header-v2">
                            <div className="time-col"></div>
                            {weekDays.map((day, i) => (
                                <div key={i} className={`day-col-header-v2 ${day.toDateString() === new Date().toDateString() ? 'today' : ''} ${day.getDay() === 0 || day.getDay() === 6 ? 'weekend' : ''}`}>
                                    <span className="day-name">{day.toLocaleDateString('pt-PT', { weekday: 'short' })}</span>
                                    <div className="day-circle">{day.getDate()}</div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="grid-content">
                            {hours.map(hour => (
                                <div key={hour} className="hour-row">
                                    <div className="time-col">{hour}:00</div>
                                    {weekDays.map((day, i) => {
                                        const dayClasses = schedule.filter(c => {
                                            const classDate = new Date(c.startTime);
                                            return classDate.toDateString() === day.toDateString() && 
                                                   classDate.getHours() === hour;
                                        });

                                        return (
                                            <div 
                                                key={i} 
                                                className={`grid-cell-v2 ${day.getDay() === 0 || day.getDay() === 6 ? 'weekend' : ''}`}
                                                onDragOver={onDragOver}
                                                onDragLeave={onDragLeave}
                                                onDrop={(e) => onDrop(e, day, hour)}
                                            >
                                                {dayClasses.map(c => {
                                                    const start = new Date(c.startTime);
                                                    let end = c.endTime ? new Date(c.endTime) : new Date(start.getTime() + 3600000);
                                                    
                                                    // Fix for midnight vs noon parsing issues
                                                    if (end <= start) {
                                                        // If end is before start, it might be a next-day issue or 12 AM vs 12 PM confusion
                                                        // For now, assume at least 1 hour duration
                                                        end = new Date(start.getTime() + 3600000);
                                                    }

                                                    const durationHours = (end - start) / 3600000;
                                                    const heightScale = Math.max(1, durationHours);

                                                    return (
                                                        <div 
                                                            key={c.id} 
                                                            className={`admin-class-card ${c.cancelledAt ? 'cancelled' : ''}`}
                                                            style={{ 
                                                                borderLeftColor: c.cancelledAt ? '#94a3b8' : (c.totalBooked >= c.capacity ? '#ef4444' : 'var(--primary-color)'),
                                                                height: `calc(${heightScale * 60}px - 8px)`,
                                                                zIndex: heightScale > 1 ? 10 : 1,
                                                                minHeight: '48px'
                                                            }}
                                                            draggable
                                                            onDragStart={(e) => onDragStart(e, c)}
                                                            onDragEnd={onDragEnd}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedClass(c);
                                                                setIsDetailOpen(true);
                                                            }}
                                                        >
                                                            <div className="card-header">
                                                                <span className="class-name">{c.name}</span>
                                                                <div className="actions-v2">
                                                                    <button onClick={(e) => { e.stopPropagation(); setSelectedClass(c); setIsFormOpen(true); }} className="mini-btn"><Edit2 size={12} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleCancelClass(c); }} className="mini-btn delete"><Trash2 size={12} /></button>
                                                                </div>
                                                            </div>
                                                            <div className="card-info">
                                                                <Users size={10} /> {c.totalBooked}/{c.capacity} 
                                                                {c.seriesId && <Clock size={10} style={{ marginLeft: '4px', opacity: 0.5 }} title="Série Semanal" />}
                                                            </div>
                                                            {durationHours > 1.2 && (
                                                                <div className="card-info" style={{ marginTop: '4px' }}>
                                                                    <Clock size={10} /> {start.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <ClassDetailModal 
                isOpen={isDetailOpen} 
                onClose={() => setIsDetailOpen(false)} 
                classData={selectedClass}
                onUpdate={fetchSchedule}
            />

            <style dangerouslySetInnerHTML={{ __html: `
                .schedule-admin { padding-bottom: 4rem; }
                .admin-header-v2 { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; gap: 2rem; flex-wrap: wrap; }
                .premium-title { font-size: 2rem; font-weight: 950; margin: 0; color: #0f172a; letter-spacing: -0.5px; }
                .subtitle { margin: 0.25rem 0 0 0; color: #64748b; font-size: 1rem; font-weight: 500; }
                .header-actions { display: flex; gap: 1rem; align-items: center; }
                .week-selector { display: flex; align-items: center; background: white; padding: 4px; border-radius: 1rem; border: 1px solid #e2e8f0; }
                .nav-btn { background: none; border: none; padding: 10px; cursor: pointer; color: #64748b; transition: all 0.2s; display: flex; align-items: center; }
                .nav-btn:hover { color: var(--primary-color); transform: scale(1.1); }
                .week-range { font-weight: 800; font-size: 0.9rem; padding: 0 1rem; min-width: 140px; text-align: center; }
                .main-add-btn { height: 48px; padding: 0 1.5rem; border-radius: 1rem; font-weight: 800; }

                .inline-editor-container { margin-bottom: 3rem; }
                .editor-card { background: white; border: 1px solid #e2e8f0; border-radius: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.06); overflow: hidden; }
                .editor-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2rem; border-bottom: 1px solid #f1f5f9; background: #fcfdfe; }
                .icon-badge { background: var(--primary-glow); padding: 10px; border-radius: 12px; display: flex; }
                .close-btn { background: none; border: none; cursor: pointer; color: #94a3b8; }
                .close-btn:hover { color: #ef4444; }

                .schedule-grid-container-v2 { background: white; border-radius: 2rem; border: 1px solid #e2e8f0; box-shadow: 0 10px 40px rgba(0,0,0,0.04); overflow-x: auto; }
                .schedule-grid { min-width: 1100px; }
                .grid-header-v2 { display: flex; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                .day-col-header-v2 { flex: 1; padding: 1.25rem 0.5rem; text-align: center; border-left: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 120px; }
                .day-col-header-v2.today { background: #f0f7ff; }
                .day-col-header-v2.weekend { background: #fafafa; }
                .day-name { font-size: 0.65rem; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
                .day-circle { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 950; }
                .today .day-circle { background: var(--primary-color); color: white; }

                .hour-row { display: flex; border-bottom: 1px solid #f1f5f9; height: 60px; }
                .time-col { width: 60px; padding: 1rem 0.5rem; text-align: center; font-size: 0.7rem; font-weight: 950; color: #64748b; opacity: 0.8; border-right: 1px solid #f1f5f9; background: #fcfdfe; display: flex; align-items: center; justify-content: center; }
                .grid-cell-v2 { flex: 1; border-left: 1px solid #f1f5f9; padding: 0; position: relative; transition: all 0.2s; min-width: 120px; height: 60px; }
                .grid-cell-v2.weekend { background: #fcfcfc; }
                .grid-cell-v2:hover { background: #fafbfc; }
                .grid-cell-v2.drag-over { background: #eff6ff; border: 2px dashed var(--primary-color); }

                .admin-class-card { 
                    background: white; 
                    border: 1px solid #e2e8f0; 
                    border-left: 5px solid var(--primary-color); 
                    border-radius: 0.75rem; 
                    padding: 0.6rem; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03); 
                    cursor: grab; 
                    transition: all 0.3s; 
                    position: absolute;
                    top: 4px;
                    left: 4px;
                    right: 4px;
                    overflow: hidden;
                    box-sizing: border-box;
                }
                .admin-class-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.08); z-index: 20 !important; }
                .class-name { font-weight: 900; font-size: 0.8rem; color: #1e293b; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .card-info { display: flex; align-items: center; gap: 4px; font-size: 0.65rem; font-weight: 700; color: #64748b; }
                
                .actions-v2 { display: none; position: absolute; top: 2px; right: 2px; background: white; border-radius: 4px; padding: 1px; gap: 2px; }
                .admin-class-card:hover .actions-v2 { display: flex; }
                .mini-btn { border: none; background: none; padding: 2px; cursor: pointer; color: #94a3b8; }
                .mini-btn:hover { color: var(--primary-color); }
                .mini-btn.delete:hover { color: #ef4444; }
            ` }} />
        </div>
    );
};

const TimeSelector = ({ label, value, onChange }) => {
    const [h, m] = (value || '00:00').split(':');
    return (
        <div className="input-group-v2">
            <label>{label}</label>
            <div style={{ display: 'flex', gap: '4px' }}>
                <select 
                    className="form-input-v2" 
                    value={h} 
                    onChange={e => onChange(`${e.target.value}:${m}`)} 
                    style={{ flex: 1, paddingRight: '0', textAlign: 'center' }}
                >
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(v => (
                        <option key={v} value={v}>{v}h</option>
                    ))}
                </select>
                <span style={{ alignSelf: 'center', fontWeight: 900, opacity: 0.3 }}>:</span>
                <select 
                    className="form-input-v2" 
                    value={m} 
                    onChange={e => onChange(`${h}:${e.target.value}`)} 
                    style={{ flex: 1, paddingRight: '0', textAlign: 'center' }}
                >
                    {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(v => (
                        <option key={v} value={v}>{v}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};

const ClassFormInline = ({ onSave, onCancel, coaches, initialData, boxId }) => {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        date: initialData ? new Date(initialData.startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        startTime: initialData ? new Date(initialData.startTime).toTimeString().slice(0, 5) : '07:00',
        endTime: initialData?.endTime ? new Date(initialData.endTime).toTimeString().slice(0, 5) : '08:00',
        capacity: initialData?.capacity || 12,
        location: initialData?.location || '',
        coachId: initialData?.coachId || '',
        recurrence: 'none', // Default to none even for existing ones, unless we want to detect
        recurrenceEndDate: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ ...formData, boxId: parseInt(boxId) });
    };

    return (
        <form onSubmit={handleSubmit} className="premium-form-v2">
            <div className="form-grid">
                <div className="form-section">
                    <div className="input-group-v2">
                        <label>Nome da Aula</label>
                        <input type="text" className="form-input-v2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="WOD, Open Box..." required />
                    </div>
                    <div className="input-group-v2">
                        <label>Coach</label>
                        <select className="form-input-v2" value={formData.coachId} onChange={e => setFormData({...formData, coachId: e.target.value})}>
                            <option value="">Sem coach atribuído</option>
                            {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="form-section">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group-v2">
                            <label>Data</label>
                            <input type="date" className="form-input-v2" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                        </div>
                        <div className="input-group-v2">
                            <label>Capacidade</label>
                            <input type="number" className="form-input-v2" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} required />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <TimeSelector 
                            label="Início" 
                            value={formData.startTime} 
                            onChange={val => setFormData({...formData, startTime: val})} 
                        />
                        <TimeSelector 
                            label="Fim" 
                            value={formData.endTime} 
                            onChange={val => setFormData({...formData, endTime: val})} 
                        />
                    </div>
                </div>

                <div className="form-section recurrence-box">
                    <label className="section-label">Recorrência</label>
                    <div className="radio-options-v2">
                        {['none', 'weekly_unlimited', 'weekly_until'].map(id => (
                            <label key={id} className={`radio-label-v2 ${formData.recurrence === id ? 'selected' : ''}`}>
                                <input type="radio" name="recurrence" value={id} checked={formData.recurrence === id} onChange={e => setFormData({...formData, recurrence: e.target.value})} />
                                <span>{id === 'none' ? 'Não repetir' : id === 'weekly_unlimited' ? 'Ilimitado' : 'Até Data'}</span>
                            </label>
                        ))}
                    </div>
                    {formData.recurrence === 'weekly_until' && <input type="date" className="form-input-v2" style={{ marginTop: '10px' }} value={formData.recurrenceEndDate} onChange={e => setFormData({...formData, recurrenceEndDate: e.target.value})} required />}
                </div>
            </div>

            <div className="form-footer-v2">
                <button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0 2rem' }}>Guardar Aula</button>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .premium-form-v2 { padding: 2rem; background: #fff; }
                .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
                .form-section { display: flex; flex-direction: column; gap: 1rem; }
                .input-group-v2 label { display: block; font-size: 0.75rem; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
                .form-input-v2 { width: 100%; height: 48px; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0 1rem; font-weight: 600; background: #f8fafc; }
                .recurrence-box { background: #f8fafc; padding: 1.25rem; border-radius: 1rem; border: 1px solid #e2e8f0; }
                .radio-options-v2 { display: flex; flex-direction: column; gap: 6px; }
                .radio-label-v2 { display: flex; align-items: center; gap: 10px; padding: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 0.85rem; }
                .radio-label-v2.selected { background: var(--primary-glow); border-color: var(--primary-color); color: var(--primary-color); }
                .form-footer-v2 { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 1rem; }
            ` }} />
        </form>
    );
};

export default ScheduleAdmin;
