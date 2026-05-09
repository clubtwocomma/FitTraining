import React, { useState } from 'react';
import { X, Lock, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function PasswordChangeModal({ onClose }) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError('As novas passwords não coincidem.');
            return;
        }

        if (newPassword.length < 6) {
            setError('A nova password deve ter pelo menos 6 caracteres.');
            return;
        }

        setLoading(true);
        try {
            const res = await apiFetch('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ oldPassword, newPassword })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => onClose(), 2000);
            } else {
                const data = await res.json();
                setError(data.error || 'Erro ao alterar password.');
            }
        } catch (err) {
            setError('Erro de rede ao contactar o servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)'
        }}>
            <div className="premium-card animate-scale-up" style={{ width: '90%', maxWidth: '400px', padding: '2rem', background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 900, margin: 0 }}>
                        <ShieldCheck size={24} color="var(--primary-color)" /> Alterar Password
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>
                        <X size={24} />
                    </button>
                </div>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <div style={{ background: '#ecfdf5', color: '#10b981', padding: '1rem', borderRadius: '1rem', marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle size={24} /> <strong>Sucesso!</strong>
                        </div>
                        <p style={{ opacity: 0.7 }}>A tua password foi atualizada. A fechar...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {error && (
                            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.75rem', borderRadius: '0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}

                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.5, marginBottom: '0.5rem', display: 'block' }}>Password Atual</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="password"
                                    className="form-input"
                                    style={{ paddingLeft: '2.8rem' }}
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.5, marginBottom: '0.5rem', display: 'block' }}>Nova Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="password"
                                    className="form-input"
                                    style={{ paddingLeft: '2.8rem' }}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.5, marginBottom: '0.5rem', display: 'block' }}>Confirmar Nova Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="password"
                                    className="form-input"
                                    style={{ paddingLeft: '2.8rem' }}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`btn btn-primary ${loading ? 'loading' : ''}`}
                            disabled={loading}
                            style={{ height: '56px', marginTop: '0.5rem' }}
                        >
                            {loading ? 'A guardar...' : 'Atualizar Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
