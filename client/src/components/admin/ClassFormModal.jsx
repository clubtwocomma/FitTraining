import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Clock, Users, MapPin, User } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const ClassFormModal = ({ isOpen, onClose, onSave, coaches, initialData = null, boxId }) => {
    const [formData, setFormData] = useState({
        name: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '07:00',
        endTime: '08:00',
        capacity: 12,
        location: '',
        coachId: '',
        recurrence: 'none',
        recurrenceEndDate: ''
    });

    useEffect(() => {
        if (initialData) {
            const start = new Date(initialData.startTime);
            const end = initialData.endTime ? new Date(initialData.endTime) : null;
            setFormData({
                name: initialData.name || '',
                date: start.toISOString().split('T')[0],
                startTime: start.toTimeString().slice(0, 5),
                endTime: end ? end.toTimeString().slice(0, 5) : '',
                capacity: initialData.capacity || 12,
                location: initialData.location || '',
                coachId: initialData.coachId || ''
            });
        } else {
            setFormData({
                name: '',
                date: new Date().toISOString().split('T')[0],
                startTime: '07:00',
                endTime: '08:00',
                capacity: 12,
                location: '',
                coachId: '',
                recurrence: 'none',
                recurrenceEndDate: ''
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.endTime && formData.endTime <= formData.startTime) {
            alert('A hora de fim deve ser posterior à hora de início.');
            return;
        }
        onSave({ ...formData, boxId: parseInt(boxId) });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content animate-pop" style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h3>{initialData ? 'Editar Aula' : 'Nova Aula'}</h3>
                    <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group">
                        <label>Nome da Aula</label>
                        <input 
                            type="text" 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                            placeholder="Ex: WOD, Open Box..."
                            required
                        />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Data</label>
                            <input 
                                type="date" 
                                value={formData.date} 
                                onChange={e => setFormData({...formData, date: e.target.value})} 
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Capacidade</label>
                            <input 
                                type="number" 
                                value={formData.capacity} 
                                onChange={e => setFormData({...formData, capacity: e.target.value})} 
                                min="1"
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Início</label>
                            <input 
                                type="time" 
                                value={formData.startTime} 
                                onChange={e => setFormData({...formData, startTime: e.target.value})} 
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Fim (Opcional)</label>
                            <input 
                                type="time" 
                                value={formData.endTime} 
                                onChange={e => setFormData({...formData, endTime: e.target.value})} 
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Sala / Espaço</label>
                        <div style={{ position: 'relative' }}>
                            <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '14px', opacity: 0.5 }} />
                            <input 
                                type="text" 
                                value={formData.location} 
                                onChange={e => setFormData({...formData, location: e.target.value})} 
                                style={{ paddingLeft: '36px' }}
                                placeholder="Ex: Sala Principal, Outdoor..."
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Coach</label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: '12px', top: '14px', opacity: 0.5 }} />
                            <select 
                                value={formData.coachId} 
                                onChange={e => setFormData({...formData, coachId: e.target.value})}
                                style={{ paddingLeft: '36px', width: '100%' }}
                            >
                                <option value="">Sem coach atribuído</option>
                                {coaches.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {!initialData && (
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', marginTop: '1rem', border: '1px solid #e2e8f0' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Clock size={14} color="var(--primary-color)" /> Recorrência Semanal
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', background: formData.recurrence === 'none' ? 'white' : 'transparent', border: formData.recurrence === 'none' ? '1px solid var(--primary-color)' : '1px solid transparent' }}>
                                        <input type="radio" name="recurrence" value="none" checked={formData.recurrence === 'none'} onChange={e => setFormData({...formData, recurrence: e.target.value})} />
                                        <span>Apenas esta aula (Única)</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', background: formData.recurrence === 'weekly_unlimited' ? 'white' : 'transparent', border: formData.recurrence === 'weekly_unlimited' ? '1px solid var(--primary-color)' : '1px solid transparent' }}>
                                        <input type="radio" name="recurrence" value="weekly_unlimited" checked={formData.recurrence === 'weekly_unlimited'} onChange={e => setFormData({...formData, recurrence: e.target.value})} />
                                        <span>Repetir por Tempo Ilimitado</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', background: formData.recurrence === 'weekly_until' ? 'white' : 'transparent', border: formData.recurrence === 'weekly_until' ? '1px solid var(--primary-color)' : '1px solid transparent' }}>
                                        <input type="radio" name="recurrence" value="weekly_until" checked={formData.recurrence === 'weekly_until'} onChange={e => setFormData({...formData, recurrence: e.target.value})} />
                                        <span>Repetir até uma data definida</span>
                                    </label>
                                </div>
                            </div>

                            {formData.recurrence === 'weekly_until' && (
                                <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                    <label>Data Limite</label>
                                    <input 
                                        type="date" 
                                        value={formData.recurrenceEndDate} 
                                        onChange={e => setFormData({...formData, recurrenceEndDate: e.target.value})} 
                                        required={formData.recurrence === 'weekly_until'}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" className="btn-primary">
                            <Save size={18} />
                            <span>Guardar</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClassFormModal;
