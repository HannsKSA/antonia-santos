'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import CreatePost from '@/components/CreatePost';
import NewsFeed from '@/components/NewsFeed';
import CreateProposal from '@/components/CreateProposal';
import ProposalFeed from '@/components/ProposalFeed';
import CreatePoll from '@/components/CreatePoll';
import PollFeed from '@/components/PollFeed';
import ReportsPanel from '@/components/ReportsPanel';
import UsersManager from '@/components/UsersManager';
import GroupsManager from '@/components/GroupsManager';

export const dynamic = 'force-dynamic';

type Tab = 'feed' | 'proposals' | 'polls' | 'approvals' | 'create' | 'metrics' | 'users_admin' | 'groups_admin';

function DashboardContent() {
    const [profile, setProfile] = useState<any>(null);
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('feed');
    const router = useRouter();
    const searchParams = useSearchParams();

    const fetchPendingUsers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (data) setPendingUsers(data);
    };

    const handleStatusUpdate = async (userId: string, newStatus: 'approved' | 'rejected') => {
        const { error } = await supabase
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', userId);

        if (!error) {
            setPendingUsers(prev => prev.filter(u => u.id !== userId));
        } else {
            alert('Error al actualizar estado: ' + error.message);
        }
    };

    useEffect(() => {
        const tab = (searchParams.get('tab') || 'feed') as Tab;
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!profile) {
                router.push('/register');
                return;
            }

            setProfile(profile);

            // Si es admin, cargar usuarios pendientes
            if (['super_admin', 'admin', 'teacher'].includes(profile.role)) {
                fetchPendingUsers();
            } else if (profile.status !== 'approved') {
                setActiveTab('feed');
            }

            setLoading(false);
        }
        checkUser();
    }, []);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;

    const isAdmin = profile && ['super_admin', 'admin', 'teacher'].includes(profile.role);
    const isApproved = profile?.status === 'approved';

    return (
        <div style={{ padding: '1rem', maxWidth: '1000px', margin: '0 auto', minHeight: '100vh' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', color: 'var(--primary)' }}>Panel de Control</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Hola, <strong>{profile?.first_name}</strong> •
                        <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.5rem', background: '#e2e8f0', borderRadius: '10px', fontSize: '0.8rem' }}>
                            {profile?.role}
                        </span>
                        {profile?.status === 'pending' && <span style={{ marginLeft: '0.5rem', color: 'var(--error)' }}>(Pendiente de aprobación)</span>}
                    </p>
                </div>
            </header>

            {/* Navegación por Tabs */}
            <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', overflowX: 'auto' }}>
                <TabButton active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} label="📰 Noticias" />
                <TabButton active={activeTab === 'proposals'} onClick={() => setActiveTab('proposals')} label="💡 Propuestas" />
                <TabButton active={activeTab === 'polls'} onClick={() => setActiveTab('polls')} label="📊 Encuestas" />

                {isAdmin && (
                    <TabButton active={activeTab === 'metrics'} onClick={() => setActiveTab('metrics')} label="📊 Métricas" />
                )}

                {isApproved && (
                    <TabButton active={activeTab === 'create'} onClick={() => setActiveTab('create')} label="✍️ Crear" />
                )}
            </nav>

            <main>
                {activeTab === 'metrics' && isAdmin && (
                    <ReportsPanel userProfile={profile} />
                )}

                {activeTab === 'feed' && (
                    isApproved ? <NewsFeed userProfile={profile} /> : <PendingMessage />
                )}

                {activeTab === 'proposals' && (
                    isApproved ? <ProposalFeed userProfile={profile} /> : <PendingMessage />
                )}

                {activeTab === 'polls' && (
                    isApproved ? <PollFeed userProfile={profile} /> : <PendingMessage />
                )}

                {activeTab === 'create' && isApproved && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {isAdmin && (
                            <section>
                                <CreatePost userProfile={profile} onPostCreated={() => setActiveTab('feed')} />
                                <div style={{ height: '1px', background: '#e2e8f0', margin: '2rem 0' }} />
                                <CreatePoll userProfile={profile} onPollCreated={() => setActiveTab('polls')} />
                                <div style={{ height: '1px', background: '#e2e8f0', margin: '2rem 0' }} />
                            </section>
                        )}
                        <section>
                            <CreateProposal userProfile={profile} onCreated={() => setActiveTab('proposals')} />
                        </section>
                    </div>
                )}

                {activeTab === 'approvals' && isAdmin && (
                    <section>
                        <h2 style={{ marginBottom: '1.5rem' }}>Solicitudes de Acceso</h2>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {pendingUsers.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No hay solicitudes pendientes.</p>
                            ) : (
                                pendingUsers.map(u => (
                                    <div key={u.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div>
                                            <h4 style={{ color: 'var(--primary)' }}>{u.first_name} {u.last_name}</h4>
                                            <p style={{ fontSize: '0.85rem' }}>
                                                <strong>Rol:</strong> {u.sub_role === 'representative' ? 'Padre' : u.sub_role === 'student' ? 'Estudiante' : 'Docente'}
                                            </p>
                                            <p style={{ fontSize: '0.85rem' }}>
                                                <strong>Referencia:</strong> {u.represented_name}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => handleStatusUpdate(u.id, 'approved')} className="btn-primary" style={{ background: 'var(--success)', border: 'none', padding: '0.4rem 0.8rem' }}>✓ Aprobar</button>
                                            <button onClick={() => handleStatusUpdate(u.id, 'rejected')} className="btn-accent" style={{ background: 'var(--error)', border: 'none', padding: '0.4rem 0.8rem' }}>✕ Rechazar</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                )}

                {activeTab === 'users_admin' && profile?.role === 'super_admin' && (
                    <UsersManager userProfile={profile} />
                )}

                {activeTab === 'groups_admin' && profile?.role === 'super_admin' && (
                    <GroupsManager />
                )}
            </main>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Cargando panel...</div>}>
            <DashboardContent />
        </Suspense>
    );
}

function PendingMessage() {
    return (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <h3>⏳ Cuenta en espera de aprobación</h3>
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                Tu solicitud está siendo revisada por los docentes. Podrás interactuar con noticias y propuestas una vez seas aprobado.
            </p>
        </div>
    );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: active ? 'var(--primary)' : 'transparent',
                color: active ? 'white' : 'var(--text-muted)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
            }}
        >
            {label}
        </button>
    );
}
