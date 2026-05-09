import React, { useState } from 'react';
import { User, Lock, Mail, ChevronRight, Flame } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function AuthView({ onLoginSuccess }) {
    const [view, setView] = useState('login'); // login | register | forgot | reset
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    // Check for reset token in URL
    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            setView('reset');
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        let endpoint = '';
        let body = {};

        if (view === 'login') {
            endpoint = 'auth/login';
            body = { email, password };
        } else if (view === 'register') {
            endpoint = 'auth/register';
            body = { email, password, name };
        } else if (view === 'forgot') {
            endpoint = 'auth/forgot-password';
            body = { email };
        } else if (view === 'reset') {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            if (password !== confirmPassword) {
                setError('As passwords não coincidem.');
                setLoading(false);
                return;
            }
            endpoint = 'auth/reset-password';
            body = { token, newPassword: password };
        }

        try {
            const res = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(body)
            });

            let data;
            const textResponse = await res.text();

            try {
                data = textResponse ? JSON.parse(textResponse) : {};
            } catch (jsonErr) {
                throw new Error('Erro do servidor: resposta inválida');
            }

            if (!res.ok) throw new Error(data.error || 'Ocorreu um erro');

            if (view === 'login') {
                localStorage.setItem('fitToken', data.token);
                localStorage.setItem('fitUser', JSON.stringify(data.user));
                onLoginSuccess(data.user);
            } else if (view === 'register') {
                setView('login');
                setMessage('Conta criada com sucesso! Por favor, faz login.');
            } else if (view === 'forgot') {
                setMessage('Se o email existir, enviámos as instruções de recuperação.');
                setView('login');
            } else if (view === 'reset') {
                setMessage('Password redefinida com sucesso! Podes agora entrar.');
                setView('login');
                window.history.replaceState({}, document.title, "/"); // Clean URL
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getTitle = () => {
        if (view === 'login') return 'Bem-vindo';
        if (view === 'register') return 'Criar Conta';
        if (view === 'forgot') return 'Recuperar Acesso';
        if (view === 'reset') return 'Nova Password';
    };

    const getSubtitle = () => {
        if (view === 'login') return 'Inicia sessão para gerir os teus treinos';
        if (view === 'register') return 'Junta-te à elite do treino personalizado';
        if (view === 'forgot') return 'Introduz o teu email para receberes um link de reset';
        if (view === 'reset') return 'Escolhe uma nova password para a tua conta';
    };

    return (
        <div className="auth-container animate-fade" style={{
            minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }}>
        <div className="premium-card" style={{ width: '100%', maxWidth: '420px', padding: 'clamp(1.5rem, 5vw, 2.5rem)', background: 'white' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '60px', height: '60px', borderRadius: '1.5rem', background: 'var(--primary-glow)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--primary-color)'
                    }}>
                        <Flame size={28} fill="currentColor" />
                    </div>
                    <h2 style={{ fontSize: 'clamp(1.5rem, 6vw, 2rem)', fontWeight: 900, marginBottom: '0.35rem' }}>{getTitle()}</h2>
                    <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>{getSubtitle()}</p>
                </div>

                {error && (
                    <div style={{ padding: '1rem', background: '#fee2e2', color: '#ef4444', borderRadius: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', fontWeight: 600 }}>
                        {error}
                    </div>
                )}

                {message && (
                    <div style={{ padding: '1rem', background: '#ecfdf5', color: '#10b981', borderRadius: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', fontWeight: 600 }}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {view === 'register' && (
                        <div className="input-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, opacity: 0.7 }}>Nome Completo</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '1rem', border: '1px solid var(--surface-color)', background: '#f8fafc' }}
                                />
                            </div>
                        </div>
                    )}

                    {(view !== 'reset') && (
                        <div className="input-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, opacity: 0.7 }}>Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teu@email.com"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '1rem', border: '1px solid var(--surface-color)', background: '#f8fafc' }}
                                />
                            </div>
                        </div>
                    )}

                    {(view === 'login' || view === 'register' || view === 'reset') && (
                        <div className="input-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, opacity: 0.7 }}>
                                {view === 'reset' ? 'Nova Password' : 'Palavra-passe'}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '1rem', border: '1px solid var(--surface-color)', background: '#f8fafc' }}
                                />
                            </div>
                        </div>
                    )}

                    {view === 'reset' && (
                        <div className="input-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, opacity: 0.7 }}>Confirmar Nova Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '1rem', border: '1px solid var(--surface-color)', background: '#f8fafc' }}
                                />
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.75rem', height: '3rem', fontSize: '1rem' }}>
                        {loading ? 'A processar...' : (view === 'login' ? 'Entrar' : view === 'register' ? 'Registar' : view === 'forgot' ? 'Enviar Link' : 'Redefinir')}
                    </button>
                </form>

                {view === 'login' && (
                    <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                        <button onClick={() => setView('forgot')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                            Esqueceste-te da password?
                        </button>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem' }}>
                    <span style={{ opacity: 0.5 }}>
                        {view === 'register' ? 'Já tens conta?' : 'Ainda não és elite?'}
                    </span>
                    <button
                        onClick={() => setView(view === 'register' ? 'login' : 'register')}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 800, marginLeft: '0.5rem', cursor: 'pointer' }}
                    >
                        {view === 'register' ? 'Inicia sessão' : 'Cria conta agora'}
                    </button>
                </div>

                {(view === 'forgot' || view === 'reset') && (
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                        <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
                            Voltar ao login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
