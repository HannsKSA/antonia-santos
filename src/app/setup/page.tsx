'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'checking'>('checking');
    const [message, setMessage] = useState('');
    const router = useRouter();

    useEffect(() => {
        async function checkSecurity() {
            // Ver si hay un super_admin
            const { data: superAdmins } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', 'super_admin');

            const hasSuperAdmin = superAdmins && superAdmins.length > 0;

            if (hasSuperAdmin) {
                // Si existe, ver si yo soy ese super_admin
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/login');
                    return;
                }

                const { data: myProfile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (myProfile?.role !== 'super_admin') {
                    alert('Acceso restringido: El sistema ya ha sido configurado.');
                    router.push('/');
                    return;
                }
            }
            setStatus('idle');
        }
        checkSecurity();
    }, []);

    const handleSetup = async () => {
        setStatus('loading');
        try {
            const res = await fetch('/api/setup', { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                setStatus('success');
                setMessage(data.message + ': ' + data.admin);
            } else {
                setStatus('error');
                setMessage(data.error);
            }
        } catch (err) {
            setStatus('error');
            setMessage('Fallo la conexión con la API');
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white' }}>
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px' }}>
                <h1 style={{ color: 'var(--accent)', marginBottom: '1rem' }}>Configuración Inicial</h1>
                <p style={{ marginBottom: '2rem', opacity: 0.8 }}>
                    Este proceso creará el Super Administrador y los grupos base definidos en tus variables de entorno.
                </p>

                {status === 'checking' && <p>Verificando permisos de seguridad...</p>}

                {status === 'idle' && (
                    <button onClick={handleSetup} className="btn-accent" style={{ padding: '1rem 2rem' }}>
                        Ejecutar Setup Automático
                    </button>
                )}

                {status === 'loading' && <p>🚀 Configurando sistema, por favor espera...</p>}

                {status === 'success' && (
                    <div style={{ color: 'var(--success)' }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>✅ ¡Todo listo!</h3>
                        <p>{message}</p>
                        <a href="/login" className="btn-primary" style={{ marginTop: '2rem', display: 'inline-block' }}>Ir al Login</a>
                    </div>
                )}

                {status === 'error' && (
                    <div style={{ color: 'var(--error)' }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>❌ Error</h3>
                        <p>{message}</p>
                        <button onClick={() => setStatus('idle')} className="btn-primary" style={{ marginTop: '1rem', background: 'var(--error)' }}>Reintentar</button>
                    </div>
                )}
            </div>
        </div>
    );
}
