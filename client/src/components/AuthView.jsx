import React, { useState } from 'react';
import { User, Lock, Mail, ChevronRight, Flame } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function AuthView({ onLoginSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const endpoint = isLogin ? 'auth/login' : 'auth/register';
        const body = isLogin ? { email, password } : { email, password, name };

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
                console.error("Non-JSON response received:", textResponse);
                throw new Error(textResponse ? 'Erro do servidor: resposta inválida' : 'Servidor indisponível (Tente novamente)');
            }

            if (!res.ok) throw new Error(data.error || 'Erro na autenticação');

            if (isLogin) {
                localStorage.setItem('fitToken', data.token);
                localStorage.setItem('fitUser', JSON.stringify(data.user));
                onLoginSuccess(data.user);
            } else {
                // After register, auto switch to login
                setIsLogin(true);
                alert('Conta criada com sucesso! Por favor, faz login.');
            }
        } catch (err) {
            console.error("Auth error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container animate-fade" style={{
            minHeight: '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div className="premium-card" style={{
                width: '100%',
                maxWidth: '450px',
                padding: '3rem',
                background: 'white'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '2rem',
                        background: 'var(--primary-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        color: 'var(--primary-color)'
                    }}>
                        <Flame size={40} fill="currentColor" />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>
                        {isLogin ? 'Bem-vindo' : 'Criar Conta'}
                    </h2>
                    <p style={{ opacity: 0.5 }}>
                        {isLogin ? 'Inicia sessão para gerir os teus treinos' : 'Junta-te à elite do treino personalizado'}
                    </p>
                </div>

                {error && (
                    <div style={{
                        padding: '1rem',
                        background: '#fee2e2',
                        color: '#ef4444',
                        borderRadius: '1rem',
                        marginBottom: '1.5rem',
                        fontSize: '0.9rem',
                        textAlign: 'center',
                        fontWeight: 600
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {!isLogin && (
                        <div className="input-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, opacity: 0.7 }}>Nome Completo</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ex: João Silva"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '1rem', border: '1px solid var(--surface-color)', background: '#f8fafc' }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="input-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, opacity: 0.7 }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="teu@email.com"
                                style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '1rem', border: '1px solid var(--surface-color)', background: '#f8fafc' }}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, opacity: 0.7 }}>Palavra-passe</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '1rem', border: '1px solid var(--surface-color)', background: '#f8fafc' }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ marginTop: '1rem', height: '3.5rem', fontSize: '1.1rem' }}
                    >
                        {loading ? 'A processar...' : isLogin ? 'Entrar' : 'Registar'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem' }}>
                    <span style={{ opacity: 0.5 }}>
                        {isLogin ? 'Não tens conta?' : 'Já tens conta?'}
                    </span>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 800, marginLeft: '0.5rem', cursor: 'pointer' }}
                    >
                        {isLogin ? 'Criar agora' : 'Inicia sessão'}
                    </button>
                </div>
            </div>
        </div>
    );
}
