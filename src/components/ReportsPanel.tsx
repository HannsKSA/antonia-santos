'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ReportsPanel({ userProfile }: { userProfile: any }) {
    const [myPosts, setMyPosts] = useState<any[]>([]);
    const [pendingReports, setPendingReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'reach' | 'proposals' | 'reports'>('reach');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Mis noticias con cantidad de "enterados"
            const { data: posts } = await supabase
                .from('posts')
                .select(`
                    id, title, type, created_at, is_published,
                    group:groups(name),
                    reads:post_reads(count),
                    votes:proposal_votes(vote_type)
                `)
                .eq('author_id', userProfile.id)
                .order('created_at', { ascending: false });

            // 2. Para cada noticia, obtener quiénes la leyeron
            const postsWithDetails = await Promise.all((posts || []).map(async (p) => {
                const { data: readers } = await supabase
                    .from('post_reads')
                    .select('profiles!user_id(first_name, last_name)')
                    .eq('post_id', p.id);

                const upVotes = p.votes?.filter((v: any) => v.vote_type === 'up').length || 0;
                const downVotes = p.votes?.filter((v: any) => v.vote_type === 'down').length || 0;

                return { ...p, readers: readers || [], upVotes, downVotes };
            }));

            setMyPosts(postsWithDetails);

            // 3. Denuncias pendientes (solo super_admin y admin pueden verlas)
            if (['super_admin', 'admin'].includes(userProfile.role)) {
                const { data: reports } = await supabase
                    .from('reports')
                    .select(`
                        id, reason, status, created_at,
                        reporter:profiles!reporter_id(first_name, last_name),
                        post:posts(title),
                        comment:comments(content)
                    `)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });
                setPendingReports(reports || []);
            }

        } catch (error: any) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDismissReport = async (id: string) => {
        await supabase.from('reports').update({ status: 'dismissed' }).eq('id', id);
        fetchData();
    };

    const handleReviewReport = async (id: string) => {
        await supabase.from('reports').update({ status: 'reviewed' }).eq('id', id);
        fetchData();
    };

    const news = myPosts.filter(p => p.type === 'news');
    const proposals = myPosts.filter(p => p.type === 'proposal');
    const isAdmin = ['super_admin', 'admin'].includes(userProfile.role);

    if (loading) return <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando reportes...</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Resumen de métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                {[
                    { label: 'Noticias publicadas', value: news.length, emoji: '📰' },
                    { label: 'Propuestas lanzadas', value: proposals.length, emoji: '💡' },
                    { label: 'Total de lecturas', value: news.reduce((acc, p) => acc + p.readers.length, 0), emoji: '👁️' },
                    ...(isAdmin ? [{ label: 'Denuncias pendientes', value: pendingReports.length, emoji: '⚑', alert: pendingReports.length > 0 }] : []),
                ].map(card => (
                    <div key={card.label} className="glass-card" style={{
                        padding: '1.25rem',
                        textAlign: 'center',
                        borderTop: card.alert ? '3px solid var(--error)' : '3px solid var(--accent)'
                    }}>
                        <div style={{ fontSize: '1.75rem' }}>{card.emoji}</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>{card.value}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{card.label}</div>
                    </div>
                ))}
            </div>

            {/* Sub-navegación */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                {([
                    ['reach', '📰 Alcance de Noticias'],
                    ['proposals', '💡 Mis Propuestas'],
                    ...(isAdmin ? [['reports', `⚑ Denuncias (${pendingReports.length})`]] : [])
                ] as [string, string][]).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setActiveView(key as any)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            background: activeView === key ? 'var(--primary)' : 'transparent',
                            color: activeView === key ? 'white' : 'var(--text-muted)',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Alcance de Noticias */}
            {activeView === 'reach' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {news.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aún no has publicado noticias.</p>
                    ) : news.map(p => (
                        <div key={p.id} className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                        {p.group?.name}
                                    </span>
                                    <h4 style={{ marginTop: '0.4rem', color: 'var(--primary)' }}>{p.title}</h4>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString()}</p>
                                </div>
                                <div style={{ textAlign: 'center', minWidth: '60px' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent)' }}>{p.readers.length}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>enterados</div>
                                </div>
                            </div>
                            {p.readers.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    {p.readers.map((r: any, i: number) => (
                                        <span key={i} style={{
                                            fontSize: '0.78rem',
                                            padding: '0.2rem 0.6rem',
                                            background: '#ecfdf5',
                                            color: '#065f46',
                                            borderRadius: '20px',
                                            fontWeight: 500
                                        }}>
                                            ✓ {r.profiles?.first_name} {r.profiles?.last_name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Mis propuestas con estadísticas de votos */}
            {activeView === 'proposals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {proposals.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aún no has lanzado propuestas.</p>
                    ) : proposals.map(p => {
                        const total = p.upVotes + p.downVotes;
                        const supportPct = total > 0 ? Math.round((p.upVotes / total) * 100) : 0;
                        return (
                            <div key={p.id} className="glass-card" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                            💡 {p.group?.name}
                                        </span>
                                        <h4 style={{ marginTop: '0.4rem', color: 'var(--primary)' }}>{p.title}</h4>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: supportPct >= 50 ? 'var(--success)' : 'var(--error)' }}>{supportPct}%</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>de apoyo</div>
                                    </div>
                                </div>
                                {/* Barra de progreso */}
                                <div style={{ height: '8px', borderRadius: '4px', background: '#fee2e2', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${supportPct}%`, background: 'var(--success)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>👍 {p.upVotes} favor</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--error)' }}>👎 {p.downVotes} contra</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Panel de Denuncias */}
            {activeView === 'reports' && isAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {pendingReports.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No hay denuncias pendientes. ¡Todo en orden!</p>
                    ) : pendingReports.map(r => (
                        <div key={r.id} className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--error)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--error)' }}>
                                        Denunciado por: {r.reporter?.first_name} {r.reporter?.last_name}
                                    </p>
                                    <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
                                        <strong>Motivo:</strong> {r.reason}
                                    </p>
                                    {r.post && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Post: "{r.post?.title}"</p>}
                                    {r.comment && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Comentario: "{r.comment?.content?.substring(0, 60)}..."</p>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <button onClick={() => handleReviewReport(r.id)} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>✓ Revisado</button>
                                    <button onClick={() => handleDismissReport(r.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>✕ Desestimar</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
