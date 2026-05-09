import React, { useState, useEffect, useRef } from 'react';
import { BellRing, Check, CheckCheck, X, Calendar, Users, Clock, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

const TYPE_META = {
    booking_new:         { icon: Users,        color: '#10b981', bg: '#d1fae5' },
    booking_cancel:      { icon: X,            color: '#ef4444', bg: '#fee2e2' },
    waitlist_promoted:   { icon: Check,        color: '#f59e0b', bg: '#fef3c7' },
    class_cancelled:     { icon: AlertCircle,  color: '#ef4444', bg: '#fee2e2' },
    athlete_joined:      { icon: Users,        color: '#3b82f6', bg: '#dbeafe' },
    default:             { icon: BellRing,     color: '#6366f1', bg: '#ede9fe' }
};

export default function NotificationBell({ userId }) {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef(null);
    const unread = notifications.filter(n => !n.read).length;

    useEffect(() => {
        fetchNotifications();
        // Poll every 30s for new notifications
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    // Close panel when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await apiFetch('/notifications');
            if (res.ok) setNotifications(await res.json());
        } catch (e) {}
    };

    const markAllRead = async () => {
        try {
            await apiFetch('/notifications/read-all', { method: 'PATCH' });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (e) {}
    };

    const markRead = async (id) => {
        try {
            await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (e) {}
    };

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMin = Math.floor((now - d) / 60000);
        if (diffMin < 1) return 'Agora mesmo';
        if (diffMin < 60) return `há ${diffMin}m`;
        if (diffMin < 1440) return `há ${Math.floor(diffMin / 60)}h`;
        return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
    };

    return (
        <div ref={panelRef} style={{ position: 'relative' }}>
            {/* Bell Button */}
            <button
                onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
                style={{
                    position: 'relative', background: unread > 0 ? 'var(--primary-glow)' : 'var(--surface-color)',
                    border: 'none', borderRadius: '1rem', width: '48px', height: '48px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: unread > 0 ? 'var(--primary-color)' : '#64748b',
                    transition: 'all 0.2s'
                }}
            >
                <BellRing size={24} strokeWidth={2.5} />
                {unread > 0 && (
                    <span style={{
                        position: 'absolute', top: '6px', right: '6px',
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: '#ef4444', color: 'white',
                        fontSize: '0.65rem', fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid white', animation: 'pulse 2s infinite'
                    }}>
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {/* Notification Panel */}
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 12px)', right: 0,
                    width: '340px', maxHeight: '480px',
                    background: 'white', borderRadius: '1.5rem',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0',
                    zIndex: 9999, overflow: 'hidden',
                    animation: 'fadeIn 0.15s ease'
                }}>
                    {/* Panel Header */}
                    <div style={{
                        padding: '1.25rem 1.5rem',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderBottom: '1px solid #f1f5f9'
                    }}>
                        <div>
                            <h4 style={{ margin: 0, fontWeight: 900, fontSize: '1rem' }}>Notificações</h4>
                            {unread > 0 && (
                                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5, fontWeight: 600 }}>
                                    {unread} não lida{unread > 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                        {unread > 0 && (
                            <button onClick={markAllRead} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--primary-color)', fontWeight: 800, fontSize: '0.8rem',
                                display: 'flex', alignItems: 'center', gap: '4px'
                            }}>
                                <CheckCheck size={14} /> Marcar todas
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div style={{ overflowY: 'auto', maxHeight: '380px' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', opacity: 0.4 }}>
                                <BellRing size={32} strokeWidth={2.5} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Sem notificações</p>
                            </div>
                        ) : (
                            notifications.map(n => {
                                const meta = TYPE_META[n.type] || TYPE_META.default;
                                const Icon = meta.icon;
                                return (
                                    <div
                                        key={n.id}
                                        onClick={() => markRead(n.id)}
                                        style={{
                                            padding: '1rem 1.5rem',
                                            display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                                            borderBottom: '1px solid #f8fafc',
                                            background: n.read ? 'white' : '#f8faff',
                                            cursor: 'pointer', transition: 'background 0.15s'
                                        }}
                                    >
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '0.75rem',
                                            background: meta.bg, color: meta.color, flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Icon size={16} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: '0 0 0.2rem', fontSize: '0.85rem', fontWeight: n.read ? 600 : 800, lineHeight: 1.4, color: '#1e293b' }}>
                                                {n.message}
                                            </p>
                                            <span style={{ fontSize: '0.72rem', opacity: 0.5, fontWeight: 600 }}>
                                                {formatTime(n.createdAt)}
                                            </span>
                                        </div>
                                        {!n.read && (
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)', flexShrink: 0, marginTop: '6px' }} />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
