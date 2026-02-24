'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUser(user);

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!profile || (profile.role !== 'super_admin' && profile.role !== 'admin' && profile.role !== 'teacher')) {
                // If not admin/teacher, they might be a regular user. 
                // For now, let's just show they are in if approved.
                setProfile(profile);
            } else {
                setProfile(profile);
                fetchPendingUsers();
            }
            setLoading(false);
        }
        checkUser();
    }, []);

    async function fetchPendingUsers() {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (data) setPendingUsers(data);
    }

    async function handleStatusUpdate(userId: string, newStatus: 'approved' | 'rejected') {
        const { error } = await supabase
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', userId);

        if (!error) {
            setPendingUsers(prev => prev.filter(u => u.id !== userId));
        } else {
            alert('Error updating status: ' + error.message);
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div>
                    <h1>Panel de Control</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Bienvenido, {profile?.first_name} ({profile?.role})</p>
                </div>
                <button onClick={handleLogout} className="btn-accent" style={{ background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)' }}>
                    Cerrar Sesión
                </button>
            </header>

            {(profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'teacher') ? (
                <section>
                    <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🔔 Solicitudes Pendientes
                        <span style={{ fontSize: '0.9rem', background: 'var(--primary)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '10px' }}>
                            {pendingUsers.length}
                        </span>
                    </h2>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {pendingUsers.length === 0 ? (
                            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', borderStyle: 'dashed' }}>
                                <p style={{ color: 'var(--text-muted)' }}>No hay solicitudes pendientes en este momento.</p>
                            </div>
                        ) : (
                            pendingUsers.map(u => (
                                <div key={u.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ color: 'var(--primary)' }}>{u.first_name} {u.last_name}</h4>
                                        <p style={{ fontSize: '0.85rem' }}>
                                            <strong>Rol solicitado:</strong> {u.sub_role === 'representative' ? 'Padre' : u.sub_role === 'student' ? 'Estudiante' : 'Docente'}
                                        </p>
                                        <p style={{ fontSize: '0.85rem' }}>
                                            <strong>Representado/Grado:</strong> {u.represented_name}
                                        </p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Solicitado el: {new Date(u.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            onClick={() => handleStatusUpdate(u.id, 'approved')}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: 'var(--radius-sm)',
                                                background: 'rgba(16, 185, 129, 0.1)',
                                                color: 'var(--success)',
                                                border: '1px solid var(--success)',
                                                fontWeight: 600
                                            }}
                                        >
                                            Aprobar
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(u.id, 'rejected')}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: 'var(--radius-sm)',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                color: 'var(--error)',
                                                border: '1px solid var(--error)',
                                                fontWeight: 600
                                            }}
                                        >
                                            Rechazar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            ) : (
                <section className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <h2>¡Hola, {profile?.first_name}!</h2>
                    <p style={{ margin: '1rem 0', color: 'var(--text-muted)' }}>
                        Tu cuenta está activa. Pronto verás aquí el feed de noticias de tus grupos.
                    </p>
                    <div style={{ padding: '1rem', background: 'var(--accent-glow)', borderRadius: 'var(--radius)', display: 'inline-block' }}>
                        🚀 Próximamente: Feed de Noticias y Eventos
                    </div>
                </section>
            )}
        </div>
    );
}
