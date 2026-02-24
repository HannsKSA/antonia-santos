'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Check profile status
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('status, role')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw profileError;

            if (profile.status === 'pending') {
                setMessage({ type: 'error', text: 'Tu cuenta aún está pendiente de aprobación por un docente.' });
                await supabase.auth.signOut();
            } else if (profile.status === 'rejected') {
                setMessage({ type: 'error', text: 'Tu solicitud de acceso ha sido rechazada. Contacta a la institución.' });
                await supabase.auth.signOut();
            } else {
                router.push('/dashboard');
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Error al iniciar sesión' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Bienvenido</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                    Ingresa a la plataforma de la IE Antonia Santos
                </p>

                {message && (
                    <div style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius)',
                        marginBottom: '1.5rem',
                        backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
                        border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
                        fontSize: '0.9rem'
                    }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label style={labelStyle}>Correo Electrónico</label>
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="tu@email.com" />
                    </div>

                    <div className="form-group">
                        <label style={labelStyle}>Contraseña</label>
                        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />
                    </div>

                    <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                        {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        ¿No tienes cuenta? <Link href="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Solicita Acceso</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: '0.4rem',
    color: 'var(--primary)',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
};
