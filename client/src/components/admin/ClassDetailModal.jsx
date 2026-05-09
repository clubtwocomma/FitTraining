import React, { useState, useEffect } from 'react';
import { X, User, CheckCircle, Clock, Trash2, Users, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const ClassDetailModal = ({ isOpen, onClose, classData, onUpdate }) => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('confirmed'); // 'confirmed' | 'waitlist'

    useEffect(() => {
        if (isOpen && classData) {
            fetchBookings();
        }
    }, [isOpen, classData]);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`/admin/classes/${classData.id}/bookings`);
            const data = await res.json();
            setBookings(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async (bookingId) => {
        try {
            const res = await apiFetch(`/admin/bookings/${bookingId}/checkin`, { method: 'PATCH' });
            if (res.ok) {
                fetchBookings();
                if (onUpdate) onUpdate();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRemove = async (bookingId) => {
        if (!window.confirm('Remover este atleta da aula?')) return;
        try {
            const res = await apiFetch(`/admin/bookings/${bookingId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchBookings();
                if (onUpdate) onUpdate();
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (!isOpen || !classData) return null;

    const confirmed = bookings.filter(b => b.status === 'CONFIRMED');
    const waitlist = bookings.filter(b => b.status === 'WAITLISTED');

    return (
        <div className="modal-overlay">
            <div className="modal-content animate-pop" style={{ maxWidth: '500px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <div>
                        <h3 style={{ margin: 0 }}>{classData.name}</h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                            {new Date(classData.startTime).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                    <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    {/* Class Info Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div className="stat-box" style={{ background: 'var(--surface-color)', padding: '0.75rem' }}>
                            <label><Clock size={14} /> Horário</label>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                                {new Date(classData.startTime).toTimeString().slice(0, 5)} 
                                {classData.endTime ? ` - ${new Date(classData.endTime).toTimeString().slice(0, 5)}` : ''}
                            </div>
                        </div>
                        <div className="stat-box" style={{ background: 'var(--surface-color)', padding: '0.75rem' }}>
                            <label><MapPin size={14} /> Sala</label>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{classData.location || 'N/A'}</div>
                        </div>
                        <div className="stat-box" style={{ background: 'var(--surface-color)', padding: '0.75rem' }}>
                            <label><User size={14} /> Coach</label>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{classData.coach?.name || 'Não atribuído'}</div>
                        </div>
                        <div className="stat-box" style={{ background: 'var(--surface-color)', padding: '0.75rem' }}>
                            <label><Users size={14} /> Vagas</label>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{confirmed.length} / {classData.capacity}</div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="tabs" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                        <button 
                            className={`tab-btn ${activeTab === 'confirmed' ? 'active' : ''}`}
                            onClick={() => setActiveTab('confirmed')}
                        >
                            Confirmados ({confirmed.length})
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'waitlist' ? 'active' : ''}`}
                            onClick={() => setActiveTab('waitlist')}
                        >
                            Lista de Espera ({waitlist.length})
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando inscrições...</div>
                    ) : (
                        <div className="bookings-list">
                            {(activeTab === 'confirmed' ? confirmed : waitlist).length === 0 ? (
                                <p style={{ textAlign: 'center', opacity: 0.5, padding: '1rem' }}>Ninguém nesta lista.</p>
                            ) : (
                                (activeTab === 'confirmed' ? confirmed : waitlist).map(booking => (
                                    <div key={booking.id} className="booking-item flex-between" style={{ 
                                        padding: '1rem', 
                                        background: 'var(--surface-color)', 
                                        borderRadius: '0.75rem', 
                                        marginBottom: '0.5rem',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ 
                                                width: '32px', height: '32px', background: 'var(--primary-glow)', 
                                                borderRadius: '50%', display: 'flex', alignItems: 'center', 
                                                justifyContent: 'center', fontWeight: 700, color: 'var(--primary-color)', fontSize: '0.8rem'
                                            }}>
                                                {booking.user.name[0]}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{booking.user.name}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                                    {activeTab === 'waitlist' ? `#${booking.waitlistPosition} • ` : ''}
                                                    {new Date(booking.registeredAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {!booking.checkInAt && (
                                                <button 
                                                    onClick={() => handleCheckIn(booking.id)}
                                                    className="chip" 
                                                    style={{ background: 'var(--primary-color)', color: 'white', border: 'none' }}
                                                >
                                                    Check-in
                                                </button>
                                            )}
                                            {booking.checkInAt && (
                                                <div style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    <CheckCircle size={14} /> {new Date(booking.checkInAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => handleRemove(booking.id)}
                                                className="icon-btn" 
                                                style={{ color: '#ef4444' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClassDetailModal;
